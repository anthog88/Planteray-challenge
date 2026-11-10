/**
 * Planteray Cocktail Challenge – röstnings-backend
 * ------------------------------------------------------------------
 * Klistra in hela den här filen i Apps Script (Tillägg > Apps Script)
 * i ditt Google-kalkylark. Se GUIDE.md för steg-för-steg.
 *
 * Lösenordet till adminvyn sätts INTE här, utan under
 * Projektinställningar > Skriptegenskaper > ADMIN_PASSWORD.
 *
 * Bilderna sparas i mappen "Planteray röstbilder" på din Google Drive.
 */

// Antal röster per gäst. Ska vara samma som maxVotes i content.js.
var MAX_VOTES = 3;

// Namnet på Drive-mappen där bilderna sparas.
var PHOTO_FOLDER_NAME = 'Planteray röstbilder';

// Max antal bilder som visas i bildflödet på sajten.
var FEED_LIMIT = 150;

var SHEET_NAME = 'Röster';
var HEADERS = ['Tidpunkt', 'Enhets-ID', 'Drink-ID', 'Drink', 'Bar', 'Webbläsare',
               'Bild-ID', 'Bildlänk', 'Instagram', 'Visa i flöde', 'Bildstatus'];
// Kolumnnummer (1 = A)
var COL = { TS: 1, DEVICE: 2, DRINK_ID: 3, DRINK: 4, BAR: 5, UA: 6,
            PHOTO_ID: 7, PHOTO_URL: 8, INSTAGRAM: 9, SHOW: 10, STATUS: 11 };

var STATUS = { PENDING: 'Väntar', APPROVED: 'Godkänd', HIDDEN: 'Dold', PRIVATE: 'Privat' };
var MAX_PHOTO_CHARS = 4000000; // ca 3 MB bild efter komprimering i mobilen

/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: true, service: 'planteray-vote', open: isOpen_() });
}

function doPost(e) {
  var p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  try {
    switch (p.action) {
      case 'status':         return json_(status_(p));
      case 'vote':           return json_(vote_(p));
      case 'feed':           return json_(feed_());
      case 'results':        requireAdmin_(p); return json_(results_());
      case 'export':         requireAdmin_(p); return json_(exportRows_());
      case 'setOpen':        requireAdmin_(p); return json_(setOpen_(p));
      case 'reset':          requireAdmin_(p); return json_(reset_());
      case 'photos':         requireAdmin_(p); return json_(photos_(p));
      case 'setPhotoStatus': requireAdmin_(p); return json_(setPhotoStatus_(p));
      case 'setModeration':  requireAdmin_(p); return json_(setModeration_(p));
      default:               return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code });
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

/* ---------------------------- Gäst -------------------------------- */

function status_(p) {
  var device = cleanDevice_(p.device);
  return {
    ok: true,
    open: isOpen_(),
    maxVotes: MAX_VOTES,
    moderation: moderation_(),
    votedDrinks: device ? votesFor_(device) : []
  };
}

function vote_(p) {
  var device = cleanDevice_(p.device);
  var drinkId = String(p.drinkId || '');
  if (!device || !/^[a-z0-9_-]{1,40}$/i.test(drinkId)) return { ok: false, error: 'bad_request' };
  if (!isOpen_()) return { ok: false, error: 'closed' };

  // Bilden är obligatorisk
  var photo = String(p.photo || '');
  var m = photo.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) return { ok: false, error: 'photo_missing' };
  if (photo.length > MAX_PHOTO_CHARS) return { ok: false, error: 'photo_too_large' };

  var instagram = cleanInstagram_(p.instagram);
  if (instagram === null) return { ok: false, error: 'bad_instagram' };
  var show = p.showInFeed === true;

  // 1. Snabbkoll innan uppladdning, så att vi inte sparar bilder i onödan
  var mine = votesFor_(device);
  if (mine.indexOf(drinkId) >= 0) return { ok: false, error: 'already_voted_drink', votedDrinks: mine, maxVotes: MAX_VOTES };
  if (mine.length >= MAX_VOTES)   return { ok: false, error: 'no_votes_left', votedDrinks: mine, maxVotes: MAX_VOTES };

  // 2. Spara bilden i Drive (utanför låset, det tar en stund)
  var ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1],
    stamp + '_' + drinkId + '_' + device.slice(0, 8) + '.' + ext);
  var file = folder_().createFile(blob);
  file.setDescription('Drink: ' + clip_(p.drinkName, 80) + ' | Bar: ' + clip_(p.barName, 80) +
    (instagram ? ' | @' + instagram : '') + ' | Visa i flöde: ' + (show ? 'Ja' : 'Nej'));
  try {
    // Länkdelning krävs för att bilden ska kunna visas på sajten
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    console.warn('Kunde inte dela bilden: ' + shareErr);
  }
  var photoId = file.getId();
  var photoUrl = 'https://drive.google.com/thumbnail?id=' + photoId + '&sz=w1200';
  var status = !show ? STATUS.PRIVATE : (moderation_() === 'post' ? STATUS.APPROVED : STATUS.PENDING);

  // 3. Lås och kontrollera igen (två röster samtidigt från samma mobil)
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { file.setTrashed(true); return { ok: false, error: 'busy' }; }
  try {
    mine = votesFor_(device);
    if (mine.indexOf(drinkId) >= 0 || mine.length >= MAX_VOTES) {
      file.setTrashed(true);
      return { ok: false, error: mine.indexOf(drinkId) >= 0 ? 'already_voted_drink' : 'no_votes_left', votedDrinks: mine, maxVotes: MAX_VOTES };
    }
    sheet_().appendRow([
      new Date(), device, drinkId,
      clip_(p.drinkName, 80), clip_(p.barName, 80), clip_(p.ua, 200),
      photoId, photoUrl, instagram, show ? 'Ja' : 'Nej', status
    ]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  if (status === STATUS.APPROVED) clearFeedCache_();
  mine.push(drinkId);
  return {
    ok: true, votedDrinks: mine, maxVotes: MAX_VOTES, remaining: MAX_VOTES - mine.length,
    photoStatus: status
  };
}

/** Godkända bilder till bildflödet. Cachas 30 s så att många gäster inte belastar arket. */
function feed_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('feed');
  if (hit) return JSON.parse(hit);
  var rows = allRows_();
  var items = [];
  for (var i = rows.length - 1; i >= 0 && items.length < FEED_LIMIT; i--) {
    var r = rows[i];
    if (r[COL.STATUS - 1] !== STATUS.APPROVED || r[COL.SHOW - 1] !== 'Ja') continue;
    items.push({
      id: String(r[COL.PHOTO_ID - 1]),
      url: String(r[COL.PHOTO_URL - 1]),
      drinkId: String(r[COL.DRINK_ID - 1]),
      drinkName: String(r[COL.DRINK - 1]),
      barName: String(r[COL.BAR - 1]),
      instagram: String(r[COL.INSTAGRAM - 1] || ''),
      ts: toIso_(r[COL.TS - 1])
    });
  }
  var out = { ok: true, items: items };
  try { cache.put('feed', JSON.stringify(out), 30); } catch (e) {}
  return out;
}

/* ---------------------------- Admin ------------------------------- */

function results_() {
  var rows = allRows_();
  var counts = {}, devices = {}, photoCounts = {};
  rows.forEach(function (r) {
    var id = String(r[COL.DRINK_ID - 1]);
    if (!counts[id]) counts[id] = { drinkId: id, drinkName: r[COL.DRINK - 1], barName: r[COL.BAR - 1], votes: 0 };
    counts[id].votes++;
    var dev = r[COL.DEVICE - 1];
    devices[dev] = (devices[dev] || 0) + 1;
    var st = r[COL.STATUS - 1];
    if (st) photoCounts[st] = (photoCounts[st] || 0) + 1;
  });
  var perDevice = {};
  Object.keys(devices).forEach(function (d) {
    perDevice[devices[d]] = (perDevice[devices[d]] || 0) + 1;
  });
  var recent = rows.slice(-15).reverse().map(function (r) {
    return { ts: toIso_(r[COL.TS - 1]), drinkName: r[COL.DRINK - 1], device: String(r[COL.DEVICE - 1]).slice(0, 8) };
  });
  return {
    ok: true,
    open: isOpen_(),
    moderation: moderation_(),
    maxVotes: MAX_VOTES,
    totalVotes: rows.length,
    uniqueDevices: Object.keys(devices).length,
    perDevice: perDevice,
    photoCounts: photoCounts,
    results: Object.keys(counts).map(function (k) { return counts[k]; }),
    recent: recent
  };
}

/** Bilder för granskning. status: Väntar | Godkänd | Dold | Privat | alla */
function photos_(p) {
  var want = String(p.status || STATUS.PENDING);
  var rows = allRows_();
  var items = [];
  for (var i = rows.length - 1; i >= 0 && items.length < 200; i--) {
    var r = rows[i];
    if (!r[COL.PHOTO_ID - 1]) continue;
    if (want !== 'alla' && r[COL.STATUS - 1] !== want) continue;
    items.push({
      id: String(r[COL.PHOTO_ID - 1]),
      url: String(r[COL.PHOTO_URL - 1]),
      drinkId: String(r[COL.DRINK_ID - 1]),
      drinkName: String(r[COL.DRINK - 1]),
      barName: String(r[COL.BAR - 1]),
      instagram: String(r[COL.INSTAGRAM - 1] || ''),
      show: r[COL.SHOW - 1] === 'Ja',
      status: String(r[COL.STATUS - 1]),
      ts: toIso_(r[COL.TS - 1])
    });
  }
  return { ok: true, items: items };
}

function setPhotoStatus_(p) {
  var status = String(p.status || '');
  if ([STATUS.APPROVED, STATUS.HIDDEN, STATUS.PENDING].indexOf(status) < 0) return { ok: false, error: 'bad_request' };
  var id = String(p.id || '');
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) return { ok: false, error: 'bad_request' };
  var sh = sheet_();
  if (sh.getLastRow() < 2) return { ok: false, error: 'not_found' };
  var cell = sh.getRange(2, COL.PHOTO_ID, sh.getLastRow() - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  if (!cell) return { ok: false, error: 'not_found' };
  var row = cell.getRow();
  // En bild som gästen inte gett lov att visa kan aldrig publiceras
  if (sh.getRange(row, COL.SHOW).getValue() !== 'Ja') return { ok: false, error: 'not_allowed' };
  sh.getRange(row, COL.STATUS).setValue(status);
  clearFeedCache_();
  return { ok: true, id: id, status: status };
}

function setModeration_(p) {
  var mode = p.mode === 'post' ? 'post' : 'pre';
  PropertiesService.getScriptProperties().setProperty('PHOTO_MODERATION', mode);
  return { ok: true, moderation: mode };
}

function exportRows_() {
  return {
    ok: true,
    rows: allRows_().map(function (r) {
      var out = r.slice();
      out[0] = toIso_(r[0]);
      return out;
    })
  };
}

function setOpen_(p) {
  PropertiesService.getScriptProperties().setProperty('VOTING_OPEN', p.open ? 'true' : 'false');
  return { ok: true, open: !!p.open };
}

/** Flyttar alla röster till en arkivflik och börjar om. Inget raderas, bilderna ligger kvar i Drive. */
function reset_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_();
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm');
    sh.copyTo(SpreadsheetApp.getActive()).setName('Arkiv ' + stamp);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    clearFeedCache_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* --------------------------- Hjälpare ----------------------------- */

function requireAdmin_(p) {
  var pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw) throw { code: 'no_password_set' };
  if (String(p.password || '') !== pw) {
    Utilities.sleep(800); // bromsar gissningsförsök
    throw { code: 'wrong_password' };
  }
}

function isOpen_() {
  return PropertiesService.getScriptProperties().getProperty('VOTING_OPEN') !== 'false';
}

/** 'pre' = bilder granskas innan de visas (standard). 'post' = visas direkt. */
function moderation_() {
  return PropertiesService.getScriptProperties().getProperty('PHOTO_MODERATION') === 'post' ? 'post' : 'pre';
}

function clearFeedCache_() {
  try { CacheService.getScriptCache().remove('feed'); } catch (e) {}
}

function sheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    writeHeaders_(sh);
  }
  return sh;
}

function writeHeaders_(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function folder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* mappen borttagen, skapa ny */ }
  }
  var folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function allRows_() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues();
}

/** Vilka drinkar en viss mobil har röstat på. Söker bara i ID-kolumnen. */
function votesFor_(device) {
  var sh = sheet_();
  if (sh.getLastRow() < 2) return [];
  var hits = sh.getRange(2, COL.DEVICE, sh.getLastRow() - 1, 1)
    .createTextFinder(device).matchEntireCell(true).findAll();
  return hits.map(function (cell) {
    return String(sh.getRange(cell.getRow(), COL.DRINK_ID).getValue());
  });
}

function cleanDevice_(d) {
  d = String(d || '');
  return /^[a-z0-9-]{8,64}$/i.test(d) ? d : '';
}

/** Returnerar '' om tomt, null om ogiltigt, annars kontonamnet utan @ */
function cleanInstagram_(s) {
  s = String(s || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  if (!s) return '';
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}

function clip_(s, n) {
  s = String(s == null ? '' : s);
  // Förhindra att text tolkas som formel i kalkylarket
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s.slice(0, n);
}

function toIso_(v) {
  return v instanceof Date ? v.toISOString() : String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Kör den här från redigeraren: första gången, och igen efter att du
 * uppdaterat skriptet. Skapar fliken, rubrikerna och bildmappen och
 * ber om de behörigheter skriptet behöver.
 */
function setup() {
  var sh = sheet_();
  writeHeaders_(sh);
  var folder = folder_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VOTING_OPEN')) props.setProperty('VOTING_OPEN', 'true');
  if (!props.getProperty('PHOTO_MODERATION')) props.setProperty('PHOTO_MODERATION', 'pre');
  if (!props.getProperty('ADMIN_PASSWORD')) {
    Logger.log('OBS: Sätt ADMIN_PASSWORD under Projektinställningar > Skriptegenskaper.');
  }
  Logger.log('Klart! Fliken "' + SHEET_NAME + '" finns i kalkylarket och bilderna sparas i Drive-mappen: ' + folder.getUrl());
}
