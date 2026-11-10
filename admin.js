/* Adminvyns logik. Lösenordet kontrolleras av Google-skriptet, inte här. */
(function () {
  var C = window.CONTEST;
  var API = window.VoteAPI;
  var pw = null;
  var data = null;
  var timer = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 3500);
  }
  function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
  function fmtPct(n) { return String(n).replace(".", ",") + " %"; }
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function barById(id) { return C.bars.filter(function (b) { return b.id === id; })[0]; }

  var ERR = {
    wrong_password: "Fel lösenord.",
    no_password_set: "Inget adminlösenord är satt i Google-skriptet (ADMIN_PASSWORD).",
    network: "Kunde inte nå servern. Kontrollera apiUrl i content.js och uppkopplingen."
  };

  $("adminTitle").textContent = C.eventName;
  if (API.demo) $("loginNote").textContent = "Demoläge: lösenordet är \"demo\".";

  /* ---------- Inloggning ---------- */
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("loginBtn");
    btn.disabled = true; btn.textContent = "Loggar in…"; $("loginErr").textContent = "";
    pw = $("pw").value;
    load().then(function (ok) {
      btn.disabled = false; btn.textContent = "Logga in";
      if (ok) {
        try { sessionStorage.setItem("pr_admin_pw", pw); } catch (e2) {}
        showAdmin();
      }
    });
  });

  function showAdmin() {
    $("login").style.display = "none";
    $("admin").classList.add("show");
    loadPhotos();
    clearInterval(timer);
    timer = setInterval(function () { if (!document.hidden) { load(); if (photoTab === "Väntar") loadPhotos(); } }, 30000);
  }

  $("logoutBtn").onclick = function () {
    try { sessionStorage.removeItem("pr_admin_pw"); } catch (e) {}
    location.reload();
  };
  $("refreshBtn").onclick = function () { loadPhotos(); load().then(function (ok) { if (ok) toast("Uppdaterat"); }); };

  /* ---------- Hämta och visa ---------- */
  function load() {
    return API.call("results", { password: pw }).then(function (res) {
      if (!res.ok) {
        var msg = ERR[res.error] || ("Fel: " + res.error);
        if ($("admin").classList.contains("show")) toast(msg); else $("loginErr").textContent = msg;
        return false;
      }
      data = res;
      render();
      return true;
    });
  }

  function mergedResults() {
    // Utgå från drinkarna i content.js så att drinkar utan röster också syns
    var byId = {};
    (data.results || []).forEach(function (r) { byId[r.drinkId] = r; });
    var list = C.drinks.map(function (d) {
      var b = barById(d.bar) || {};
      var r = byId[d.id];
      delete byId[d.id];
      return { id: d.id, name: d.name, bar: b.name || "", barId: d.bar, image: d.image, votes: r ? r.votes : 0, known: true };
    });
    // Röster på drink-ID som inte längre finns i content.js
    Object.keys(byId).forEach(function (k) {
      var r = byId[k];
      list.push({ id: k, name: r.drinkName || k, bar: r.barName || "", barId: "", image: "", votes: r.votes, known: false });
    });
    list.sort(function (a, b) { return b.votes - a.votes || a.name.localeCompare(b.name, "sv"); });
    return list;
  }

  function render() {
    var total = data.totalVotes || 0;
    $("kTotal").textContent = total.toLocaleString("sv-SE");
    $("kDevices").textContent = (data.uniqueDevices || 0).toLocaleString("sv-SE");
    $("kAvg").textContent = data.uniqueDevices ? (total / data.uniqueDevices).toFixed(1).replace(".", ",") : "–";
    $("kOpen").innerHTML = '<span class="status-dot" style="background:' + (data.open ? "var(--ok)" : "var(--coral)") + '"></span>' + (data.open ? "Öppen" : "Stängd");
    $("toggleOpen").textContent = data.open ? "Stäng röstningen" : "Öppna röstningen";
    $("updated").textContent = "Uppdaterad " + new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

    var pc = data.photoCounts || {};
    $("kPending").textContent = (pc["Väntar"] || 0).toLocaleString("sv-SE");
    $("cWait").textContent = pc["Väntar"] || 0;
    $("cOk").textContent = pc["Godkänd"] || 0;
    $("cHid").textContent = pc["Dold"] || 0;
    $("cPriv").textContent = pc["Privat"] || 0;
    $("modToggle").checked = data.moderation !== "post";
    $("modHint").textContent = data.moderation !== "post"
      ? "På: nya bilder hamnar under Att granska och syns först när du godkänt dem."
      : "Av: nya bilder visas direkt. Du kan dölja dem i efterhand.";

    var list = mergedResults();
    var max = list.reduce(function (m, r) { return Math.max(m, r.votes); }, 0);
    var pos = 0, lastVotes = null;
    $("rank").innerHTML = list.map(function (r, i) {
      if (r.votes !== lastVotes) { pos = i + 1; lastVotes = r.votes; }
      return "<li>" +
        '<div class="pos">' + pos + "</div>" +
        (r.image ? '<img src="' + esc(r.image) + '" alt="">' : '<div style="width:52px;height:52px;border-radius:12px;background:var(--line)"></div>') +
        "<div><div class=\"name\">" + esc(r.name) + (r.known ? "" : '<span class="unknown">finns ej i content.js</span>') + "</div>" +
        '<div class="bar">' + esc(r.bar) + "</div>" +
        '<div class="track"><div class="fill" style="width:' + (max ? (r.votes / max) * 100 : 0) + '%"></div></div></div>' +
        '<div class="num"><b>' + r.votes + "</b><span>" + fmtPct(pct(r.votes, total)) + "</span></div>" +
        "</li>";
    }).join("");

    // Per bar
    var bars = {};
    list.forEach(function (r) { var k = r.bar || "Okänd"; bars[k] = (bars[k] || 0) + r.votes; });
    $("barTable").innerHTML = Object.keys(bars).sort(function (a, b) { return bars[b] - bars[a]; }).map(function (k) {
      return "<tr><td>" + esc(k) + '</td><td class="r">' + bars[k] + '</td><td class="r">' + fmtPct(pct(bars[k], total)) + "</td></tr>";
    }).join("");

    // Senaste
    $("recent").innerHTML = (data.recent || []).length ? data.recent.map(function (r) {
      return "<tr><td>" + esc(fmtTime(r.ts)) + "</td><td>" + esc(r.drinkName) + '</td><td class="muted">' + esc(r.device) + "</td></tr>";
    }).join("") : '<tr><td colspan="3" class="muted">Inga röster ännu.</td></tr>';

    var pd = data.perDevice || {};
    var parts = Object.keys(pd).sort().map(function (k) { return pd[k] + (pd[k] === 1 ? " mobil har" : " mobiler har") + " lagt " + k + (k === "1" ? " röst" : " röster"); });
    $("perDevice").textContent = parts.length ? parts.join(" · ") : "";
  }

  /* ---------- Bildgranskning ---------- */
  var photoTab = "Väntar";
  var LABEL = { "Väntar": "Väntar", "Godkänd": "I flödet", "Dold": "Dold", "Privat": "Ej för flödet" };

  function loadPhotos() {
    return API.call("photos", { password: pw, status: photoTab }).then(function (res) {
      if (!res.ok) { $("photoGrid").innerHTML = '<div class="pa-empty">Kunde inte hämta bilderna.</div>'; return; }
      renderPhotos(res.items || []);
    });
  }

  function renderPhotos(items) {
    if (!items.length) {
      $("photoGrid").innerHTML = '<div class="pa-empty">' + (photoTab === "Väntar" ? "Inga bilder väntar på granskning." : "Inga bilder här.") + "</div>";
      return;
    }
    $("photoGrid").innerHTML = items.map(function (it) {
      var acts = "";
      if (it.show) {
        if (it.status !== "Godkänd") acts += '<button class="ok" data-act="Godkänd" data-id="' + esc(it.id) + '">Godkänn</button>';
        if (it.status !== "Dold") acts += '<button class="no" data-act="Dold" data-id="' + esc(it.id) + '">Dölj</button>';
      }
      return '<div class="pa">' +
        '<a class="img" href="' + esc(it.url) + '" target="_blank" rel="noopener"><img src="' + esc(it.url) + '" alt="" loading="lazy" onerror="adminImgError(this)"></a>' +
        '<div class="info"><b>' + esc(it.drinkName) + "</b>" + esc(it.barName) +
        (it.instagram ? '<br><a class="ig" href="https://www.instagram.com/' + esc(it.instagram) + '/" target="_blank" rel="noopener">@' + esc(it.instagram) + "</a>" : "") +
        '<br><span class="muted">' + esc(fmtTime(it.ts)) + "</span></div>" +
        (acts ? '<div class="acts">' + acts + "</div>" : "") + "</div>";
    }).join("");
  }

  window.adminImgError = function (img) {
    var m = img.src.match(/[?&]id=([^&]+)/);
    if (m && !img.dataset.retry) { img.dataset.retry = "1"; img.src = "https://lh3.googleusercontent.com/d/" + m[1] + "=w600"; }
  };

  $("photoTabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-s]");
    if (!b) return;
    photoTab = b.getAttribute("data-s");
    Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.setAttribute("aria-selected", String(x === b)); });
    $("photoGrid").innerHTML = '<div class="pa-empty">Hämtar bilder…</div>';
    loadPhotos();
  });

  $("photoGrid").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]");
    if (!b) return;
    var card = b.closest(".pa");
    Array.prototype.forEach.call(card.querySelectorAll("button"), function (x) { x.disabled = true; });
    var status = b.getAttribute("data-act");
    API.call("setPhotoStatus", { password: pw, id: b.getAttribute("data-id"), status: status }).then(function (res) {
      if (!res.ok) {
        Array.prototype.forEach.call(card.querySelectorAll("button"), function (x) { x.disabled = false; });
        toast(res.error === "not_allowed" ? "Gästen har inte gett lov att visa bilden." : "Det gick inte att ändra.");
        return;
      }
      card.style.transition = "opacity .25s"; card.style.opacity = "0";
      setTimeout(function () { card.remove(); if (!$("photoGrid").children.length) renderPhotos([]); }, 260);
      toast(status === "Godkänd" ? "Bilden visas nu i bildflödet" : "Bilden är dold");
      load();
    });
  });

  $("modToggle").onchange = function () {
    var box = this, mode = box.checked ? "pre" : "post";
    box.disabled = true;
    API.call("setModeration", { password: pw, mode: mode }).then(function (res) {
      box.disabled = false;
      if (!res.ok) { box.checked = !box.checked; toast("Det gick inte att ändra."); return; }
      toast(mode === "pre" ? "Nya bilder granskas innan de visas" : "Nya bilder visas direkt");
      load();
    });
  };

  $("kPendingBox").onclick = function () {
    $("photoTabs").querySelector('[data-s="Väntar"]').click();
    $("photoPanel").scrollIntoView({ behavior: "smooth" });
  };

  /* ---------- Bekräftelsedialog (ersätter confirm/prompt) ---------- */
  function ask(opts) {
    return new Promise(function (resolve) {
      var dlg = $("dlg"), input = $("dlgInput"), ok = $("dlgOk");
      $("dlgTitle").textContent = opts.title;
      $("dlgText").textContent = opts.text;
      ok.textContent = opts.ok;
      $("dlgInputWrap").style.display = opts.require ? "block" : "none";
      $("dlgLabel").textContent = opts.require ? "Skriv " + opts.require + " för att bekräfta" : "";
      input.value = "";
      ok.disabled = !!opts.require;
      input.oninput = function () { ok.disabled = input.value.trim().toUpperCase() !== opts.require; };
      function done(v) { dlg.classList.remove("open"); dlg.setAttribute("aria-hidden", "true"); resolve(v); }
      ok.onclick = function () { done(true); };
      $("dlgCancel").onclick = function () { done(false); };
      dlg.onclick = function (e) { if (e.target === dlg) done(false); };
      dlg.classList.add("open"); dlg.setAttribute("aria-hidden", "false");
      setTimeout(function () { (opts.require ? input : ok).focus(); }, 60);
    });
  }

  /* ---------- Export ---------- */
  function csv(rows) {
    // Semikolon + BOM så att svensk Excel öppnar filen rätt
    return "﻿" + rows.map(function (r) {
      return r.map(function (v) {
        v = String(v == null ? "" : v);
        if (/^[=+\-@]/.test(v)) v = "'" + v;
        return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(";");
    }).join("\r\n");
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function stamp() {
    var d = new Date();
    return d.toISOString().slice(0, 10) + "_" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
  }

  $("expSummary").onclick = function () {
    if (!data) return;
    var total = data.totalVotes || 0;
    var rows = [["Placering", "Drink", "Bar", "Röster", "Andel (%)"]];
    var pos = 0, last = null;
    mergedResults().forEach(function (r, i) {
      if (r.votes !== last) { pos = i + 1; last = r.votes; }
      rows.push([pos, r.name, r.bar, r.votes, String(pct(r.votes, total)).replace(".", ",")]);
    });
    rows.push([]);
    rows.push(["Röster totalt", total]);
    rows.push(["Unika mobiler", data.uniqueDevices || 0]);
    rows.push(["Exporterad", new Date().toLocaleString("sv-SE")]);
    download("planteray-resultat_" + stamp() + ".csv", csv(rows));
  };

  $("expAll").onclick = function () {
    var btn = this; btn.disabled = true;
    API.call("export", { password: pw }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { toast(ERR[res.error] || "Exporten misslyckades."); return; }
      var rows = [["Tidpunkt", "Enhets-ID", "Drink-ID", "Drink", "Bar", "Webbläsare", "Bild-ID", "Bildlänk", "Instagram", "Visa i flöde", "Bildstatus"]].concat(res.rows.map(function (r) {
        var d = new Date(r[0]);
        var out = r.slice();
        out[0] = isNaN(d) ? r[0] : d.toLocaleString("sv-SE");
        return out;
      }));
      download("planteray-alla-roster_" + stamp() + ".csv", csv(rows));
    });
  };

  $("toggleOpen").onclick = function () {
    if (!data) return;
    var next = !data.open;
    var btn = this;
    (next ? Promise.resolve(true) : ask({ title: "Stänga röstningen?", text: "Gästerna kan inte rösta förrän du öppnar igen.", ok: "Stäng röstningen" })).then(function (yes) {
    if (!yes) return;
    btn.disabled = true;
    API.call("setOpen", { password: pw, open: next }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { toast(ERR[res.error] || "Det gick inte att ändra."); return; }
      toast(next ? "Röstningen är öppen" : "Röstningen är stängd");
      load();
    });
    });
  };

  $("resetBtn").onclick = function () {
    ask({ title: "Nollställa alla röster?", text: "Rösterna flyttas till en arkivflik i kalkylarket och räknaren börjar om från noll.", ok: "Nollställ", require: "NOLLSTÄLL" }).then(function (yes) {
      if (!yes) return;
      API.call("reset", { password: pw }).then(function (res) {
        if (!res.ok) { toast(ERR[res.error] || "Nollställningen misslyckades."); return; }
        toast("Rösterna är nollställda");
        load(); loadPhotos();
      });
    });
  };

  /* ---------- Automatisk inloggning inom samma flik ---------- */
  try { pw = sessionStorage.getItem("pr_admin_pw"); } catch (e) {}
  if (pw) load().then(function (ok) { if (ok) showAdmin(); else pw = null; });
})();
