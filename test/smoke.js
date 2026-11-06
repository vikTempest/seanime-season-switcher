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
const navigateCbs = []
const navigateCb = (e) => navigateCbs.forEach((cb) => cb(e))
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
const intervals = []
const videoListeners = {}
const videoCalls = []
const palettes = []
const menuItems = []
let clockOffset = 0
let playbackInfo = null
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
    setInterval(fn) { intervals.push(fn); return () => {} },
    toast: { success: (m) => toasts.push(["success", m]), warning: (m) => toasts.push(["warning", m]), error: (m) => toasts.push(["error", m]), info: (m) => toasts.push(["info", m]) },
    screen: {
        navigateTo(path, params) { navigations.push({ path, params }) },
        onNavigate(cb) { navigateCbs.push(cb) },
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
    action: new Proxy({}, { get: (_, k) => (props) => {
        const item = { kind: String(k), props, click: null, mount() {}, unmount() {}, onClick(fn) { this.click = fn } }
        menuItems.push(item)
        return item
    } }),
    videoCore: {
        addEventListener(type, fn) { videoListeners[type] = fn },
        pause() { videoCalls.push("pause") },
        getCurrentPlaybackInfo() { return playbackInfo },
    },
    newCommandPalette(options) {
        const p = { options, items: [], openFn: null, opened: 0,
            setItems(i) { this.items = i }, onOpen(fn) { this.openFn = fn }, onClose() {},
            open() { this.opened++; if (this.openFn) this.openFn() }, close() {} }
        palettes.push(p)
        return p
    },
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
            { status: "COMPLETED", progress: 12, media: { id: 1, title: { english: "Show", romaji: "Shou" }, bannerImage: "b1.jpg" } },
            { status: "CURRENT", progress: 5, updatedAt: 200, media: { id: 2, episodes: 12, title: { english: "Show Season 2" }, bannerImage: "b2.jpg" } },
            { status: "CURRENT", progress: 3, updatedAt: 100, media: { id: 60, episodes: 0, status: "RELEASING", nextAiringEpisode: { episode: 4 }, title: { english: "Airing Show" } } },
        ] }] } }
    },
    getRawAnimeCollection() { return { MediaListCollection: { lists: [] } } },
    getRawMangaCollection() { return { MediaListCollection: { lists: [] } } },
    refreshAnimeCollection() {}, refreshMangaCollection() {},
    getAnimeCollectionWithRelations() {
        return { MediaListCollection: { lists: [{ entries: [
            { status: "COMPLETED", media: { id: 1, title: { english: "Show" }, relations: { edges: [
                { relationType: "SEQUEL", node: { id: 2, format: "TV", status: "FINISHED", title: { english: "Show Season 2" } } },
            ] } } },
            { status: "CURRENT", media: { id: 2, title: { english: "Show Season 2" }, relations: { edges: [
                { relationType: "SEQUEL", node: { id: 50, format: "TV", status: "RELEASING", title: { english: "Show Season 3" } } },
                { relationType: "SEQUEL", node: { id: 51, format: "MOVIE", status: "FINISHED", title: { english: "Show Movie 2" } } },
            ] } } },
        ] }] } }
    },
    updateEntryProgress(id, progress) { progressUpdates.push([id, progress]) },
    getAnimeDetails(id) {
        if (id === 77) return { id: 77, relations: { edges: [
            { relationType: "SEQUEL", node: { id: 78, type: "ANIME", format: "TV", status: "NOT_YET_RELEASED", startDate: { year: 2027, month: 4, day: 3 }, title: { english: "Later Show 2" } } },
        ] } }
        return media[id] ? node(id, 1) : { id: id, relations: { edges: [] } }
    },
}
const progressUpdates = []

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
    b.__clock = () => clockOffset
    const c = vm.createContext(b)
    // A clock the test can move forward
    vm.runInContext("Date.now = ((now) => () => now() + __clock())(Date.now)", c)
    return c
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
                    check("manifest asks for the playback permission", () => {
                        assert.ok(manifest.plugin.permissions.scopes.includes("playback"))
                    })
                    check("new seasons: sequel not on the list, once", () => {
                        const msgs = toasts.filter((t) => /Neue Staffel/.test(t[1]))
                        assert.strictEqual(msgs.length, 1, JSON.stringify(toasts))
                        assert.ok(msgs[0][1].includes("Show Season 3"))
                        assert.ok(!msgs[0][1].includes("Movie"))
                        const out = JSON.stringify(trays[0].renderFn())
                        assert.ok(out.includes("Neue Staffeln") && out.includes("Show Season 3"), out)
                    })
                    check("tray has the sleep timer", () => {
                        const out = JSON.stringify(trays[0].renderFn())
                        assert.ok(out.includes("Schlaftimer: aus"), out)
                    })
                    check("sleep timer pauses after the time", () => {
                        eventHandlers["vsx-sleep15"]()
                        assert.ok(JSON.stringify(trays[0].renderFn()).includes("pausiert in 15 min"))
                        videoCalls.length = 0
                        clockOffset += 16 * 60000
                        intervals.forEach((fn) => fn())
                        assert.deepStrictEqual(videoCalls, ["pause"])
                        assert.ok(JSON.stringify(trays[0].renderFn()).includes("Schlaftimer: aus"))
                    })
                    check("sleep timer after this episode pauses the next one", () => {
                        eventHandlers["vsx-sleepEp"]()
                        videoCalls.length = 0
                        videoListeners["video-ended"]({ autoNext: true })
                        videoListeners["video-can-play"]({ paused: false })
                        assert.deepStrictEqual(videoCalls, ["pause", "pause"])
                        videoListeners["video-can-play"]({ paused: false })
                        assert.strictEqual(videoCalls.length, 2, "only the next episode")
                    })
                    check("screensaver after idle minutes, not while playing, closes with the button", () => {
                        // The sleep timer test above moved the clock, so the screensaver may be up already
                        const find = () => webviews.find((w) => w.options.zIndex === 99999)
                        let shown = !!find()
                        if (find()) {
                            find().hide = () => { shown = false }
                            find().show = () => { shown = true }
                            find().channel.handlers.close()
                        }
                        assert.ok(!shown)
                        const n = webviews.length
                        videoListeners["video-paused"]({})
                        clockOffset += 6 * 60000
                        videoListeners["video-resumed"]({})
                        intervals.forEach((fn) => fn())
                        assert.ok(!shown && webviews.length === n, "no screensaver while a video plays")
                        const countBefore = webviews.length
                        videoListeners["video-paused"]({})
                        clockOffset += 6 * 60000
                        intervals.forEach((fn) => fn())
                        const saver = find()
                        assert.ok(saver && (shown || webviews.length === countBefore + 1), "screensaver expected")
                        assert.strictEqual(saver.options.slot, "fixed")
                        assert.ok(/width:100vw/.test(saver.options.style))
                        assert.ok(saver.content.includes("graphql.anilist.co") && saver.content.includes("TRENDING_DESC"))
                        saver.channel.handlers.ready()
                        const init = saver.channel.sent.find((m) => m.name === "init")
                        assert.ok(init.payload.fallback.length === 2 && init.payload.fallback[0].bannerImage, JSON.stringify(init.payload.fallback))
                        assert.strictEqual(init.payload.text.saverBack, "Zurück zu Seanime")
                        let hidden = false
                        saver.hide = () => { hidden = true }
                        saver.channel.handlers.open({ id: 7 })
                        assert.ok(hidden)
                        const last = navigations[navigations.length - 1]
                        assert.strictEqual(last.path, "/entry")
                        assert.strictEqual(last.params.id, "7")
                    })
                    check("rating window after the last episode", () => {
                        toasts.length = 0
                        playbackInfo = { media: { id: 3, episodes: 12, title: { english: "Show Season 3" } }, episode: { episodeNumber: 12, progressNumber: 12 } }
                        videoListeners["video-completed"]({})
                        videoListeners["video-terminated"]({})
                        assert.ok(toasts.some((t) => /Show Season 3/.test(t[1])), JSON.stringify(toasts))
                        toasts.length = 0
                        videoListeners["video-completed"]({})
                        videoListeners["video-terminated"]({})
                        assert.strictEqual(toasts.length, 0, "asked only once")
                    })
                    check("next season opens after the last episode", () => {
                        toasts.length = 0
                        const navs = navigations.length
                        playbackInfo = { media: { id: 2, episodes: 12, title: { english: "Show Season 2" } }, episode: { episodeNumber: 12, progressNumber: 12 } }
                        videoListeners["video-completed"]({})
                        videoListeners["video-ended"]({})
                        const last = navigations[navigations.length - 1]
                        assert.ok(navigations.length > navs && last.path === "/entry" && last.params.id === "3", JSON.stringify(last))
                        assert.ok(toasts.some((t) => /Show Season 3/.test(t[1])), JSON.stringify(toasts))
                    })
                    check("next season not out yet: only a notice", () => {
                        toasts.length = 0
                        const navs = navigations.length
                        playbackInfo = { media: { id: 77, episodes: 12, title: { english: "Later Show" } }, episode: { episodeNumber: 12 } }
                        videoListeners["video-completed"]({})
                        videoListeners["video-terminated"]({})
                        assert.strictEqual(navigations.length, navs)
                        assert.ok(toasts.some((t) => /Later Show 2/.test(t[1]) && /3\.4\.2027/.test(t[1])), JSON.stringify(toasts))
                    })
                    check("not the last episode: nothing happens", () => {
                        toasts.length = 0
                        const navs = navigations.length
                        playbackInfo = { media: { id: 1, episodes: 12, title: { english: "Show" } }, episode: { episodeNumber: 7 } }
                        videoListeners["video-completed"]({})
                        videoListeners["video-terminated"]({})
                        assert.strictEqual(navigations.length, navs)
                        assert.strictEqual(toasts.length, 0)
                    })
                    check("continue watching in the tray starts the next episode", () => {
                        const out = JSON.stringify(trays[0].renderFn())
                        assert.ok(out.includes("Weiterschauen") && out.includes("Show Season 2 · Folge 6"), out)
                        assert.ok(!out.includes("Airing Show"), "episode 4 is not out yet")
                        eventHandlers["vsx-cont-2-6"]()
                        const last = navigations[navigations.length - 1]
                        assert.strictEqual(JSON.stringify(last.params), JSON.stringify({ id: "2", tab: "onlinestream", episode: "6" }))
                    })
                    check("quick search lists your anime and opens it", () => {
                        const p = palettes[0]
                        assert.strictEqual(p.options.keyboardShortcut, "mod+k")
                        p.open()
                        assert.ok(p.items.some((i) => i.heading === "Weiterschauen"), "continue watching in quick search")
                        const item = p.items.find((i) => /Shou/.test(i.value))
                        assert.ok(item, JSON.stringify(p.items.map((i) => i.value)))
                        item.onSelect()
                        const last = navigations[navigations.length - 1]
                        assert.strictEqual(last.params.id, "1")
                    })
                    check("right-click: mark watched up to here", () => {
                        const item = menuItems.find((m) => m.kind === "newEpisodeGridItemMenuItem" && /gesehen/.test(m.props.label))
                        assert.strictEqual(item.props.type, "episodeTab:viktempest-ui")
                        item.click({ episode: { episodeNumber: 4, progressNumber: 4, baseAnime: { id: 2, episodes: 12 } } })
                        assert.deepStrictEqual(progressUpdates[0], [2, 4])
                    })
                    check("filler dimmed", () => {
                        setImmediate(() => check("filler style added", () => {
                            const st = body.children.find((c) => c.attributes["data-vsx-filler"])
                            assert.ok(st && /data-is-filler/.test(st.text) && /opacity/.test(st.text), st && st.text)
                        }))
                        const s = JSON.parse(JSON.stringify(storage.get("vsuite:settings")))
                        s.filler = "dim"
                        storage.set("vsuite:settings", s)
                        store.set("vsuite:settings", s)
                        navigateCb({ pathname: "/entry", searchParams: { id: "1" } })
                        return new Promise((r) => setImmediate(r))
                    })
                    check("settings export and import", () => {
                        page.channel.sent.length = 0
                        page.channel.handlers.export()
                        const ex = page.channel.sent.find((m) => m.name === "exported")
                        const data = JSON.parse(ex.payload.text)
                        assert.strictEqual(data.app, "viktempest-ui")
                        data.settings.sidebarHide = "manga,search,nonsense"
                        data.settings.sidebarAutoHide = "yes"
                        data.settings.filler = "not-an-option"
                        data.settings.unknownKey = "x"
                        page.channel.handlers.import({ text: JSON.stringify(data) })
                        const s = storage.get("vsuite:settings")
                        assert.strictEqual(s.sidebarHide, "manga,search")
                        assert.strictEqual(s.sidebarAutoHide, "yes")
                        assert.strictEqual(s.filler, "normal", "bad value falls back to the default")
                        assert.ok(!("unknownKey" in s))
                        page.channel.handlers.import({ text: "hello" })
                        return new Promise((r) => setImmediate(r))
                    })
                    setImmediate(() => check("bad import text is refused, sidebar style added", () => {
                        const inits = page.channel.sent.filter((m) => m.name === "init")
                        assert.ok(/kein gültiger/.test(inits[inits.length - 1].payload.msg), JSON.stringify(inits.map((i) => i.payload.msg)))
                        const st = body.children.find((c) => c.attributes["data-vsuite-layout"] && !c.removed)
                        assert.ok(st && /item-id="manga"/.test(st.text) && /item-id="search"/.test(st.text) && /translateX/.test(st.text), st && st.text)
                        assert.ok(!/discover/.test(st.text))
                    }))
                    // after the checks that wait for the page (filler style)
                    setImmediate(() => setImmediate(() => {
                        console.log(failures ? "\n" + failures + " failed" : "\nall passed")
                        process.exitCode = failures ? 1 : 0
                    }))
                }))
            })
        })
    })
})
