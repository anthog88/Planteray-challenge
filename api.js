/* Kommunikation med Google-skriptet (eller demo-läge). Behöver inte ändras. */
(function () {
  var C = window.CONTEST;
  var DEMO = !C.apiUrl;

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function cookie(name, val) {
    if (val === undefined) {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    }
    document.cookie = name + "=" + encodeURIComponent(val) + "; max-age=31536000; path=/; SameSite=Lax";
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* Anonymt ID för den här mobilen. Sparas både i localStorage och cookie,
     så det överlever om bara det ena rensas. */
  function deviceId() {
    var id = store("pr_device") || cookie("pr_device");
    if (!id) id = uuid();
    store("pr_device", id);
    cookie("pr_device", id);
    return id;
  }

  /* ---------- Demo-backend: allt i webbläsarens minne ---------- */
  var demoMem = { votes: [], open: true, moderation: "pre" };
  function demoLoad() {
    var raw = store("pr_demo_db");
    if (raw) { try { demoMem = JSON.parse(raw); } catch (e) {} }
    if (!demoMem.moderation) demoMem.moderation = "pre";
    return demoMem;
  }
  function demoSave(db) {
    demoMem = db;
    // localStorage rymmer bara några MB: släng de äldsta bilderna om det blir fullt
    for (var tries = 0; tries < 30; tries++) {
      try { localStorage.setItem("pr_demo_db", JSON.stringify(db)); return; } catch (e) {
        var old = db.votes.filter(function (v) { return v.photo && v.photo.indexOf("data:") === 0; })[0];
        if (!old) return;
        old.photo = "images/" + (db.votes.indexOf(old) % 2 ? "drink-2.svg" : "drink-1.svg");
      }
    }
  }
  function cleanIg(s) {
    s = String(s || "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
    if (!s) return "";
    return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
  }
  function photoItem(v) {
    return { id: v.photoId, url: v.photo, drinkId: v.drinkId, drinkName: v.drinkName, barName: v.barName, instagram: v.instagram || "", show: v.show, status: v.status, ts: v.ts };
  }

  function demoCall(action, p) {
    var db = demoLoad();
    var max = C.maxVotes;
    function mine() { return db.votes.filter(function (v) { return v.device === p.device; }).map(function (v) { return v.drinkId; }); }
    function auth() { if (p.password !== "demo") throw { error: "wrong_password" }; }
    switch (action) {
      case "status":
        return { ok: true, open: db.open, maxVotes: max, moderation: db.moderation, votedDrinks: mine() };
      case "vote":
        if (!db.open) return { ok: false, error: "closed" };
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(p.photo || "")) return { ok: false, error: "photo_missing" };
        var ig = cleanIg(p.instagram);
        if (ig === null) return { ok: false, error: "bad_instagram" };
        var m = mine();
        if (m.indexOf(p.drinkId) >= 0) return { ok: false, error: "already_voted_drink", votedDrinks: m, maxVotes: max };
        if (m.length >= max) return { ok: false, error: "no_votes_left", votedDrinks: m, maxVotes: max };
        var show = p.showInFeed === true;
        var status = !show ? "Privat" : (db.moderation === "post" ? "Godkänd" : "Väntar");
        db.votes.push({ ts: new Date().toISOString(), device: p.device, drinkId: p.drinkId, drinkName: p.drinkName, barName: p.barName, ua: p.ua,
          photoId: "demo-" + Date.now().toString(36), photo: p.photo, instagram: ig, show: show, status: status });
        demoSave(db);
        m.push(p.drinkId);
        return { ok: true, votedDrinks: m, maxVotes: max, remaining: max - m.length, photoStatus: status };
      case "feed":
        return { ok: true, items: db.votes.filter(function (v) { return v.show && v.status === "Godkänd"; }).reverse().map(photoItem) };
      case "results":
        auth();
        var counts = {}, devices = {}, perDevice = {}, photoCounts = {};
        db.votes.forEach(function (v) {
          counts[v.drinkId] = counts[v.drinkId] || { drinkId: v.drinkId, drinkName: v.drinkName, barName: v.barName, votes: 0 };
          counts[v.drinkId].votes++;
          devices[v.device] = (devices[v.device] || 0) + 1;
          if (v.status) photoCounts[v.status] = (photoCounts[v.status] || 0) + 1;
        });
        Object.keys(devices).forEach(function (d) { perDevice[devices[d]] = (perDevice[devices[d]] || 0) + 1; });
        return {
          ok: true, open: db.open, moderation: db.moderation, maxVotes: max, totalVotes: db.votes.length,
          uniqueDevices: Object.keys(devices).length, perDevice: perDevice, photoCounts: photoCounts,
          results: Object.keys(counts).map(function (k) { return counts[k]; }),
          recent: db.votes.slice(-15).reverse().map(function (v) { return { ts: v.ts, drinkName: v.drinkName, device: v.device.slice(0, 8) }; })
        };
      case "photos":
        auth();
        var want = p.status || "Väntar";
        return { ok: true, items: db.votes.filter(function (v) { return v.photoId && (want === "alla" || v.status === want); }).reverse().map(photoItem) };
      case "setPhotoStatus":
        auth();
        var hit = db.votes.filter(function (v) { return v.photoId === p.id; })[0];
        if (!hit) return { ok: false, error: "not_found" };
        if (!hit.show) return { ok: false, error: "not_allowed" };
        hit.status = p.status; demoSave(db);
        return { ok: true, id: p.id, status: p.status };
      case "setModeration":
        auth();
        db.moderation = p.mode === "post" ? "post" : "pre"; demoSave(db);
        return { ok: true, moderation: db.moderation };
      case "export":
        auth();
        return { ok: true, rows: db.votes.map(function (v) {
          return [v.ts, v.device, v.drinkId, v.drinkName, v.barName, v.ua, v.photoId || "", (v.photo || "").indexOf("data:") === 0 ? "(bild i demoläge)" : (v.photo || ""), v.instagram || "", v.show ? "Ja" : "Nej", v.status || ""];
        }) };
      case "setOpen":
        auth();
        db.open = !!p.open; demoSave(db);
        return { ok: true, open: db.open };
      case "reset":
        auth();
        db.votes = []; demoSave(db);
        return { ok: true };
    }
    return { ok: false, error: "unknown_action" };
  }

  /* ---------- Riktig backend: Google Apps Script ---------- */
  function call(action, payload) {
    payload = payload || {};
    if (DEMO) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try { resolve(demoCall(action, payload)); } catch (e) { resolve({ ok: false, error: e.error || "error" }); }
        }, 350);
      });
    }
    var body = JSON.stringify(Object.assign({ action: action }, payload));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, action === "vote" ? 60000 : 20000);
    /* text/plain undviker CORS-förfrågan som Apps Script inte hanterar */
    return fetch(C.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow",
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).catch(function (e) {
      clearTimeout(timer);
      return { ok: false, error: "network", detail: String(e && e.message || e) };
    });
  }

  /* Krymper mobilbilden till max `maxSide` px och gör om till JPEG.
     En 12-megapixelbild på 4 MB blir ca 200–300 kB, så uppladdningen går fort även på 4G. */
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
      img.src = url;
    });
  }

  window.VoteAPI = { call: call, deviceId: deviceId, demo: DEMO, compressImage: compressImage };
})();
