// Smoke test for viktempest-ui.json with stand-ins for Seanime's plugin APIs.
// Usage (from the repository root):  node test/smoke.js
//
// It checks that the built payload starts without errors and that the main paths work:
// settings page, colour schemes, first-start picker, library merge hook, season dropdown with
// progress and the episode tab. It does not replace a test in Seanime itself.

const fs = require("fs")
const vm = require("vm")
const assert = require("assert")

const manifest = JSON.parse(fs.readFileSync(__dirname + "/../viktempest-ui.json", "utf8"))
let failures = 0
function check(name, fn) {
    try {
        fn()
        console.log("ok   " + name)
    }
    catch (e) {
        failures++
        console.log("FAIL " + name + "\n     " + (e && e.stack || e))
    }
}

// ---- Stand-ins -------------------------------------------------------------------------------

const store = new Map()
const storage = new Map()
const hooks = {}
const toasts = []
const navigations = []
const webviews = []
const observers = []
const created = []
let navigateCb = null
let mainTabReady = []
let uiFn = null

let elementId = 0
function makeElement(tag, attrs) {
    const el = {
        id: "el" + (++elementId), tagName: (tag || "div").toUpperCase(), attributes: Object.assign({}, attrs || {}),
        text: "", html: "", children: [], styles: {}, classes: [], listeners: {}, removed: false,
        setAttribute(k, v) { this.attributes[k] = String(v) },
        getAttribute(k) { return Promise.resolve(this.attributes[k] === undefined ? null : this.attributes[k]) },
        removeAttribute(k) { delete this.attributes[k] },
        setText(t) { this.text = String(t) },
        setInnerHTML(h) { this.html = String(h) },
        getProperty(k) { return Promise.resolve(k === "value" ? this.value : null) },
        setStyle(k, v) { this.styles[k] = v },
        removeStyle(k) { delete this.styles[k] },
        addClass(...c) { this.classes.push(...c) },
        append(c) { this.children.push(c) },
        before() {}, after(c) { created.push(c) },
        remove() { this.removed = true },
        addEventListener(ev, fn) { this.listeners[ev] = fn },
        queryOne() { return Promise.resolve(null) },
        query() { return Promise.resolve([]) },
        getParent() { return Promise.resolve(null) },
        getChildren() { return Promise.resolve([]) },
    }
    return el
}
const body = makeElement("body")
const titleContainer = makeElement("div")
const domElements = { body: body, "[data-media-page-header-entry-details-title-container]": titleContainer }

function channel() {
    const handlers = {}
    const sent = []
    return {
        handlers, sent,
        on(name, fn) { handlers[name] = fn },
        send(name, payload) { sent.push({ name, payload: JSON.parse(JSON.stringify(payload)) }) },
        sync() {},
    }
}

const trays = []
const eventHandlers = {}

function stub(name) {
    // Anything not modelled returns harmless values
    return new Proxy(function () {}, {
        get(_, k) { return k === "then" ? undefined : stub(name + "." + String(k)) },
        apply() { return stub(name + "()") },
    })
}

const ctx = {
    setTimeout(fn) { fn(); return () => {} },
    setInterval() { return () => {} },
    toast: { success: (m) => toasts.push(["success", m]), warning: (m) => toasts.push(["warning", m]), error: (m) => toasts.push(["error", m]), info: (m) => toasts.push(["info", m]) },
    screen: {
        navigateTo(path, params) { navigations.push({ path, params }) },
        onNavigate(cb) { navigateCb = cb },
        loadCurrent() {},
        state() { return { get: () => ({ pathname: "/", searchParams: {} }) } },
    },
    dom: {
        queryOne(sel) {
            if (sel === "[data-vsuite-theme]") return Promise.resolve(body.children.find((c) => c.attributes["data-vsuite-theme"] && !c.removed) || null)
            if (sel === "[data-vtss-style]") return Promise.resolve(body.children.find((c) => c.attributes["data-vtss-style"] && !c.removed) || null)
            return Promise.resolve(domElements[sel] || null)
        },
        query() { return Promise.resolve([]) },
        observe(sel, cb) { observers.push({ sel, cb }); return [() => {}, () => {}] },
        createElement(tag) { return Promise.resolve(makeElement(tag)) },
        asElement(id) { return makeElement("div", { id }) },
        onReady(cb) { cb() },
        onMainTabReady(cb) { mainTabReady.push(cb) },
    },
    newWebview(options) {
        const wv = { options, channel: channel(), content: null, closed: false,
            setContent(fn) { this.content = fn() }, close() { this.closed = true }, show() {}, hide() {}, setOptions() {} }
        webviews.push(wv)
        return wv
    },
    anime: { registerEntryEpisodeTab(o) { ctx.anime.tab = o; return { name: o.name, getIsOpen: () => ({ get: () => false }) } } },
    appSettings: {
        values: { "library.defaultPlaybackSource": "" },
        get(path, fallback) { return Promise.resolve(this.values[path] !== undefined ? this.values[path] : fallback) },
        set(path, value) { this.values[path] = value; return Promise.resolve({}) },
    },
    continuity: { getWatchHistoryItem() { return null } },
    eventHandler(key, fn) { eventHandlers[key] = fn; return key },
    fieldRef() { return { current: "", setValue() {}, onValueChange() {} } },
    newTray(options) {
        const t = { options, renderFn: null, count: 0,
            render(fn) { this.renderFn = fn }, update() {}, onOpen() {}, onClose() {}, open() {}, close() {},
            text: (text, o) => ({ type: "text", text }), button: (label, o) => ({ type: "button", label, onClick: o && o.onClick }),
            stack: (items) => ({ type: "stack", items }), flex: (items) => ({ type: "flex", items }),
            input: () => ({ type: "input" }), alert: (o) => ({ type: "alert", o }) }
        trays.push(t)
        return t
    },
    newModal() { return stub("modal") },
    action: stub("action"),
}

// AniList: a three season franchise 1 -> 2 -> 3 and a movie 9 between 1 and 2
const media = {
    1: { id: 1, type: "ANIME", format: "TV", episodes: 12, startDate: { year: 2020, month: 1, day: 1 }, title: { english: "Show" }, rel: [["SEQUEL", 9]] },
    9: { id: 9, type: "ANIME", format: "MOVIE", episodes: 1, startDate: { year: 2020, month: 6, day: 1 }, title: { english: "Show Movie" }, rel: [["PREQUEL", 1], ["SEQUEL", 2]] },
    2: { id: 2, type: "ANIME", format: "TV", episodes: 12, startDate: { year: 2021, month: 1, day: 1 }, title: { english: "Show Season 2" }, rel: [["PREQUEL", 9], ["SEQUEL", 3]] },
    3: { id: 3, type: "ANIME", format: "TV", episodes: 12, startDate: { year: 2022, month: 1, day: 1 }, title: { english: "Show Season 3" }, rel: [["PREQUEL", 2]] },
}
function node(id, depth) {
    const m = media[id]
    const out = Object.assign({}, m, { seasonYear: m.startDate.year })
    delete out.rel
    if (depth > 0) out.relations = { edges: m.rel.map((r) => ({ relationType: r[0], node: node(r[1], depth - 1) })) }
    return out
}
let anilistFails = false
const $anilist = {
    customQuery(body) {
        if (anilistFails) throw new Error("429 Too Many Requests")
        if (body.variables.ids) return { Page: { media: body.variables.ids.filter((i) => media[i]).map((i) => node(i, 1)) } }
        return { Media: node(body.variables.id, 2) }
    },
    getAnimeCollection() {
        return { MediaListCollection: { lists: [{ entries: [
            { status: "COMPLETED", progress: 12, media: { id: 1 } },
            { status: "CURRENT", progress: 5, media: { id: 2 } },
        ] }] } }
    },
    getRawAnimeCollection() { return { MediaListCollection: { lists: [] } } },
    getRawMangaCollection() { return { MediaListCollection: { lists: [] } } },
    refreshAnimeCollection() {}, refreshMangaCollection() {},
}

// Seanime loads the payload in one runtime and then runs the $ui.register() callback and every
// hook in other runtimes, compiled from their source text only. The test does the same, so code
// that uses something from outside its function fails here like it does in Seanime.
function bindings() {
    const b = {
        console: { log() {}, info() {}, warn() {}, error: (...a) => console.error("     [plugin error]", ...a) },
        $store: { get: (k) => store.get(k), set: (k, v) => store.set(k, JSON.parse(JSON.stringify(v))) },
        $storage: { get: (k) => storage.get(k), set: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))) },
        $anilist,
        $database: { anilist: { getToken: () => "" } },
    }
    b.globalThis = b
    return vm.createContext(b)
}
function isolated(fn) {
    return vm.runInContext("(" + fn.toString() + ")", bindings())
}
const sandbox = bindings()
sandbox.$app = new Proxy({}, { get: (_, k) => (fn) => { hooks[k] = isolated(fn) } })
sandbox.$ui = { register: (fn) => { uiFn = isolated(fn) } }

// ---- Tests -----------------------------------------------------------------------------------

check("payload compiles and init() runs", () => {
    vm.runInContext(manifest.payload + "\ninit()", sandbox, { filename: "payload.js" })
    assert.ok(uiFn, "$ui.register was not called")
    assert.ok(hooks.onAnimeLibraryCollection, "library hook missing")
})

check("UI starts without errors", () => {
    uiFn(ctx)
    assert.ok(webviews.length >= 2, "settings page and picker expected")
})

const page = webviews.find((w) => w.options.slot === "screen")
const picker = webviews.find((w) => w.options.slot === "fixed")

check("manifest", () => {
    assert.strictEqual(manifest.id, "viktempest-ui")
    assert.strictEqual(manifest.name, "VikTempest Seanime UI")
    assert.ok(/vikTempest-Seanime-UI/.test(manifest.manifestURI))
})

check("tray has one entry with an open-settings button", () => {
    assert.strictEqual(trays.length, 1, "expected one tray, got " + trays.length)
    const out = JSON.stringify(trays[0].renderFn())
    assert.ok(out.includes("VikTempest Seanime UI") && out.includes("AniList Custom Ratings"), out)
    eventHandlers["vs-open-settings"]()
    const last = navigations[navigations.length - 1]
    assert.strictEqual(last.path, "/webview")
    assert.strictEqual(last.params.id, "viktempest-ui")
})

check("settings page sends fields, version and status", () => {
    page.channel.handlers.ready()
    return new Promise((r) => setImmediate(r))
})

setImmediate(() => {
    check("settings page init payload", () => {
        const init = page.channel.sent.find((m) => m.name === "init")
        assert.ok(init, "no init sent")
        assert.strictEqual(init.payload.version, manifest.version)
        assert.ok(init.payload.fields.some((s) => s.fields.some((f) => f.key === "themeAccent")))
        assert.ok(!init.payload.fields.some((s) => s.fields.some((f) => f.key === "playMethod")), "playMethod should be gone")
        assert.strictEqual(init.payload.values.theme, "off")
    })

    check("first start shows the colour picker as a window, not over the whole app", () => {
        assert.ok(picker, "no picker")
        assert.ok(picker.options.window.frameless && !/height:100vh/.test(picker.options.style), "picker must not cover the whole app")
        picker.channel.handlers.ready()
        assert.ok(picker.channel.sent.some((m) => m.name === "init"))
    })

    check("picking purple applies it right away", () => {
        picker.channel.handlers.pick({ theme: "purple" })
    })

    setImmediate(() => {
        const themeStyle = () => body.children.find((c) => c.attributes["data-vsuite-theme"] && !c.removed)
        check("purple theme style in the page", () => {
            const st = themeStyle()
            assert.ok(st, "theme style missing")
            assert.ok(st.text.includes("--color-brand-500: 139 92 246"), "purple accent missing")
            assert.ok(!/229,\s*9,\s*20/.test(st.text), "red left in theme")
            assert.strictEqual(storage.get("vsuite:settings").theme, "purple")
        })
        check("custom colours", () => {
            picker.channel.handlers.pick({ theme: "custom", accent: "#00ff88", bg: "#101010" })
        })
        setImmediate(() => {
            check("custom accent and background used", () => {
                const st = themeStyle()
                assert.ok(st.text.includes("--color-brand-500: 0 255 136"), "custom accent missing")
                assert.ok(st.text.includes("--background: rgb(16,16,16)"), "custom background missing")
            })
            check("Done closes the picker and is remembered", () => {
                picker.channel.handlers.done()
                assert.ok(picker.closed)
                assert.strictEqual(storage.get("vsuite:themeAsked"), true)
            })
            check("live setting on the settings page switches the theme off", () => {
                page.channel.handlers.live({ key: "theme", value: "off" })
            })
            setImmediate(() => {
                check("theme removed", () => assert.ok(!themeStyle()))
                check("old 'on' value becomes red", () => {
                    const s = storage.get("vsuite:settings")
                    s.theme = "on"
                    storage.set("vsuite:settings", s)
                    page.channel.sent.length = 0
                    page.channel.handlers.ready()
                })
                setImmediate(() => check("old 'on' value shown as red", () => {
                    const init = page.channel.sent.find((m) => m.name === "init")
                    assert.strictEqual(init.payload.values.theme, "red")
                    const s = storage.get("vsuite:settings")
                    s.theme = "off"
                    storage.set("vsuite:settings", s)
                }))
                check("library hook keeps one card per series", () => {
                    const e = { libraryCollection: { lists: [{ entries: [{ mediaId: 3, media: node(3, 0) }, { mediaId: 2, media: node(2, 0) }, { mediaId: 1, media: node(1, 0) }] }] }, next() {} }
                    hooks.onAnimeLibraryCollection(e)
                    assert.strictEqual(JSON.stringify(e.libraryCollection.lists[0].entries.map((x) => x.mediaId)), "[1]")
                })
                check("season dropdown with progress", () => {
                    navigateCb({ pathname: "/entry", searchParams: { id: "2" } })
                })
                setImmediate(() => setImmediate(() => {
                    check("dropdown content", () => {
                        const wrap = created.find((c) => c.attributes && c.attributes.class === "vtss-switcher")
                        assert.ok(wrap, "dropdown not added")
                        assert.ok(wrap.html.includes("✓ Show (2020)"), "finished season mark missing: " + wrap.html)
                        assert.ok(wrap.html.includes("Show Season 2 (2021) · 5/12"), "progress missing")
                        assert.ok(wrap.html.includes("nicht auf deiner Liste"), "not on list missing")
                        assert.ok(!wrap.html.includes("Show Movie"), "movie should be hidden by default")
                    })
                    check("episode tab plays online stream", () => {
                        navigations.length = 0
                        ctx.anime.tab.onSelectEpisode({ mediaId: 2, episodeNumber: 4 })
                        const last = navigations[navigations.length - 1]
                        assert.strictEqual(last.params.tab, "onlinestream")
                        assert.strictEqual(last.params.episode, "4")
                    })
                    check("AniList limit gives one message", () => {
                        anilistFails = true
                        store.clear()
                        navigateCb({ pathname: "/entry", searchParams: { id: "3" } })
                        navigateCb({ pathname: "/entry", searchParams: { id: "1" } })
                        anilistFails = false
                        const n = toasts.filter((t) => /AniList/.test(t[1])).length
                        assert.strictEqual(n, 1, "expected one AniList toast, got " + n)
                    })
                    check("status records what was found", () => {
                        const obs = observers.find((o) => o.sel === "[data-media-page-header-entry-details-title-container]")
                        obs.cb([titleContainer])
                        assert.ok((store.get("vsuite:health") || {}).title)
                    })
                    console.log(failures ? "\n" + failures + " failed" : "\nall passed")
                    process.exitCode = failures ? 1 : 0
                }))
            })
        })
    })
})
