// -------------------------------------------------------------------------------------------------
// VikTempest's UI: settings page, Netflix theme and module loader.
//
// All settings live in $storage under "vsuite:settings" and are mirrored to $store so the hooks
// (which run in their own runtime) can read them too. The modules read them through the same
// function that used to be $getUserPreference (build.py swaps the calls).
// The settings page is a webview in its own screen with an entry in Seanime's sidebar.

const VS_SETTINGS_KEY = "vsuite:settings"

// Module UI setup functions, added by the modules through vsRegister() while init() runs
const vsModules = []

function vsRegister(name, fn) {
    vsModules.push({ name: name, fn: fn })
}

// Settings shown on the page. "restart": the change is used after Seanime restarts.
const VS_FIELDS = [
    {
        section: "general", fields: [
            { key: "language", restart: true, default: "de", label: { de: "Sprache", en: "Language" },
              options: [["de", "Deutsch"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["ja", "日本語"]],
              hint: { de: "Gilt für alle Teile. Der Season Switcher kann nur Deutsch und Englisch, bei anderen Sprachen nimmt er Englisch.",
                      en: "Used by every part. Season Switcher only has German and English, other languages use English." } },
            { key: "mod_switcher", restart: true, default: "on", label: { de: "Season Switcher", en: "Season Switcher" }, onOff: true,
              hint: { de: "Staffeln zusammenfassen, Staffel-Dropdown, Folgenliste", en: "Merge seasons, season dropdown, episode list" } },
            { key: "mod_ratings", restart: true, default: "on", label: { de: "AniList Custom Ratings", en: "AniList Custom Ratings" }, onOff: true,
              hint: { de: "Bewertungskategorien und Custom Lists", en: "Rating categories and custom lists" } },
            { key: "theme", restart: false, default: "off", label: { de: "Netflix-Theme", en: "Netflix theme" }, onOff: true,
              hint: { de: "Schwarz-roter Look für PC und Handy. Wirkt sofort. Hast du das Theme schon unter Custom CSS eingefügt, kannst du es dort löschen.",
                      en: "Black and red look for PC and phone. Applies right away. If you pasted the theme into Custom CSS before, you can remove it there." } },
        ],
    },
    {
        section: "switcher", fields: [
            { key: "titleLanguage", restart: true, default: "english", label: { de: "Titel", en: "Titles" },
              options: [["english", "English"], ["romaji", "Romaji"], ["native", "Native / 日本語"]] },
            { key: "includeExtras", restart: true, default: "no", label: { de: "Filme, OVAs und Specials anzeigen", en: "Show movies, OVAs and specials" }, yesNo: true },
            { key: "mergeLibrary", restart: false, default: "yes", label: { de: "Staffeln auf der Startseite zusammenfassen", en: "Merge seasons on the home page" }, yesNo: true },
            { key: "mergeKeep", restart: false, default: "first", label: { de: "Welche Karte pro Serie", en: "Card to show per series" },
              options: [["first", { de: "Erste Staffel", en: "First season" }], ["latest", { de: "Neueste Staffel", en: "Latest season" }]] },
            { key: "infoPage", restart: true, default: "yes", label: { de: "Anime-Seiten mit Folgenliste öffnen, Stream erst beim Klick", en: "Open anime pages on the episode list, stream only on click" }, yesNo: true },
            { key: "episodeClick", restart: false, default: "yes", label: { de: "Folge anklicken startet Online-Stream", en: "Click an episode to start online streaming" }, yesNo: true },
            { key: "playMethod", restart: false, default: "onlinestream", label: { de: "Womit Folgen abgespielt werden", en: "How episodes are played" },
              options: [["onlinestream", "Online streaming"], ["debridstream", "Debrid streaming"], ["torrentstream", "Torrent streaming"]] },
        ],
    },
    {
        section: "ratings", fields: [
            { key: "step", restart: false, default: "1", label: { de: "Schrittweite der Pfeiltasten", en: "Arrow key step" },
              options: [["1", "1"], ["0.5", "0.5"], ["0.1", "0.1"]],
              hint: { de: "0,5 und 0,1 brauchen auf AniList das Scoring System „10 Point Decimal“.", en: "0.5 and 0.1 need the \"10 Point Decimal\" scoring system on AniList." } },
        ],
    },
]

function vsDefaults() {
    const d = {}
    VS_FIELDS.forEach((s) => s.fields.forEach((f) => { d[f.key] = f.default }))
    return d
}

function vsLoadSettings() {
    let saved = null
    try { saved = $storage.get(VS_SETTINGS_KEY) } catch (e) {}
    const s = vsDefaults()
    if (saved && typeof saved === "object") {
        Object.keys(saved).forEach((k) => {
            if (saved[k] !== undefined && saved[k] !== null && saved[k] !== "") s[k] = String(saved[k])
        })
    }
    return s
}

function vsSaveSettings(s) {
    try { $storage.set(VS_SETTINGS_KEY, s) } catch (e) { console.error("viktempest-ui: could not save settings", e) }
    try { $store.set(VS_SETTINGS_KEY, s) } catch (e) {}
}

const VS_PAGE_TEXT = {
    de: {
        title: "VikTempest's UI",
        intro: "Alle Einstellungen für Season Switcher, AniList Custom Ratings und das Netflix-Theme.",
        general: "Allgemein", switcher: "Season Switcher", ratings: "AniList Custom Ratings",
        on: "An", off: "Aus", yes: "Ja", no: "Nein",
        save: "Speichern", saved: "Gespeichert.",
        restart: "Starte Seanime neu, damit alle Änderungen übernommen werden.",
        restartMark: "nach Neustart",
        disabled: "Dieser Teil ist ausgeschaltet.",
    },
    en: {
        title: "VikTempest's UI",
        intro: "All settings for Season Switcher, AniList Custom Ratings and the Netflix theme.",
        general: "General", switcher: "Season Switcher", ratings: "AniList Custom Ratings",
        on: "On", off: "Off", yes: "Yes", no: "No",
        save: "Save", saved: "Saved.",
        restart: "Restart Seanime so every change is applied.",
        restartMark: "after restart",
        disabled: "This part is turned off.",
    },
}

// Page HTML. It renders the fields it gets from the plugin and sends the values back on save.
const VS_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 48px; background: transparent; color: #e5e5e5;
         font: 15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 1.7rem; margin: 0 0 4px; color: #fff; }
  .intro { color: #a3a3a3; margin: 0 0 24px; }
  .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px;
          padding: 6px 18px; margin-bottom: 18px; }
  .card.off { opacity: .55; }
  h2 { font-size: 1.05rem; margin: 14px 0 6px; color: #fff; }
  .note { color: #a3a3a3; font-size: .85rem; margin: 0 0 8px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0;
         border-top: 1px solid rgba(255,255,255,.06); }
  .row:first-of-type { border-top: 0; }
  .lbl { flex: 1; min-width: 0; }
  .lbl b { font-weight: 500; color: #f5f5f5; }
  .lbl small { display: block; color: #8f8f8f; margin-top: 2px; }
  .tag { font-size: .7rem; color: #a3a3a3; border: 1px solid rgba(255,255,255,.15); border-radius: 99px;
         padding: 0 6px; margin-left: 6px; white-space: nowrap; }
  select { background: #1c1c1c; color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
           padding: 8px 10px; font-size: 16px; min-width: 150px; max-width: 45vw; }
  .seg { display: inline-flex; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .seg button { background: transparent; color: #cfcfcf; border: 0; padding: 8px 14px; font-size: 14px; cursor: pointer;
                touch-action: manipulation; }
  .seg button.sel { background: var(--accent, #6152df); color: #fff; }
  .bar { display: flex; align-items: center; gap: 14px; padding: 14px 0; }
  .save { background: var(--accent, #6152df); color: #fff; border: 0; border-radius: 10px; padding: 11px 26px;
          font-size: 15px; font-weight: 600; cursor: pointer; }
  .save:disabled { opacity: .5; cursor: default; }
  .msg { color: #a3a3a3; font-size: .9rem; }
  @media (max-width: 600px) {
    .row { flex-direction: column; align-items: stretch; gap: 8px; }
    select { max-width: none; width: 100%; }
    .seg { align-self: flex-start; }
  }
</style>
</head>
<body>
<div class="wrap" id="app"><p class="intro">…</p></div>
<script>
(function () {
  var fields = [], values = {}, text = {}, lang = "de", saved = {}, accent = "";
  function L(v) { return v && typeof v === "object" ? (v[lang] || v.en || "") : String(v == null ? "" : v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dirty() { return Object.keys(values).some(function (k) { return values[k] !== saved[k]; }); }
  function render(msg) {
    var app = document.getElementById("app");
    if (accent) document.documentElement.style.setProperty("--accent", accent);
    var h = "<h1>" + esc(text.title) + "</h1><p class='intro'>" + esc(text.intro) + "</p>";
    fields.forEach(function (sec) {
      var off = (sec.section === "switcher" && values.mod_switcher === "off") || (sec.section === "ratings" && values.mod_ratings === "off");
      h += "<div class='card" + (off ? " off" : "") + "'><h2>" + esc(text[sec.section]) + "</h2>";
      if (off) h += "<p class='note'>" + esc(text.disabled) + "</p>";
      sec.fields.forEach(function (f) {
        h += "<div class='row'><div class='lbl'><b>" + esc(L(f.label)) + "</b>" +
          (f.restart ? "<span class='tag'>" + esc(text.restartMark) + "</span>" : "") +
          (f.hint ? "<small>" + esc(L(f.hint)) + "</small>" : "") + "</div>";
        var opts = f.options;
        if (f.onOff) opts = [["on", text.on], ["off", text.off]];
        if (f.yesNo) opts = [["yes", text.yes], ["no", text.no]];
        if (opts.length <= 3 && (f.onOff || f.yesNo)) {
          h += "<div class='seg'>" + opts.map(function (o) {
            return "<button data-k='" + f.key + "' data-v='" + esc(o[0]) + "' class='" + (values[f.key] === o[0] ? "sel" : "") + "'>" + esc(L(o[1])) + "</button>";
          }).join("") + "</div>";
        } else {
          h += "<select data-k='" + f.key + "'>" + opts.map(function (o) {
            return "<option value='" + esc(o[0]) + "'" + (values[f.key] === o[0] ? " selected" : "") + ">" + esc(L(o[1])) + "</option>";
          }).join("") + "</select>";
        }
        h += "</div>";
      });
      h += "</div>";
    });
    h += "<div class='bar'><button class='save' id='save'" + (dirty() ? "" : " disabled") + ">" + esc(text.save) + "</button>" +
      "<span class='msg'>" + esc(msg || "") + "</span></div>";
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll(".seg button"), function (b) {
      b.addEventListener("click", function () { values[b.getAttribute("data-k")] = b.getAttribute("data-v"); render(); });
    });
    Array.prototype.forEach.call(app.querySelectorAll("select"), function (s) {
      s.addEventListener("change", function () { values[s.getAttribute("data-k")] = s.value; render(); });
    });
    document.getElementById("save").addEventListener("click", function () {
      var needRestart = false;
      fields.forEach(function (sec) { sec.fields.forEach(function (f) { if (f.restart && values[f.key] !== saved[f.key]) needRestart = true; }); });
      window.webview.send("save", values);
      saved = JSON.parse(JSON.stringify(values));
      render(text.saved + (needRestart ? " " + text.restart : ""));
    });
  }
  function start() {
    if (!window.webview) { setTimeout(start, 100); return; }
    window.webview.on("init", function (data) {
      fields = data.fields; text = data.text; lang = data.lang; accent = data.accent || "";
      values = JSON.parse(JSON.stringify(data.values)); saved = JSON.parse(JSON.stringify(data.values));
      render();
    });
    window.webview.send("ready", {});
  }
  start();
})();
</script>
</body>
</html>`

const VS_SIDEBAR_ICON = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'/><circle cx='12' cy='12' r='3'/></svg>"

// Sets up the settings page and the theme, then the modules that are turned on
function vsSetupUI(ctx) {
    const settings = vsLoadSettings()
    vsSaveSettings(settings)

    const pageLang = settings.language === "de" ? "de" : "en"

    // --- Netflix theme (applies right away when switched on or off)
    function applyTheme(on) {
        ctx.dom.queryOne("[data-vsuite-theme]").then((existing) => {
            if (!on) {
                if (existing) existing.remove()
                return
            }
            if (existing) return
            return Promise.all([ctx.dom.createElement("style"), ctx.dom.queryOne("body")]).then((res) => {
                const style = res[0]
                const parent = res[1]
                if (!style || !parent) return
                style.setAttribute("data-vsuite-theme", "1")
                style.setText(VS_THEME_CSS)
                parent.append(style)
            })
        }).catch((e) => console.warn("viktempest-ui: theme", e))
    }
    // The style element is lost when the page reloads, so it is added again when a tab is ready.
    // (onNavigate and onReady are left to the modules.)
    ctx.dom.onMainTabReady(() => {
        if (vsLoadSettings().theme === "on") applyTheme(true)
    })
    if (settings.theme === "on") applyTheme(true)

    // --- Settings page in the sidebar
    const page = ctx.newWebview({
        slot: "screen",
        fullWidth: true,
        autoHeight: true,
        sidebar: { label: "VikTempest's UI", icon: VS_SIDEBAR_ICON },
    })
    page.setContent(() => VS_PAGE_HTML)

    page.channel.on("ready", () => {
        const current = vsLoadSettings()
        page.channel.send("init", {
            fields: VS_FIELDS,
            values: current,
            lang: pageLang,
            text: VS_PAGE_TEXT[pageLang],
            accent: current.theme === "on" ? "#E50914" : "",
        })
    })

    page.channel.on("save", (values) => {
        const next = vsDefaults()
        const before = vsLoadSettings()
        Object.keys(next).forEach((k) => {
            if (values && values[k] !== undefined && values[k] !== null) next[k] = String(values[k])
        })
        vsSaveSettings(next)
        if (next.theme !== before.theme) applyTheme(next.theme === "on")
    })

    // --- Modules
    vsModules.forEach((m) => {
        if (settings["mod_" + m.name] === "off") return
        try {
            m.fn(ctx)
        }
        catch (e) {
            console.error("viktempest-ui: " + m.name + " failed to start", e)
        }
    })
}
