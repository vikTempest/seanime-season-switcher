// -------------------------------------------------------------------------------------------------
// VikTempest Seanime UI: settings page, theme with colour schemes and module loader.
//
// All settings live in $storage under "vsuite:settings" and are mirrored to $store so the hooks
// (which run in their own runtime) can read them too. The modules read them through the same
// function that used to be $getUserPreference (build.py swaps the calls), so they always see the
// current value: everything that is read when it is used works right away, without a restart.
// The settings page is a webview in its own screen with an entry in Seanime's sidebar.
// VS_VERSION and VS_THEME_CSS are added in front of this file by build.py.

const VS_SETTINGS_KEY = "vsuite:settings"
const VS_THEME_ASKED_KEY = "vsuite:themeAsked"
const VS_HEALTH_KEY = "vsuite:health"

// Module UI setup functions, added by the modules through vsRegister() while init() runs
const vsModules = []

function vsRegister(name, fn) {
    vsModules.push({ name: name, fn: fn })
}

// The tray icon (top bar) is the way into the settings: Seanime only shows the sidebar entry
// after the sidebar is loaded again, so after installing it is missing until a reload.
// A plugin has one tray, so a module that wants its own tray content asks for it here.
let vsTrayState = { ctx: null, tray: null, header: null }

// Shared between the parts: extra tray sections, the rating window, whether the colour picker is
// open, and who wants your list with relations when it was loaded (once a day)
const vsShare = { traySections: [], rate: null, pickerOpen: false, onWarm: [] }

// The AniList cache and request limit every part uses (suite/anilist.js, put in by build.py)
const vsAni = $vsAniLib()

// Once a day your whole list with relations in one request. It fills the cache for the season
// switcher and is used for the new-seasons notice, so neither needs requests of its own.
function vsWarm(ctx) {
    let col = null
    try { col = vsAni.warm(false) }
    catch (e) {
        console.warn("viktempest-ui: could not load your list with relations", e)
        return
    }
    if (!col) return
    vsShare.onWarm.forEach((fn) => {
        try { fn(col) } catch (e) { console.warn("viktempest-ui: after loading the list", e) }
    })
}

function vsOpenSettings() {
    try { vsTrayState.ctx.screen.navigateTo("/webview", { id: VS_EXT_ID }) }
    catch (e) { console.warn("viktempest-ui: could not open settings", e) }
}

// Returns the shared tray. Its content starts with the title and an "open settings" button.
function vsTray(opts) {
    const ctx = vsTrayState.ctx
    if (!vsTrayState.tray) {
        vsTrayState.tray = ctx.newTray(Object.assign({
            iconUrl: VS_TRAY_ICON,
            tooltipText: "VikTempest Seanime UI",
            withContent: true,
            width: "24rem",
        }, opts || {}))
    }
    return vsTrayState.tray
}

// The tray is drawn often: its render function only builds components, everything else
// (language, click handlers) is prepared once here.
function vsTrayHeader(tray) {
    if (!vsTrayState.header) {
        const lang = vsLoadSettings().language === "de" ? "de" : "en"
        vsTrayState.header = {
            label: VS_PAGE_TEXT[lang].openSettings,
            onClick: vsTrayState.ctx.eventHandler("vs-open-settings", () => vsOpenSettings()),
        }
    }
    const h = vsTrayState.header
    return [
        tray.text("VikTempest Seanime UI", { className: "font-semibold text-lg" }),
        tray.button(h.label, { intent: "primary", size: "sm", onClick: h.onClick }),
    ].concat(vsTraySections(tray))
}

function vsTraySections(tray) {
    let out = []
    vsShare.traySections.forEach((fn) => {
        try { out = out.concat(fn(tray) || []) } catch (e) { console.warn("viktempest-ui: tray section", e) }
    })
    return out
}

// Modules call this when they find a part of Seanime's page they work with, so the settings page
// can show whether everything still works after a Seanime update.
function vsHealth(name) {
    try {
        const h = $store.get(VS_HEALTH_KEY) || {}
        if (h[name] && Date.now() - h[name] < 60000) return
        h[name] = Date.now()
        $store.set(VS_HEALTH_KEY, h)
    }
    catch (e) {}
}

// -------------------------------------------------------------------------------------------------
// Colour schemes

const VS_SCHEMES = {
    red: { accent: "#e50914", bg: "#0f0f0f" },
    purple: { accent: "#8b5cf6", bg: "#111016" },
    blue: { accent: "#3b9eff", bg: "#0a111d" },
}

function vsHexRgb(hex) {
    let h = String(hex || "").trim().replace("#", "")
    if (h.length === 3) h = h.split("").map((c) => c + c).join("")
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function vsMix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

// The two colours of the chosen scheme, or null when the theme is off
function vsSchemeColors(s) {
    if (!s || !s.theme || s.theme === "off") return null
    if (s.theme === "custom") {
        return {
            accent: vsHexRgb(s.themeAccent) || vsHexRgb(VS_SCHEMES.red.accent),
            bg: vsHexRgb(s.themeBg) || vsHexRgb(VS_SCHEMES.red.bg),
        }
    }
    const sc = VS_SCHEMES[s.theme] || VS_SCHEMES.red
    return { accent: vsHexRgb(sc.accent), bg: vsHexRgb(sc.bg) }
}

// Seanime's colour variables for a scheme. The rest of the theme (VS_THEME_CSS) only uses these.
function vsPaletteCss(colors) {
    const a = colors.accent, bg = colors.bg
    const W = [255, 255, 255], B = [0, 0, 0]
    const sp = (c) => c.join(" ")
    const rgb = (c) => "rgb(" + c.join(",") + ")"
    const scale = [
        ["50", vsMix(a, W, .92)], ["100", vsMix(a, W, .84)], ["200", vsMix(a, W, .66)], ["300", vsMix(a, W, .4)],
        ["400", vsMix(a, W, .2)], ["500", a], ["600", vsMix(a, B, .13)], ["700", vsMix(a, B, .28)],
        ["800", vsMix(a, B, .44)], ["900", vsMix(a, B, .6)], ["950", vsMix(a, B, .76)],
    ]
    const paper = vsMix(bg, W, .035)
    return ":root, .dark, [data-mode=dark] {\n" +
        scale.map((s) => "  --color-brand-" + s[0] + ": " + sp(s[1]) + " !important;").join("\n") + "\n" +
        "  --background: " + rgb(bg) + " !important;\n" +
        "  --paper: " + rgb(paper) + " !important;\n" +
        "  --paper-lighter: " + rgb(vsMix(bg, W, .063)) + " !important;\n" +
        "  --media-card-popup-background: " + rgb(paper) + " !important;\n" +
        "  --hover-from-background-color: " + rgb(vsMix(bg, W, .09)) + " !important;\n" +
        "  --border: rgba(255,255,255,.08) !important;\n" +
        "  --muted: rgba(255,255,255,.55) !important;\n" +
        "  --muted-highlight: rgba(255,255,255,.75) !important;\n" +
        "  --subtle: rgba(255,255,255,.05) !important;\n" +
        "  --subtle-highlight: rgba(255,255,255,.09) !important;\n" +
        "  --ring: " + rgb(a) + " !important;\n" +
        "  --nf-red: " + rgb(a) + ";\n" +
        "  --nf-ease: cubic-bezier(.2,.8,.2,1);\n" +
        "  --vs-accent-rgb: " + sp(a) + ";\n" +
        "  --vs-bg-rgb: " + sp(bg) + ";\n" +
        "}\n" +
        "@media (min-width: 1024px) { :root, .dark, [data-mode=dark] { --radius: .375rem; --radius-md: .375rem; } }\n"
}

function vsAccentHex(s) {
    const c = vsSchemeColors(s)
    if (!c) return ""
    return "#" + c.accent.map((v) => (v < 16 ? "0" : "") + v.toString(16)).join("")
}

// -------------------------------------------------------------------------------------------------
// Settings

// Settings shown on the page.
//   restart: the change is used after Seanime restarts
//   live:    saved and applied as soon as it is changed (no Save button needed)
//   showIf:  only shown when another setting has this value
const VS_FIELDS = [
    {
        section: "general", fields: [
            { key: "language", restart: true, default: "de", label: { de: "Sprache", en: "Language" },
              options: [["de", "Deutsch"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["ja", "日本語"]],
              hint: { de: "Gilt für alle Teile.", en: "Used by every part." } },
            { key: "mod_switcher", restart: true, default: "on", label: { de: "Season Switcher", en: "Season Switcher" }, onOff: true,
              hint: { de: "Staffeln zusammenfassen, Staffel-Dropdown, Folgenliste", en: "Merge seasons, season dropdown, episode list" } },
            { key: "mod_ratings", restart: true, default: "on", label: { de: "AniList Custom Ratings", en: "AniList Custom Ratings" }, onOff: true,
              hint: { de: "Bewertungskategorien und Custom Lists", en: "Rating categories and custom lists" } },
            { key: "mod_extras", restart: true, default: "on", label: { de: "Extras", en: "Extras" }, onOff: true,
              hint: { de: "Bildschirmschoner, Schlaftimer, neue Staffeln, Filler, Schnellsuche", en: "Screensaver, sleep timer, new seasons, filler, quick search" } },
        ],
    },
    {
        section: "theme", fields: [
            { key: "theme", live: true, default: "off", label: { de: "Farbschema", en: "Colour scheme" }, seg: true,
              options: [["off", { de: "Aus", en: "Off" }], ["red", { de: "Rot", en: "Red" }], ["purple", { de: "Lila", en: "Purple" }],
                        ["blue", { de: "Blau", en: "Blue" }], ["custom", { de: "Eigene", en: "Custom" }]],
              hint: { de: "Wirkt sofort. Hast du das Theme früher unter Custom CSS eingefügt, lösch es dort.",
                      en: "Applies right away. If you pasted the theme into Custom CSS before, remove it there." } },
            { key: "themeAccent", live: true, default: "#e50914", color: true, showIf: ["theme", "custom"],
              label: { de: "Akzentfarbe", en: "Accent colour" }, hint: { de: "Knöpfe, Fortschritt, Markierungen", en: "Buttons, progress, highlights" } },
            { key: "themeBg", live: true, default: "#0f0f0f", color: true, showIf: ["theme", "custom"],
              label: { de: "Hintergrund", en: "Background" }, hint: { de: "Am besten eine sehr dunkle Farbe", en: "A very dark colour works best" } },
        ],
    },
    {
        section: "layout", fields: [
            { key: "sidebarAutoHide", live: true, default: "no", yesNo: true,
              label: { de: "Seitenleiste einfahren", en: "Slide the sidebar away" },
              hint: { de: "Die Leiste links verschwindet bis auf einen schmalen Rand und fährt heraus, wenn die Maus an den Rand kommt. Mehr Platz für Bilder und Folgen.",
                      en: "The bar on the left hides except for a thin edge and slides out when the mouse reaches the edge. More room for covers and episodes." } },
            { key: "sidebarHide", live: true, default: "", multi: true,
              label: { de: "Einträge in der Seitenleiste ausblenden", en: "Hide sidebar entries" },
              options: [["schedule", { de: "Zeitplan", en: "Schedule" }], ["manga", "Manga"], ["lists", { de: "Listen", en: "Lists" }],
                        ["discover", "Discover"], ["search", { de: "Suche", en: "Search" }], ["torrent-list", { de: "Torrent-Liste", en: "Torrent list" }],
                        ["debrid", "Debrid"], ["scan-summaries", { de: "Scan-Berichte", en: "Scan summaries" }], ["auto-downloader", "Auto Downloader"]],
              hint: { de: "Angeklickte Einträge werden ausgeblendet. Die Suche gibt es auch oben und mit Strg+K, du kannst sie also ausblenden und nur Discover behalten.",
                      en: "Selected entries are hidden. Search is also at the top and on Ctrl+K, so you can hide it and keep only Discover." } },
        ],
    },
    {
        section: "switcher", fields: [
            { key: "titleLanguage", default: "english", label: { de: "Titel", en: "Titles" },
              options: [["english", "English"], ["romaji", "Romaji"], ["native", "Native / 日本語"]] },
            { key: "includeExtras", default: "no", label: { de: "Filme, OVAs und Specials im Dropdown", en: "Movies, OVAs and specials in the dropdown" }, yesNo: true },
            { key: "showProgress", default: "yes", label: { de: "Fortschritt im Staffel-Dropdown", en: "Progress in the season dropdown" }, yesNo: true,
              hint: { de: "z. B. „✓“ für fertig oder „5/12“", en: "e.g. \"✓\" when finished or \"5/12\"" } },
            { key: "mergeLibrary", default: "yes", label: { de: "Staffeln auf der Startseite zusammenfassen", en: "Merge seasons on the home page" }, yesNo: true },
            { key: "mergeKeep", default: "first", label: { de: "Welche Karte pro Serie", en: "Card to show per series" },
              options: [["first", { de: "Erste Staffel", en: "First season" }], ["latest", { de: "Neueste Staffel", en: "Latest season" }]] },
            { key: "seasonBadge", default: "yes", label: { de: "Abzeichen „X Staffeln“ auf der Startseite", en: "\"X seasons\" badge on the home page" }, yesNo: true },
            { key: "infoPage", restart: true, default: "yes", label: { de: "Anime-Seiten mit Folgenliste öffnen, Stream erst beim Klick", en: "Open anime pages on the episode list, stream only on click" }, yesNo: true,
              hint: { de: "„Nein“ lässt Seanime so, wie es ohne Optimierung ist.", en: "\"No\" leaves Seanime as it is without the optimisation." } },
            { key: "episodeClick", default: "yes", label: { de: "Folge anklicken startet Online-Stream", en: "Click an episode to start online streaming" }, yesNo: true },
        ],
    },
    {
        section: "ratings", fields: [
            { key: "step", default: "1", label: { de: "Schrittweite der Pfeiltasten", en: "Arrow key step" },
              options: [["1", "1"], ["0.5", "0.5"], ["0.1", "0.1"]],
              hint: { de: "0,5 und 0,1 brauchen auf AniList das Scoring System „10 Point Decimal“.", en: "0.5 and 0.1 need the \"10 Point Decimal\" scoring system on AniList." } },
        ],
    },
    {
        section: "extras", fields: [
            { key: "screensaver", default: "yes", label: { de: "Bildschirmschoner", en: "Screensaver" }, yesNo: true,
              hint: { de: "Zeigt die Anime aus dem großen Banner der Startseite, wenn du eine Weile nichts machst. Nie während ein Video läuft.",
                      en: "Shows the anime of the big home page banner when you're away for a while. Never while a video plays." } },
            { key: "screensaverMinutes", default: "5", label: { de: "Bildschirmschoner nach", en: "Screensaver after" }, showIf: ["screensaver", "yes"],
              options: [["1", "1 min"], ["3", "3 min"], ["5", "5 min"], ["10", "10 min"], ["15", "15 min"], ["30", "30 min"]] },
            { key: "newSeasons", default: "yes", label: { de: "Hinweis auf neue Staffeln", en: "Notice about new seasons" }, yesNo: true,
              hint: { de: "Einmal am Tag: Fortsetzungen von Anime auf deiner Liste, die noch nicht auf der Liste sind. Steht auch im Symbol oben.",
                      en: "Once a day: sequels of anime on your list that aren't on it yet. Also shown in the icon at the top." } },
            { key: "filler", default: "normal", label: { de: "Filler-Folgen", en: "Filler episodes" },
              options: [["normal", { de: "Normal", en: "Normal" }], ["dim", { de: "Abdunkeln", en: "Dim" }], ["hide", { de: "Ausblenden", en: "Hide" }]],
              hint: { de: "Folgen, die Seanime als Filler kennt.", en: "Episodes Seanime knows as filler." } },
            { key: "rateAfter", default: "yes", label: { de: "Nach der letzten Folge einer Staffel zum Bewerten fragen", en: "Ask for a rating after the last episode of a season" }, yesNo: true,
              hint: { de: "Öffnet das Bewertungsfenster von AniList Custom Ratings, wenn der Player nach der letzten Folge stoppt.", en: "Opens the AniList Custom Ratings window when the player stops after the last episode." } },
            { key: "nextSeason", default: "yes", label: { de: "Nach der letzten Folge zur nächsten Staffel", en: "Go to the next season after the last episode" }, yesNo: true,
              hint: { de: "Öffnet die Folgenliste der Fortsetzung, sobald der Player stoppt. Ist sie noch nicht erschienen, sagt dir ein Hinweis, wann sie startet.",
                      en: "Opens the episode list of the sequel as soon as the player stops. If it isn't out yet, a notice tells you when it starts." } },
            { key: "continueWatching", default: "yes", label: { de: "Weiterschauen mit einem Klick", en: "Continue watching in one click" }, yesNo: true,
              hint: { de: "Im Symbol oben und in der Schnellsuche: deine zuletzt geschauten Anime, ein Klick startet die nächste Folge.",
                      en: "In the icon at the top and in quick search: the anime you watched last, one click starts the next episode." } },
            { key: "episodeMenu", restart: true, default: "yes", label: { de: "Rechtsklick-Menü auf Folgen", en: "Right-click menu on episodes" }, yesNo: true,
              hint: { de: "„Bis hier als gesehen markieren“ und „Online-Stream starten“", en: "\"Mark watched up to here\" and \"Start online stream\"" } },
            { key: "quickSearch", restart: true, default: "yes", label: { de: "Schnellsuche mit Strg+K", en: "Quick search with Ctrl+K" }, yesNo: true,
              hint: { de: "Deine Liste und Aktionen wie Schlaftimer. Auch über das Symbol oben.", en: "Your list and actions like the sleep timer. Also from the icon at the top." } },
        ],
    },
]

// What changed in this version, shown at the bottom of the settings page
const VS_CHANGES = {
    de: [
        "Farbschemas: Rot, Lila, Blau oder eigene Farben, Auswahl beim ersten Start",
        "Die meisten Einstellungen wirken sofort, ohne Neustart",
        "Staffel-Dropdown zeigt deinen Fortschritt, Startseite zeigt „X Staffeln“",
        "Season Switcher spricht jetzt alle 5 Sprachen",
        "Status-Bereich zeigt, ob nach einem Seanime-Update noch alles gefunden wird",
        "1.1.1: Farbwahl als kleines Fenster mit ×, Seanime bleibt dabei bedienbar; AniList-Anfragen in kleinen Portionen, damit nichts hängt",
        "1.1.2: Das Symbol oben (Tray) hat jetzt den Knopf „Einstellungen öffnen“; „Aktualisieren“ meldet sich, wenn es fertig ist",
        "1.2.0: Extras: Bildschirmschoner, Schlaftimer und Schnellsuche (Strg+K), Hinweis auf neue Staffeln, Filler abdunkeln oder ausblenden, Rechtsklick auf Folgen, Bewerten nach der letzten Folge",
        "1.2.1: Seanime hängt nicht mehr nach der Installation (Bildschirmschoner-Erkennung), Absturz beim Symbol oben behoben",
        "1.3.0: Nach der letzten Folge direkt zur nächsten Staffel, Weiterschauen mit einem Klick, Seitenleiste einfahren und Einträge ausblenden, Einstellungen sichern und laden, stabiler",
        "1.4.0: Viel weniger AniList-Anfragen: Staffeldaten werden gespeichert (auch nach einem Neustart), deine Liste kommt einmal am Tag in einer Anfrage, alle Teile teilen sich ein Limit pro Minute und warten nach „zu viele Anfragen“ gemeinsam",
    ],
    en: [
        "Colour schemes: red, purple, blue or your own colours, picked on first start",
        "Most settings apply right away, without a restart",
        "Season dropdown shows your progress, home page shows \"X seasons\"",
        "Season Switcher now speaks all 5 languages",
        "Status section shows whether everything is still found after a Seanime update",
        "1.1.1: colour picker is a small window with ×, Seanime stays usable; AniList requests in small batches so nothing hangs",
        "1.1.2: The tray icon at the top now has an \"Open settings\" button; \"Refresh\" tells you when it is done",
        "1.2.0: Extras: screensaver, sleep timer and quick search (Ctrl+K), notice about new seasons, dim or hide filler, right-click on episodes, rating after the last episode",
        "1.2.1: Seanime no longer hangs after installing (screensaver activity check), fixed a crash in the tray icon",
        "1.3.0: Straight to the next season after the last episode, continue watching in one click, slide-away sidebar and hidden entries, back up and load settings, more stable",
        "1.4.0: Far fewer AniList requests: season data is saved (also across restarts), your list comes once a day in one request, all parts share a per-minute limit and wait together after \"too many requests\"",
    ],
}

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
    // Version 1.0 only had the theme on or off
    if (s.theme === "on") s.theme = "red"
    // Online streaming only since 1.1
    delete s.playMethod
    return s
}

function vsSaveSettings(s) {
    try { $storage.set(VS_SETTINGS_KEY, s) } catch (e) { console.error("viktempest-ui: could not save settings", e) }
    try { $store.set(VS_SETTINGS_KEY, s) } catch (e) {}
}

// Reads a text made by "Export". Only known settings with allowed values are taken.
function vsImportSettings(text) {
    let data
    try { data = JSON.parse(String(text || "").trim()) } catch (e) { return null }
    const src = data && typeof data === "object" ? (data.settings && typeof data.settings === "object" ? data.settings : data) : null
    if (!src) return null
    const next = vsDefaults()
    let found = 0
    VS_FIELDS.forEach((sec) => sec.fields.forEach((f) => {
        const v = src[f.key]
        if (v === undefined || v === null) return
        const str = String(v)
        if (f.onOff && str !== "on" && str !== "off") return
        if (f.yesNo && str !== "yes" && str !== "no") return
        if (f.color && !vsHexRgb(str)) return
        if (f.options && !f.multi && !f.options.some((o) => o[0] === str)) return
        if (f.multi) {
            const ok = f.options.map((o) => o[0])
            next[f.key] = str.split(",").filter((x) => ok.indexOf(x) >= 0).join(",")
        }
        else next[f.key] = str
        found++
    }))
    return found ? next : null
}

// Sidebar CSS for the layout settings ("" when nothing is changed)
const VS_SIDEBAR_IDS = ["schedule", "manga", "lists", "discover", "search", "torrent-list", "debrid", "scan-summaries", "auto-downloader"]
function vsLayoutCss(s) {
    let css = ""
    const hide = String((s && s.sidebarHide) || "").split(",").filter((x) => VS_SIDEBAR_IDS.indexOf(x) >= 0)
    if (hide.length) {
        css += hide.map((id) => ":is(a, button):has([data-vertical-menu-item-id=\"" + id + "\"]), [data-vertical-menu-item-id=\"" + id + "\"]").join(",\n") +
            " { display: none !important; }\n"
    }
    if (s && s.sidebarAutoHide === "yes") {
        css += "@media (min-width: 1024px) {\n" +
            "  .UI-AppLayoutSidebar__root { transform: translateX(calc(-100% + 8px)); transition: transform .22s cubic-bezier(.2,.8,.2,1) .15s; }\n" +
            "  .UI-AppLayoutSidebar__root:hover, .UI-AppLayoutSidebar__root:focus-within { transform: none; transition-delay: 0s; }\n" +
            "  .UI-AppLayout__root.with-sidebar > .appLayout { padding-left: 8px !important; transition: padding .22s; }\n" +
            "}\n"
    }
    return css
}

// Puts css into one <style> element marked with attr (removes it when css is empty)
function vsSetStyle(ctx, attr, css) {
    return ctx.dom.queryOne("[" + attr + "]").then((existing) => {
        if (existing) {
            if (css) existing.setText(css)
            else existing.remove()
            return
        }
        if (!css) return
        return Promise.all([ctx.dom.createElement("style"), ctx.dom.queryOne("body")]).then((res) => {
            if (!res[0] || !res[1]) return
            res[0].setAttribute(attr, "1")
            res[0].setText(css)
            res[1].append(res[0])
        })
    }).catch((e) => console.warn("viktempest-ui: style " + attr, e))
}

const VS_PAGE_TEXT = {
    de: {
        title: "VikTempest Seanime UI",
        intro: "Alle Einstellungen für Season Switcher, AniList Custom Ratings und das Theme.",
        general: "Allgemein", theme: "Theme", switcher: "Season Switcher", ratings: "AniList Custom Ratings", extras: "Extras",
        layout: "Seitenleiste", backup: "Sichern und laden",
        backupHint: "„Exportieren“ schreibt alle Einstellungen als Text in das Feld (und in die Zwischenablage). Heb ihn auf, z. B. vor dem Neuinstallieren: Seanime löscht beim Deinstallieren alle Einstellungen. Zum Laden den Text einfügen und „Importieren“ drücken.",
        exportBtn: "Exportieren", importBtn: "Importieren", exported: "Exportiert. Den Text jetzt kopieren und aufheben.",
        imported: "Importiert.", importFailed: "Das ist kein gültiger Einstellungs-Text.",
        skipHint: "Opening und Ending überspringen kann Seanime schon selbst: im Player unter Einstellungen „Auto Skip OP/ED“ (nutzt AniSkip).",
        status: "Status", news: "Neu in dieser Version",
        on: "An", off: "Aus", yes: "Ja", no: "Nein",
        save: "Speichern", saved: "Gespeichert.", reset: "Auf Standard zurücksetzen",
        resetAsk: "Alle Einstellungen auf Standard zurücksetzen? Zum Bestätigen noch einmal klicken.", resetConfirm: "Ja, zurücksetzen", resetDone: "Zurückgesetzt.",
        restart: "Starte Seanime neu, damit alle Änderungen übernommen werden.",
        restartMark: "nach Neustart",
        disabled: "Dieser Teil ist ausgeschaltet.",
        version: "Version {0}",
        statusHint: "Zeigt, ob die Erweiterung die Teile von Seanime findet, mit denen sie arbeitet. Steht hier nach einem Seanime-Update „noch nicht gesehen“, obwohl du die Seite geöffnet hast, hat das Update etwas verändert.",
        seen: "✓ gefunden ({0})", notSeen: "noch nicht gesehen", justNow: "gerade eben", minutesAgo: "vor {0} min", hoursAgo: "vor {0} h",
        health: {
            cards: "Karten auf der Startseite",
            title: "Titel der Anime-Seite (Staffel-Dropdown)",
            episodes: "Folgenliste",
            stream: "Stream-Ansicht",
        },
        openSettings: "Einstellungen öffnen",
        oldSwitcher: "Die alte einzelne Erweiterung „Season Switcher“ scheint noch installiert zu sein. Deinstalliere sie unter Extensions, sonst läuft alles doppelt.",
    },
    en: {
        title: "VikTempest Seanime UI",
        intro: "All settings for Season Switcher, AniList Custom Ratings and the theme.",
        general: "General", theme: "Theme", switcher: "Season Switcher", ratings: "AniList Custom Ratings", extras: "Extras",
        layout: "Sidebar", backup: "Back up and load",
        backupHint: "\"Export\" writes all settings as text into the box (and to the clipboard). Keep it, e.g. before reinstalling: Seanime deletes all settings when you uninstall. To load them, paste the text and press \"Import\".",
        exportBtn: "Export", importBtn: "Import", exported: "Exported. Copy the text now and keep it.",
        imported: "Imported.", importFailed: "That isn't a valid settings text.",
        skipHint: "Seanime can already skip openings and endings itself: in the player settings, \"Auto skip OP/ED\" (uses AniSkip).",
        status: "Status", news: "New in this version",
        on: "On", off: "Off", yes: "Yes", no: "No",
        save: "Save", saved: "Saved.", reset: "Reset to defaults",
        resetAsk: "Reset all settings to their defaults? Click again to confirm.", resetConfirm: "Yes, reset", resetDone: "Reset.",
        restart: "Restart Seanime so every change is applied.",
        restartMark: "after restart",
        disabled: "This part is turned off.",
        version: "Version {0}",
        statusHint: "Shows whether the extension finds the parts of Seanime it works with. If something says \"not seen yet\" after a Seanime update although you opened that page, the update changed something.",
        seen: "✓ found ({0})", notSeen: "not seen yet", justNow: "just now", minutesAgo: "{0} min ago", hoursAgo: "{0} h ago",
        health: {
            cards: "Cards on the home page",
            title: "Anime page title (season dropdown)",
            episodes: "Episode list",
            stream: "Stream view",
        },
        openSettings: "Open settings",
        oldSwitcher: "The old separate \"Season Switcher\" extension still seems to be installed. Uninstall it under Extensions, otherwise everything runs twice.",
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
  .ver { color: #8f8f8f; font-size: .85rem; font-weight: 500; margin-left: 8px; }
  .intro { color: #a3a3a3; margin: 0 0 24px; }
  .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px;
          padding: 6px 18px; margin-bottom: 18px; }
  .card.off { opacity: .55; }
  .warn { background: rgba(229,9,20,.12); border: 1px solid rgba(229,9,20,.5); border-radius: 12px; padding: 12px 16px;
          margin-bottom: 18px; color: #fff; }
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
  input[type=color] { width: 56px; height: 36px; padding: 2px; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
                      background: #1c1c1c; cursor: pointer; }
  .seg { display: inline-flex; flex-wrap: wrap; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; overflow: hidden; flex-shrink: 0; }
  .seg button { background: transparent; color: #cfcfcf; border: 0; padding: 8px 14px; font-size: 14px; cursor: pointer;
                touch-action: manipulation; }
  .seg button.sel { background: var(--accent, #6152df); color: #fff; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; max-width: 60%; }
  .chips button { background: transparent; color: #cfcfcf; border: 1px solid rgba(255,255,255,.15); border-radius: 99px;
                  padding: 6px 12px; font-size: 13px; cursor: pointer; touch-action: manipulation; }
  .chips button.sel { background: rgba(255,255,255,.1); color: #8f8f8f; text-decoration: line-through; }
  textarea { width: 100%; min-height: 84px; background: #1c1c1c; color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 8px;
             padding: 8px 10px; font: 13px/1.4 ui-monospace, Consolas, monospace; resize: vertical; }
  .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding: 14px 0; }
  .save { background: var(--accent, #6152df); color: #fff; border: 0; border-radius: 10px; padding: 11px 26px;
          font-size: 15px; font-weight: 600; cursor: pointer; }
  .save:disabled { opacity: .5; cursor: default; }
  .ghost { background: transparent; color: #cfcfcf; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; padding: 10px 18px;
           font-size: 14px; cursor: pointer; }
  .msg { color: #a3a3a3; font-size: .9rem; }
  .st { color: #8f8f8f; font-size: .9rem; white-space: nowrap; }
  .st.ok { color: #7ddc8a; }
  ul { margin: 6px 0 14px; padding-left: 20px; color: #cfcfcf; }
  li { margin: 3px 0; }
  @media (max-width: 600px) {
    .row { flex-direction: column; align-items: stretch; gap: 8px; }
    select { max-width: none; width: 100%; }
    .seg { align-self: flex-start; }
    .chips { max-width: none; justify-content: flex-start; }
  }
</style>
</head>
<body>
<div class="wrap" id="app"><p class="intro">…</p></div>
<script>
(function () {
  var fields = [], values = {}, text = {}, lang = "de", saved = {}, accent = "", data = {}, resetArmed = false, backupText = "";
  function L(v) { return v && typeof v === "object" ? (v[lang] || v.en || "") : String(v == null ? "" : v); }
  function F(s, a) { return String(s).replace("{0}", String(a)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function isLive(k) { var r = false; fields.forEach(function (s) { s.fields.forEach(function (f) { if (f.key === k && f.live) r = true; }); }); return r; }
  function dirty() { return Object.keys(values).some(function (k) { return !isLive(k) && values[k] !== saved[k]; }); }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return text.justNow;
    if (m < 60) return F(text.minutesAgo, m);
    return F(text.hoursAgo, Math.round(m / 60));
  }
  function control(f) {
    var opts = f.options;
    if (f.onOff) opts = [["on", text.on], ["off", text.off]];
    if (f.yesNo) opts = [["yes", text.yes], ["no", text.no]];
    if (f.color) return "<input type='color' data-k='" + f.key + "' value='" + esc(values[f.key]) + "'>";
    if (f.multi) {
      var on = String(values[f.key] || "").split(",");
      return "<div class='chips'>" + opts.map(function (o) {
        return "<button data-m='" + f.key + "' data-v='" + esc(o[0]) + "' class='" + (on.indexOf(o[0]) >= 0 ? "sel" : "") + "'>" + esc(L(o[1])) + "</button>";
      }).join("") + "</div>";
    }
    if (f.onOff || f.yesNo || f.seg) {
      return "<div class='seg'>" + opts.map(function (o) {
        return "<button data-k='" + f.key + "' data-v='" + esc(o[0]) + "' class='" + (values[f.key] === o[0] ? "sel" : "") + "'>" + esc(L(o[1])) + "</button>";
      }).join("") + "</div>";
    }
    return "<select data-k='" + f.key + "'>" + opts.map(function (o) {
      return "<option value='" + esc(o[0]) + "'" + (values[f.key] === o[0] ? " selected" : "") + ">" + esc(L(o[1])) + "</option>";
    }).join("") + "</select>";
  }
  function change(k, v) {
    values[k] = v;
    if (isLive(k)) {
      saved[k] = v;
      window.webview.send("live", { key: k, value: v });
    }
    render();
  }
  function render(msg) {
    var app = document.getElementById("app");
    if (accent) document.documentElement.style.setProperty("--accent", accent);
    var h = "<h1>" + esc(text.title) + "<span class='ver'>" + esc(F(text.version, data.version || "")) + "</span></h1>" +
      "<p class='intro'>" + esc(text.intro) + "</p>";
    (data.warnings || []).forEach(function (w) { h += "<div class='warn'>" + esc(w) + "</div>"; });
    fields.forEach(function (sec) {
      var off = values["mod_" + sec.section] === "off";
      h += "<div class='card" + (off ? " off" : "") + "'><h2>" + esc(text[sec.section]) + "</h2>";
      if (off) h += "<p class='note'>" + esc(text.disabled) + "</p>";
      if (sec.section === "extras" && text.skipHint) h += "<p class='note'>" + esc(text.skipHint) + "</p>";
      sec.fields.forEach(function (f) {
        if (f.showIf && values[f.showIf[0]] !== f.showIf[1]) return;
        h += "<div class='row'><div class='lbl'><b>" + esc(L(f.label)) + "</b>" +
          (f.restart ? "<span class='tag'>" + esc(text.restartMark) + "</span>" : "") +
          (f.hint ? "<small>" + esc(L(f.hint)) + "</small>" : "") + "</div>" + control(f) + "</div>";
      });
      h += "</div>";
    });
    h += "<div class='bar'><button class='save' id='save'" + (dirty() ? "" : " disabled") + ">" + esc(text.save) + "</button>" +
      "<button class='ghost' id='reset'>" + esc(resetArmed ? text.resetConfirm : text.reset) + "</button>" +
      "<span class='msg'>" + esc(msg || "") + "</span></div>";
    h += "<div class='card'><h2>" + esc(text.backup) + "</h2><p class='note'>" + esc(text.backupHint) + "</p>" +
      "<textarea id='backup' spellcheck='false'>" + esc(backupText) + "</textarea>" +
      "<div class='bar'><button class='ghost' id='exp'>" + esc(text.exportBtn) + "</button>" +
      "<button class='ghost' id='imp'>" + esc(text.importBtn) + "</button></div></div>";
    h += "<div class='card'><h2>" + esc(text.status) + "</h2><p class='note'>" + esc(text.statusHint) + "</p>";
    Object.keys(text.health || {}).forEach(function (k) {
      var t = (data.health || {})[k];
      h += "<div class='row'><div class='lbl'><b>" + esc(text.health[k]) + "</b></div><span class='st" + (t ? " ok" : "") + "'>" +
        esc(t ? F(text.seen, ago(t)) : text.notSeen) + "</span></div>";
    });
    h += "</div>";
    if (data.changes && data.changes.length) {
      h += "<div class='card'><h2>" + esc(text.news) + "</h2><ul>" + data.changes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    }
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll(".seg button"), function (b) {
      b.addEventListener("click", function () { change(b.getAttribute("data-k"), b.getAttribute("data-v")); });
    });
    Array.prototype.forEach.call(app.querySelectorAll(".chips button"), function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-m"), v = b.getAttribute("data-v");
        var on = String(values[k] || "").split(",").filter(function (x) { return x && x !== v; });
        if (!b.classList.contains("sel")) on.push(v);
        change(k, on.join(","));
      });
    });
    var box = document.getElementById("backup");
    box.addEventListener("input", function () { backupText = box.value; });
    document.getElementById("exp").addEventListener("click", function () { window.webview.send("export", {}); });
    document.getElementById("imp").addEventListener("click", function () { window.webview.send("import", { text: box.value }); });
    Array.prototype.forEach.call(app.querySelectorAll("select"), function (s) {
      s.addEventListener("change", function () { change(s.getAttribute("data-k"), s.value); });
    });
    Array.prototype.forEach.call(app.querySelectorAll("input[type=color]"), function (c) {
      // "change" fires when the picker closes; while dragging only the preview changes
      c.addEventListener("change", function () { change(c.getAttribute("data-k"), c.value); });
    });
    document.getElementById("save").addEventListener("click", function () {
      var needRestart = false;
      fields.forEach(function (sec) { sec.fields.forEach(function (f) { if (f.restart && values[f.key] !== saved[f.key]) needRestart = true; }); });
      window.webview.send("save", values);
      saved = JSON.parse(JSON.stringify(values));
      render(text.saved + (needRestart ? " " + text.restart : ""));
    });
    // Click twice: window.confirm() does not work in Seanime's sandboxed webviews
    document.getElementById("reset").addEventListener("click", function () {
      if (!resetArmed) { resetArmed = true; render(text.resetAsk); return; }
      resetArmed = false;
      window.webview.send("reset", {});
    });
  }
  function start() {
    if (!window.webview) { setTimeout(start, 100); return; }
    window.webview.on("init", function (d) {
      data = d; fields = d.fields; text = d.text; lang = d.lang; accent = d.accent || "";
      values = JSON.parse(JSON.stringify(d.values)); saved = JSON.parse(JSON.stringify(d.values));
      render(d.msg || "");
    });
    window.webview.on("accent", function (d) { accent = d.accent || ""; render(); });
    window.webview.on("exported", function (d) {
      backupText = d.text || "";
      render(text.exported);
      var box = document.getElementById("backup");
      try { box.focus(); box.select(); } catch (e) {}
      try { if (navigator.clipboard) navigator.clipboard.writeText(backupText).catch(function () {}); } catch (e) {}
      try { document.execCommand("copy"); } catch (e) {}
    });
    window.webview.send("ready", {});
  }
  start();
})();
</script>
</body>
</html>`

// First start: pick a colour scheme. Shown once as a window over the whole app.
const VS_PICKER_TEXT = {
    de: { title: "Welches Farbschema willst du?", intro: "Ein Klick ändert die Farben sofort. Du kannst es später jederzeit auf der Seite „VikTempest Seanime UI“ in der Seitenleiste ändern.",
          red: "Rot", purple: "Lila", blue: "Blau", custom: "Eigene Farben", off: "Kein Theme", accent: "Akzent", bg: "Hintergrund", done: "Fertig", close: "Schließen",
          hint: "Die Einstellungen findest du in der linken Seitenleiste unter „VikTempest Seanime UI“. Fehlt der Eintrag direkt nach der Installation, lade Seanime einmal neu (Strg+R)." },
    en: { title: "Which colour scheme do you want?", intro: "One click changes the colours right away. You can change it any time on the \"VikTempest Seanime UI\" page in the sidebar.",
          red: "Red", purple: "Purple", blue: "Blue", custom: "Custom colours", off: "No theme", accent: "Accent", bg: "Background", done: "Done", close: "Close",
          hint: "The settings are in the left sidebar under \"VikTempest Seanime UI\". If the entry is missing right after installing, reload Seanime once (Ctrl+R)." },
}

const VS_PICKER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { background: #141414; color: #e5e5e5; font: 15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .box { position: relative; padding: 24px; border: 1px solid rgba(255,255,255,.1); border-radius: 18px; }
  .x { position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; border-radius: 99px; border: 0; cursor: pointer;
       background: rgba(255,255,255,.08); color: #fff; font-size: 18px; line-height: 34px; }
  .hint { margin: 14px 0 0; font-size: .85rem; color: #8f8f8f; }
  h1 { margin: 0 34px 6px 0; font-size: 1.45rem; color: #fff; }
  p { margin: 0 0 20px; color: #a3a3a3; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
  .tile { border: 2px solid rgba(255,255,255,.1); border-radius: 14px; padding: 10px; cursor: pointer; background: transparent;
          color: inherit; text-align: left; font: inherit; touch-action: manipulation; }
  .tile.sel { border-color: #fff; }
  .prev { height: 74px; border-radius: 9px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 8px; }
  .prev i { display: block; height: 8px; border-radius: 4px; background: rgba(255,255,255,.18); width: 70%; }
  .prev b { display: block; height: 18px; width: 54px; border-radius: 6px; }
  .name { font-weight: 600; color: #fff; }
  .custom { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  .custom label { display: flex; align-items: center; gap: 8px; color: #cfcfcf; }
  input[type=color] { width: 48px; height: 34px; padding: 2px; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; background: #1c1c1c; }
  .bar { display: flex; justify-content: flex-end; margin-top: 22px; }
  .done { background: #fff; color: #000; border: 0; border-radius: 10px; padding: 11px 30px; font-size: 15px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
<div class="box" id="app"></div>
<script>
(function () {
  var d = null, cur = "red", accent = "#e50914", bg = "#0f0f0f";
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function tile(key, a, b) {
    var prev = key === "off"
      ? "<div class='prev' style='background:#1a1a22'><i></i><b style='background:#6152df'></b></div>"
      : "<div class='prev' style='background:" + b + "'><i></i><b style='background:" + a + "'></b></div>";
    return "<button class='tile" + (cur === key ? " sel" : "") + "' data-t='" + key + "'>" + prev + "<div class='name'>" + esc(d.text[key]) + "</div></button>";
  }
  function pick() { window.webview.send("pick", { theme: cur, accent: accent, bg: bg }); }
  function render() {
    var t = d.text, h = "<button class='x' id='x' title='" + esc(t.close) + "'>×</button><h1>" + esc(t.title) + "</h1><p>" + esc(t.intro) + "</p><div class='grid'>";
    ["red", "purple", "blue"].forEach(function (k) { h += tile(k, d.schemes[k].accent, d.schemes[k].bg); });
    h += tile("custom", accent, bg) + tile("off") + "</div>";
    if (cur === "custom") {
      h += "<div class='custom'><label>" + esc(t.accent) + " <input type='color' id='ca' value='" + esc(accent) + "'></label>" +
        "<label>" + esc(t.bg) + " <input type='color' id='cb' value='" + esc(bg) + "'></label></div>";
    }
    h += "<p class='hint'>" + esc(t.hint) + "</p><div class='bar'><button class='done' id='done'>" + esc(t.done) + "</button></div>";
    document.getElementById("app").innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll(".tile"), function (b) {
      b.addEventListener("click", function () { cur = b.getAttribute("data-t"); pick(); render(); });
    });
    var ca = document.getElementById("ca"), cb = document.getElementById("cb");
    if (ca) ca.addEventListener("change", function () { accent = ca.value; pick(); render(); });
    if (cb) cb.addEventListener("change", function () { bg = cb.value; pick(); render(); });
    document.getElementById("done").addEventListener("click", function () { window.webview.send("done", {}); });
    document.getElementById("x").addEventListener("click", function () { window.webview.send("done", {}); });
  }
  function start() {
    if (!window.webview) { setTimeout(start, 100); return; }
    window.webview.on("init", function (data) {
      d = data; cur = data.theme === "off" ? "red" : data.theme; accent = data.accent; bg = data.bg;
      render(); pick();
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

    // --- Theme (applies right away when the scheme changes)
    function themeCss(s) {
        const colors = vsSchemeColors(s)
        return colors ? vsPaletteCss(colors) + VS_THEME_CSS : ""
    }
    // Only touches the page when the CSS changed (onMainTabReady forces it: the element is gone then)
    let themeApplied = null
    function applyTheme(s, force) {
        const css = themeCss(s)
        if (!force && css === themeApplied) return
        themeApplied = css
        vsSetStyle(ctx, "data-vsuite-theme", css)
    }
    // The style element is lost when the page reloads, so it is added again when a tab is ready.
    // (onNavigate and onReady are left to the modules.)
    ctx.dom.onMainTabReady(() => { const s = vsLoadSettings(); applyTheme(s, true); applyLayout(s, true) })
    applyTheme(settings, true)

    // --- Sidebar: slide away and hide entries (also applies right away)
    let layoutApplied = null
    function applyLayout(s, force) {
        const css = vsLayoutCss(s)
        if (!force && css === layoutApplied) return
        layoutApplied = css
        vsSetStyle(ctx, "data-vsuite-layout", css)
    }
    applyLayout(settings, true)

    // --- Settings page in the sidebar
    const page = ctx.newWebview({
        slot: "screen",
        fullWidth: true,
        autoHeight: true,
        sidebar: { label: "VikTempest Seanime UI", icon: VS_SIDEBAR_ICON },
    })
    page.setContent(() => VS_PAGE_HTML)

    function warnings() {
        const out = []
        // The old Season Switcher makes its own Episodes tab the default episode source
        if (ctx.appSettings && ctx.appSettings.get) {
            return Promise.resolve(ctx.appSettings.get("library.defaultPlaybackSource", ""))
                .then((src) => {
                    if (String(src || "") === "ext:viktempest-season-switcher") out.push(VS_PAGE_TEXT[pageLang].oldSwitcher)
                    return out
                })
                .catch(() => out)
        }
        return Promise.resolve(out)
    }

    function sendInit(msg) {
        const current = vsLoadSettings()
        let health = {}
        try { health = $store.get(VS_HEALTH_KEY) || {} } catch (e) {}
        warnings().then((w) => {
            page.channel.send("init", {
                fields: VS_FIELDS,
                values: current,
                lang: pageLang,
                text: VS_PAGE_TEXT[pageLang],
                accent: vsAccentHex(current),
                version: VS_VERSION,
                changes: VS_CHANGES[pageLang],
                health: health,
                warnings: w,
                msg: msg || "",
            })
        })
    }

    page.channel.on("ready", () => sendInit())

    page.channel.on("save", (values) => {
        const next = vsDefaults()
        Object.keys(next).forEach((k) => {
            if (values && values[k] !== undefined && values[k] !== null) next[k] = String(values[k])
        })
        vsSaveSettings(next)
        applyTheme(next)
        applyLayout(next)
    })

    // Settings marked "live" are saved and applied one by one as they change
    page.channel.on("live", (e) => {
        if (!e || !e.key) return
        const next = vsLoadSettings()
        next[e.key] = String(e.value)
        vsSaveSettings(next)
        applyTheme(next)
        applyLayout(next)
        page.channel.send("accent", { accent: vsAccentHex(next) })
    })

    page.channel.on("reset", () => {
        const next = vsDefaults()
        vsSaveSettings(next)
        applyTheme(next)
        applyLayout(next)
        sendInit(VS_PAGE_TEXT[pageLang].resetDone + " " + VS_PAGE_TEXT[pageLang].restart)
    })

    // Back up and load: the settings as one line of text
    page.channel.on("export", () => {
        const s = vsLoadSettings()
        page.channel.send("exported", { text: JSON.stringify({ app: "viktempest-ui", version: VS_VERSION, settings: s }) })
    })
    page.channel.on("import", (e) => {
        const next = vsImportSettings(e && e.text)
        if (!next) {
            sendInit(VS_PAGE_TEXT[pageLang].importFailed)
            return
        }
        vsSaveSettings(next)
        applyTheme(next)
        applyLayout(next)
        sendInit(VS_PAGE_TEXT[pageLang].imported + " " + VS_PAGE_TEXT[pageLang].restart)
    })

    // --- First start: ask for a colour scheme once
    let asked = false
    try { asked = $storage.get(VS_THEME_ASKED_KEY) === true } catch (e) {}
    if (!asked) {
        // A window in the middle, not a layer over the whole app: Seanime stays usable around it
        // even while the plugin is busy (AniList requests block it for a moment).
        const picker = ctx.newWebview({
            slot: "fixed",
            zIndex: 9999,
            autoHeight: true,
            style: "left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 24px));max-height:calc(100vh - 24px);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.6)",
            window: { frameless: true },
        })
        vsShare.pickerOpen = true
        picker.setContent(() => VS_PICKER_HTML)
        picker.channel.on("ready", () => {
            // Asked once: even if the window is closed some other way, it doesn't come back
            try { $storage.set(VS_THEME_ASKED_KEY, true) } catch (e) {}
            const s = vsLoadSettings()
            picker.channel.send("init", {
                text: VS_PICKER_TEXT[pageLang],
                schemes: VS_SCHEMES,
                theme: s.theme,
                accent: s.themeAccent || VS_SCHEMES.red.accent,
                bg: s.themeBg || VS_SCHEMES.red.bg,
            })
        })
        picker.channel.on("pick", (e) => {
            if (!e) return
            const next = vsLoadSettings()
            next.theme = String(e.theme || "off")
            if (next.theme === "custom") {
                if (vsHexRgb(e.accent)) next.themeAccent = String(e.accent)
                if (vsHexRgb(e.bg)) next.themeBg = String(e.bg)
            }
            vsSaveSettings(next)
            applyTheme(next)
        })
        picker.channel.on("done", () => {
            try { $storage.set(VS_THEME_ASKED_KEY, true) } catch (e) {}
            vsShare.pickerOpen = false
            picker.close()
        })
    }

    // --- Modules
    vsTrayState.ctx = ctx
    vsModules.forEach((m) => {
        if (settings["mod_" + m.name] === "off") return
        try {
            m.fn(ctx)
        }
        catch (e) {
            console.error("viktempest-ui: " + m.name + " failed to start", e)
        }
    })

    // A minute after the start (Seanime loads its own things first), then checked every 6 hours
    ctx.setTimeout(() => vsWarm(ctx), 60000)
    ctx.setInterval(() => vsWarm(ctx), 6 * 3600 * 1000)

    // No module filled the tray (e.g. Custom Ratings is off): a tray with just the settings button
    if (!vsTrayState.tray) {
        const tray = vsTray()
        tray.render(() => tray.stack(vsTrayHeader(tray), { gap: 3 }))
    }
}
