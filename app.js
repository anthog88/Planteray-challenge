/* Gästsidans logik. Behöver normalt inte ändras — allt innehåll finns i content.js */
(function () {
  var C = window.CONTEST;
  var API = window.VoteAPI;
  var device = API.deviceId();

  var state = {
    max: C.maxVotes,
    voted: loadCachedVotes(),
    open: true,
    loaded: false,
    busy: false
  };

  /* ---------- Hjälpfunktioner ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function barById(id) { for (var i = 0; i < C.bars.length; i++) if (C.bars[i].id === id) return C.bars[i]; return null; }
  function drinkById(id) { for (var i = 0; i < C.drinks.length; i++) if (C.drinks[i].id === id) return C.drinks[i]; return null; }
  function remaining() { return Math.max(0, state.max - state.voted.length); }
  function igHandle(h) { return String(h || "").replace(/^@/, "").trim(); }
  function mapsLink(b) {
    if (b.mapsUrl) return b.mapsUrl;
    if (!b.address) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.name + ", " + b.address);
  }
  function loadCachedVotes() {
    try { return JSON.parse(localStorage.getItem("pr_voted") || "[]"); } catch (e) { return []; }
  }
  function cacheVotes() {
    try { localStorage.setItem("pr_voted", JSON.stringify(state.voted)); } catch (e) {}
  }
  function dotsHtml(n, max) {
    var h = "";
    for (var i = 0; i < max; i++) h += '<span class="dot' + (i < max - n ? " used" : "") + '"></span>';
    return h;
  }
  var ICON = {
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    bigCheck: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    ig: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    web: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
  };

  /* ---------- Rendera statiskt innehåll ---------- */
  function renderStatic() {
    document.title = C.eventName + " – Rösta";
    $("eventName").textContent = C.eventName;
    $("tagline").textContent = C.tagline;
    $("intro").textContent = C.intro;
    $("period").textContent = C.period;
    if (!C.period) $("period").style.display = "none";
    $("brandTitle").textContent = C.brandTitle;
    $("brandText").textContent = C.brandText;
    $("footer").textContent = C.footer;
    $("drinksLead").textContent = "Du har " + state.max + " röster. Rösta på de " + state.max + " drinkar du gillar mest, en röst per drink.";

    $("steps").innerHTML = C.howTo.map(function (s) {
      return '<li class="step"><h3>' + esc(s.title) + "</h3><p>" + esc(s.text) + "</p></li>";
    }).join("");

    // Barer
    $("barList").innerHTML = C.bars.map(function (b) {
      var drinks = C.drinks.filter(function (d) { return d.bar === b.id; });
      var links = "";
      var maps = mapsLink(b);
      if (maps) links += '<a class="pill-link" href="' + esc(maps) + '" target="_blank" rel="noopener">' + ICON.pin + "Hitta hit</a>";
      if (b.website) links += '<a class="pill-link" href="' + esc(b.website) + '" target="_blank" rel="noopener">' + ICON.web + "Webbplats</a>";
      if (b.instagram) links += '<a class="pill-link" href="https://www.instagram.com/' + esc(igHandle(b.instagram)) + '/" target="_blank" rel="noopener">' + ICON.ig + "@" + esc(igHandle(b.instagram)) + "</a>";
      return '<article class="bar-card" id="bar-' + esc(b.id) + '">' +
        '<img class="logo" src="' + esc(b.logo) + '" alt="Logotyp ' + esc(b.name) + '" loading="lazy">' +
        "<div><h3>" + esc(b.name) + '</h3><div class="city">' + esc(b.city) + "</div>" +
        "<p>" + esc(b.description) + "</p>" +
        (b.address ? '<p style="margin-top:6px;font-size:14px">' + esc(b.address) + "</p>" : "") +
        (drinks.length ? '<div class="drink-ref">Tävlingsdrink: ' + drinks.map(function (d) {
          return '<a href="#drink-' + esc(d.id) + '">' + esc(d.name) + "</a>";
        }).join(", ") + "</div>" : "") +
        '<div class="links">' + links + "</div></div></article>";
    }).join("");

    // Instagramvägg
    $("wallGrid").innerHTML = C.bars.filter(function (b) { return b.instagram; }).map(function (b) {
      var h = igHandle(b.instagram);
      return '<a class="wall-item" href="https://www.instagram.com/' + esc(h) + '/" target="_blank" rel="noopener" aria-label="' + esc(b.name) + ' på Instagram">' +
        '<img src="' + esc(b.logo) + '" alt="" loading="lazy">' +
        '<span class="n">' + esc(b.name) + "</span>" +
        '<span class="ig">' + ICON.ig + "@" + esc(h) + "</span></a>";
    }).join("");
  }

  /* ---------- Drinkkort (renderas om när röster ändras) ---------- */
  function renderDrinks() {
    $("drinkGrid").innerHTML = C.drinks.map(function (d) {
      var b = barById(d.bar) || { name: "", logo: "", id: "" };
      var voted = state.voted.indexOf(d.id) >= 0;
      var disabled = !voted && (remaining() === 0 || !state.open);
      var label = voted ? ICON.check + " Du har röstat" : (!state.open ? "Röstningen är stängd" : (remaining() === 0 ? "Inga röster kvar" : "Rösta på " + esc(d.name)));
      return '<article class="drink' + (voted ? " voted" : "") + '" id="drink-' + esc(d.id) + '">' +
        '<div class="photo"><img src="' + esc(d.image) + '" alt="' + esc(d.name) + '" loading="lazy">' +
        '<span class="voted-badge">' + ICON.check + "Din röst</span></div>" +
        '<div class="body">' +
        "<h3>" + esc(d.name) + "</h3>" +
        '<a class="bar-link" href="#bar-' + esc(b.id) + '">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + esc(b.name) + (b.city ? " · " + esc(b.city) : "") + "</a>" +
        '<p class="desc">' + esc(d.description) + "</p>" +
        (d.ingredients && d.ingredients.length ? '<ul class="chips" aria-label="Ingredienser">' + d.ingredients.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" : "") +
        '<button class="vote-btn" data-drink="' + esc(d.id) + '"' + (disabled ? " disabled" : "") + (voted ? ' aria-pressed="true"' : "") + ">" + label + "</button>" +
        "</div></article>";
    }).join("");
  }

  function renderStatus() {
    var r = remaining();
    $("pillText").textContent = r + " kvar";
    $("pillDots").innerHTML = dotsHtml(r, state.max);
    var banner = $("banner");
    banner.className = "banner";
    if (!state.open) {
      banner.className = "banner show closed";
      banner.textContent = "Röstningen är stängd just nu. Tack till alla som har röstat!";
    } else if (r === 0) {
      banner.className = "banner show done";
      banner.textContent = "Du har lagt alla dina " + state.max + " röster. Tack för att du röstade!";
    } else if (API.demo) {
      banner.className = "banner show demo";
      banner.textContent = "Demoläge: rösterna sparas bara i din egen mobil tills sajten kopplas till Google-kalkylarket.";
    }
    updateFloat();
  }

  function render() { renderDrinks(); renderStatus(); }

  /* ---------- Dialog ---------- */
  var backdrop = $("sheetBackdrop"), sheet = $("sheet"), lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    sheet.innerHTML = '<div class="grab"></div>' + html;
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var f = sheet.querySelector("[data-autofocus]") || sheet.querySelector("button");
    if (f) setTimeout(function () { f.focus(); }, 50);
  }
  function closeSheet() {
    if (state.busy) return;
    vote = null;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  /* ---------- Röstning med bild ---------- */
  var vote = null; // { drink, bar, photo }

  function savedIg() { try { return localStorage.getItem("pr_ig") || ""; } catch (e) { return ""; } }
  function cleanIg(s) {
    s = String(s || "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
    if (!s) return "";
    return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
  }

  function confirmVote(d) {
    var b = barById(d.bar) || { name: "" };
    var r = remaining();
    vote = { drink: d, bar: b, photo: null };
    openSheet(
      '<h3 id="sheetTitle">Rösta på ' + esc(d.name) + "</h3>" +
      "<p>från " + esc(b.name) + "</p>" +
      '<div class="photo-step">' +
      '<div id="photoBox">' + photoPicker() + "</div>" +
      '<p class="photo-note">Bilden bekräftar din röst och sparas av arrangören under tävlingen.</p>' +
      '<label class="opt-row"><input type="checkbox" id="showFeed">' +
      "<span>Visa min bild i bildflödet<small>Bilden visas på sajten tillsammans med drinken och baren.</small></span></label>" +
      '<div class="ig-field" id="igField"><label for="igInput">Ditt Instagram (valfritt)</label>' +
      '<div class="ig-input"><span>@</span><input id="igInput" type="text" inputmode="text" autocapitalize="off" autocomplete="off" spellcheck="false" maxlength="40" placeholder="dittkonto" value="' + esc(savedIg()) + '"></div>' +
      '<div class="field-err" id="igErr"></div></div>' +
      "</div>" +
      '<p style="font-size:14px">Du har ' + r + (r === 1 ? " röst" : " röster") + " kvar. En röst går inte att ångra.</p>" +
      '<div class="actions">' +
      '<button class="cta" id="confirmBtn" disabled>Ta en bild för att rösta</button>' +
      '<button class="secondary" id="cancelBtn">Avbryt</button></div>'
    );
    bindPhotoInput();
    $("showFeed").onchange = function () { $("igField").classList.toggle("show", this.checked); };
    $("igInput").oninput = function () {
      $("igErr").textContent = "";
      if (/^@/.test(this.value)) this.value = this.value.replace(/^@+/, "");
    };
    $("cancelBtn").onclick = function () { vote = null; closeSheet(); };
    $("confirmBtn").onclick = function () { sendVote(); };
  }

  function photoPicker() {
    return '<label class="photo-drop" id="photoDrop">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' +
      "Ta en bild på drinken<small>Kameran öppnas i din mobil</small>" +
      '<input type="file" accept="image/*" capture="environment" id="photoInput" aria-label="Ta en bild på drinken"></label>';
  }

  function bindPhotoInput() {
    var input = $("photoInput");
    if (!input) return;
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|heic|webp)$/i.test(file.name)) { toast("Välj en bild."); return; }
      $("photoBox").innerHTML = '<div class="photo-drop" style="cursor:default"><span class="spinner"></span>Förbereder bilden…</div>';
      var size = API.demo ? 720 : 1280;
      API.compressImage(file, size, 0.8).then(function (dataUrl) {
        vote.photo = dataUrl;
        $("photoBox").innerHTML = '<div class="photo-preview"><img src="' + dataUrl + '" alt="Din bild på ' + esc(vote.drink.name) + '">' +
          '<label class="retake">Ta om<input type="file" accept="image/*" capture="environment" id="photoInput" aria-label="Ta en ny bild"></label></div>';
        bindPhotoInput();
        var btn = $("confirmBtn");
        btn.disabled = false;
        btn.textContent = "Skicka min röst";
      }).catch(function () {
        $("photoBox").innerHTML = photoPicker();
        bindPhotoInput();
        toast("Bilden gick inte att läsa. Försök ta en ny.");
      });
    };
  }

  function sendVote() {
    if (state.busy || !vote || !vote.photo) return;
    var show = $("showFeed").checked;
    var ig = show ? cleanIg($("igInput").value) : "";
    if (ig === null) {
      $("igErr").textContent = "Skriv bara kontonamnet, t.ex. dittkonto. Bokstäver, siffror, punkt och understreck.";
      $("igInput").focus();
      return;
    }
    if (ig) { try { localStorage.setItem("pr_ig", ig); } catch (e) {} }
    var d = vote.drink, b = vote.bar;
    state.busy = true;
    var btn = $("confirmBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Skickar bild och röst…';
    $("cancelBtn").style.visibility = "hidden";

    API.call("vote", {
      device: device, drinkId: d.id, drinkName: d.name, barName: b.name,
      ua: navigator.userAgent.slice(0, 200),
      photo: vote.photo, showInFeed: show, instagram: ig
    }).then(function (res) {
      state.busy = false;
      if (res.votedDrinks) { state.voted = res.votedDrinks; cacheVotes(); }
      if (res.maxVotes) state.max = res.maxVotes;
      if (res.ok) {
        render();
        showSuccess(d, res.photoStatus);
        vote = null;
        if (res.photoStatus === "Godkänd") loadFeed();
        return;
      }
      var msg = {
        closed: "Röstningen är stängd.",
        already_voted_drink: "Du har redan röstat på den här drinken.",
        no_votes_left: "Du har inga röster kvar.",
        photo_missing: "Du behöver ta en bild på drinken för att rösta.",
        photo_too_large: "Bilden är för stor. Försök ta en ny.",
        bad_instagram: "Instagram-namnet ser inte rätt ut.",
        network: "Det gick inte att skicka rösten. Kontrollera uppkopplingen och försök igen.",
        busy: "Många röstar just nu. Försök igen om några sekunder."
      }[res.error] || "Något gick fel. Försök igen.";
      // Fel som går att rätta: låt gästen stanna kvar i dialogen med sin bild
      if (["network", "busy", "bad_instagram", "server_error"].indexOf(res.error) >= 0 || !res.error) {
        btn.disabled = false;
        btn.textContent = "Försök igen";
        $("cancelBtn").style.visibility = "";
        toast(msg);
        return;
      }
      if (res.error === "closed") state.open = false;
      render();
      closeSheet();
      toast(msg);
    });
  }

  function showSuccess(d, photoStatus) {
    var r = remaining();
    var text = r === 0
      ? "Det var din sista röst. Tack för att du röstade!"
      : "Du har <strong>" + r + (r === 1 ? " röst" : " röster") + " kvar</strong>. Rösta gärna på " + (r === 1 ? "en drink till" : "fler drinkar") + ".";
    var feedNote = photoStatus === "Godkänd" ? "Din bild finns nu i bildflödet."
      : photoStatus === "Väntar" ? "Din bild visas i bildflödet när arrangören har godkänt den." : "";
    openSheet(
      '<div class="check">' + ICON.bigCheck + "</div>" +
      '<h3 id="sheetTitle">Tack för din röst!</h3>' +
      "<p>Du röstade på <strong>" + esc(d.name) + "</strong>.</p>" +
      '<div class="dots" aria-hidden="true">' + dotsHtml(r, state.max) + "</div>" +
      '<p style="margin-top:12px">' + text + "</p>" +
      (feedNote ? '<p style="font-size:14px">' + feedNote + "</p>" : "") +
      '<div class="actions">' +
      (r > 0 ? '<button class="cta" id="moreBtn" data-autofocus>Se fler drinkar</button>' : '<button class="cta" id="feedBtn" data-autofocus>Se bildflödet</button>') +
      '<button class="secondary" id="closeBtn">Stäng</button></div>'
    );
    $("closeBtn").onclick = closeSheet;
    if ($("moreBtn")) $("moreBtn").onclick = function () { closeSheet(); document.getElementById("drinkar").scrollIntoView(); };
    if ($("feedBtn")) $("feedBtn").onclick = function () { closeSheet(); document.getElementById("bilder").scrollIntoView(); };
  }

  /* ---------- Bildflöde ---------- */
  var feed = { items: [], filter: "all", shown: 12 };

  function renderFeedFilter() {
    var ids = {};
    feed.items.forEach(function (it) { ids[it.drinkId] = true; });
    var chips = [{ id: "all", name: "Alla" }].concat(C.drinks.filter(function (d) { return ids[d.id]; }));
    if (chips.length <= 2) { $("feedFilter").innerHTML = ""; if (feed.filter !== "all" && !ids[feed.filter]) feed.filter = "all"; return; }
    $("feedFilter").innerHTML = chips.map(function (c) {
      return '<button data-f="' + esc(c.id) + '" aria-pressed="' + (feed.filter === c.id) + '">' + esc(c.name) + "</button>";
    }).join("");
  }

  function renderFeed() {
    renderFeedFilter();
    var list = feed.items.filter(function (it) { return feed.filter === "all" || it.drinkId === feed.filter; });
    if (!list.length) {
      $("feedGrid").innerHTML = '<div class="feed-empty"><b>Inga bilder ännu</b>Rösta på en drink och välj att visa din bild, så hamnar den här.</div>';
      $("feedMore").hidden = true;
      return;
    }
    $("feedGrid").innerHTML = list.slice(0, feed.shown).map(function (it) {
      return '<button class="feed-item" data-id="' + esc(it.id) + '" aria-label="Bild på ' + esc(it.drinkName) + ' från ' + esc(it.barName) + '">' +
        '<img src="' + esc(it.url) + '" alt="" loading="lazy" onerror="feedImgError(this)">' +
        '<span class="cap"><b>' + esc(it.drinkName) + "</b><span>" + esc(it.barName) + "</span>" +
        (it.instagram ? '<span class="who">@' + esc(it.instagram) + "</span>" : "") + "</span></button>";
    }).join("");
    $("feedMore").hidden = list.length <= feed.shown;
  }

  // Drive-miniatyrer misslyckas ibland: prova alternativ adress en gång
  window.feedImgError = function (img) {
    var m = img.src.match(/[?&]id=([^&]+)/);
    if (m && !img.dataset.retry) { img.dataset.retry = "1"; img.src = "https://lh3.googleusercontent.com/d/" + m[1] + "=w1200"; }
  };

  $("feedFilter").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-f]");
    if (!btn) return;
    feed.filter = btn.getAttribute("data-f");
    feed.shown = 12;
    renderFeed();
  });
  $("feedMore").onclick = function () { feed.shown += 12; renderFeed(); };

  $("feedGrid").addEventListener("click", function (e) {
    var el = e.target.closest(".feed-item");
    if (!el) return;
    var it = feed.items.filter(function (x) { return x.id === el.getAttribute("data-id"); })[0];
    if (!it) return;
    var drink = drinkById(it.drinkId);
    openSheet(
      '<img class="lightbox-img" src="' + esc(it.url) + '" alt="Bild på ' + esc(it.drinkName) + '" onerror="feedImgError(this)">' +
      '<h3 id="sheetTitle">' + esc(it.drinkName) + "</h3>" +
      "<p>" + esc(it.barName) + "</p>" +
      (it.instagram ? '<p><a href="https://www.instagram.com/' + esc(it.instagram) + '/" target="_blank" rel="noopener" style="color:var(--gold-dark);font-weight:700">@' + esc(it.instagram) + "</a></p>" : "") +
      '<div class="actions">' +
      (drink ? '<button class="cta" id="toDrink" data-autofocus>Se drinken</button>' : "") +
      '<button class="secondary" id="closeBtn">Stäng</button></div>'
    );
    $("closeBtn").onclick = closeSheet;
    if ($("toDrink")) $("toDrink").onclick = function () { closeSheet(); document.getElementById("drink-" + drink.id).scrollIntoView(); };
  });

  function loadFeed() {
    return API.call("feed", {}).then(function (res) {
      if (!res.ok) return;
      feed.items = res.items || [];
      renderFeed();
    });
  }

  $("drinkGrid").addEventListener("click", function (e) {
    var btn = e.target.closest(".vote-btn");
    if (!btn) return;
    var d = drinkById(btn.getAttribute("data-drink"));
    if (!d) return;
    if (state.voted.indexOf(d.id) >= 0) { toast("Du har redan röstat på " + d.name + "."); return; }
    if (!state.open) { toast("Röstningen är stängd."); return; }
    if (remaining() === 0) { toast("Du har inga röster kvar."); return; }
    confirmVote(d);
  });

  /* ---------- Flytande "Rösta nu"-knapp ---------- */
  var heroVisible = true, drinksVisible = false;
  function updateFloat() {
    var show = !heroVisible && !drinksVisible && remaining() > 0 && state.open;
    $("floatCta").classList.toggle("show", show);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; updateFloat(); }).observe($("start"));
    new IntersectionObserver(function (en) { drinksVisible = en[0].isIntersecting; updateFloat(); }, { threshold: 0.05 }).observe($("drinkGrid"));
  }

  /* ---------- Start ---------- */
  renderStatic();
  render();

  function refreshStatus() {
    return API.call("status", { device: device }).then(function (res) {
      if (!res.ok) return;
      state.loaded = true;
      state.open = res.open !== false;
      if (res.maxVotes) state.max = res.maxVotes;
      state.voted = res.votedDrinks || [];
      cacheVotes();
      render();
    });
  }
  refreshStatus();
  renderFeed();
  loadFeed();
  // Uppdatera bildflödet varje minut när sidan är öppen
  setInterval(function () { if (!document.hidden && !state.busy) loadFeed(); }, 60000);
  // Uppdatera när gästen kommer tillbaka till fliken
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !state.busy) { refreshStatus(); loadFeed(); } });

  // Hoppa direkt till en drink via länk, t.ex. ...#drink-fjallbris
  if (location.hash && document.querySelector(location.hash)) {
    setTimeout(function () { document.querySelector(location.hash).scrollIntoView(); }, 100);
  }
})();
