/// <reference path="./plugin.d.ts" />
/// <reference path="./app.d.ts" />

// Season Switcher for Seanime
//
// Shows every series only once on the home page (library sections and "Continue watching"), and
// adds a dropdown below the title on anime pages that lists every season of the franchise
// (found through the AniList PREQUEL/SEQUEL relations, e.g. The Apothecary Diaries S1, S2, S3).
// Episodes on the info page of an anime you don't have on disk start online streaming when clicked.
// Picking an entry opens that season's page. Your lists are not touched.
//
// UI language: German, English (plugin setting "language").

function init() {

    // ---------------------------------------------------------------------------------------------
    // Library merge hooks.
    //
    // Seanime builds the library (home page) from your list entries. These hooks keep only one card
    // per series in each section (e.g. "Currently watching", "Completed") and only one episode per
    // series in "Continue watching". Your lists on AniList are not changed.
    // Hooks run in their own runtime from their source text, so everything they need is inside them.

    // One function for both hooks; Seanime compiles it from its source text, so it must not use
    // anything from outside.
    function vtssMergeHook(e) {
        try {
            let enabled = "yes", keep = "first"
            try {
                enabled = $getUserPreference("mergeLibrary") || "yes"
                keep = $getUserPreference("mergeKeep") || "first"
            }
            catch (err) {}
            // Library collection (local files) or stream collection (streaming "include in library")
            const lc = e.libraryCollection || e.streamCollection
            if (enabled === "yes" && lc) {
                const ids = []
                ;(lc.lists || []).forEach((list) => (list.entries || []).forEach((entry) => {
                    if (entry && entry.mediaId) ids.push(entry.mediaId)
                }))
                ;(lc.anime || []).forEach((media) => {
                    if (media && media.id) ids.push(media.id)
                })
                ;(lc.continueWatchingList || []).forEach((ep) => {
                    if (ep && ep.baseAnime && ep.baseAnime.id) ids.push(ep.baseAnime.id)
                })

                // Relations (PREQUEL/SEQUEL) of every id, cached for 12 hours and fetched 50 at a time
                const CACHE_MS = 12 * 60 * 60 * 1000
                const rel = {}
                // Three rounds, so seasons are also connected through entries that are not shown here
                // (e.g. Season 1 and 3 in this section, Season 2 somewhere else or not on your list)
                let wanted = ids.slice()
                for (let round = 0; round < 3 && wanted.length; round++) {
                    const missing = []
                    wanted.forEach((id) => {
                        if (rel[id]) return
                        const c = $store.get("vtss:rel:" + id)
                        if (c && c.time && (Date.now() - c.time) < CACHE_MS) rel[id] = c.rel
                        else if (missing.indexOf(id) === -1) missing.push(id)
                    })
                    for (let i = 0; i < missing.length; i += 50) {
                        const chunk = missing.slice(i, i + 50)
                        try {
                            const res = JSON.parse(JSON.stringify($anilist.customQuery({
                                query: "query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id startDate { year month day } relations { edges { relationType node { id type } } } } } }",
                                variables: { ids: chunk },
                            }, "")))
                            const page = (res && (res.Page || (res.data && res.data.Page))) || {}
                            ;(page.media || []).forEach((m) => {
                                const r = []
                                ;((m.relations && m.relations.edges) || []).forEach((edge) => {
                                    if (edge && edge.node && edge.node.type === "ANIME" &&
                                        (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL")) r.push(edge.node.id)
                                })
                                rel[m.id] = r
                                const d = m.startDate || {}
                                $store.set("vtss:rel:" + m.id, {
                                    time: Date.now(), rel: r,
                                    start: d.year ? d.year * 10000 + (d.month || 12) * 100 + (d.day || 28) : 99999999,
                                })
                            })
                        }
                        catch (err) {
                            console.warn("season-switcher: could not load relations", err)
                        }
                    }
                    const next = []
                    wanted.forEach((id) => (rel[id] || []).forEach((other) => {
                        if (!rel[other] && next.indexOf(other) === -1) next.push(other)
                    }))
                    wanted = next
                }

                // Union-find: ids connected through PREQUEL/SEQUEL belong to the same series. A movie
                // between two seasons connects them even when it is not on your list.
                const parent = {}
                const find = (x) => {
                    while (parent[x] !== undefined && parent[x] !== x) x = parent[x]
                    return x
                }
                const union = (a, b) => {
                    if (parent[a] === undefined) parent[a] = a
                    if (parent[b] === undefined) parent[b] = b
                    const ra = find(a), rb = find(b)
                    if (ra !== rb) parent[rb] = ra
                }
                Object.keys(rel).forEach((key) => {
                    const id = parseInt(key, 10)
                    if (parent[id] === undefined) parent[id] = id
                    ;(rel[key] || []).forEach((other) => union(id, other))
                })

                const dateKey = (media) => {
                    const d = (media && media.startDate) || {}
                    if (!d.year) return 99999999
                    return d.year * 10000 + (d.month || 12) * 100 + (d.day || 28)
                }

                // Keeps one item per series, at the position of the first one
                const merge = (items, mediaOf, latest) => {
                    const best = {}
                    items.forEach((item, i) => {
                        const media = mediaOf(item)
                        if (!media || !media.id) return
                        const root = find(media.id)
                        const cur = best[root]
                        const k = dateKey(media)
                        if (!cur) best[root] = { i: i, k: k, pos: i }
                        else if (latest ? k > cur.k : k < cur.k) best[root] = { i: i, k: k, pos: cur.pos }
                    })
                    const out = []
                    const byPos = {}
                    Object.keys(best).forEach((root) => {
                        byPos[best[root].pos] = best[root].i
                    })
                    items.forEach((item, i) => {
                        const media = mediaOf(item)
                        if (!media || !media.id) out.push(item)
                        else if (byPos[i] !== undefined) out.push(items[byPos[i]])
                    })
                    return out
                }

                ;(lc.lists || []).forEach((list) => {
                    if (list.entries && list.entries.length > 1) {
                        list.entries = merge(list.entries, (entry) => entry && entry.media, keep === "latest")
                    }
                })
                if (lc.anime && lc.anime.length > 1) {
                    lc.anime = merge(lc.anime, (media) => media, keep === "latest")
                }
                // Continue watching: the earliest season is the one you are actually on
                if (lc.continueWatchingList && lc.continueWatchingList.length > 1) {
                    lc.continueWatchingList = merge(lc.continueWatchingList, (ep) => ep && ep.baseAnime, false)
                }
            }
        }
        catch (err) {
            console.error("season-switcher: library merge failed", err)
        }
        e.next()
    }

    $app.onAnimeLibraryCollection(vtssMergeHook)
    $app.onAnimeLibraryStreamCollection(vtssMergeHook)

    $ui.register((ctx) => {

        // -----------------------------------------------------------------------------------------
        // Settings and translations

        function pref(key, fallback) {
            try {
                const v = $getUserPreference(key)
                return v === undefined || v === null || v === "" ? fallback : String(v)
            }
            catch (e) {
                return fallback
            }
        }

        const I18N = {
            de: {
                label: "Staffel",
                season: "Staffel {0}",
                current: "aktuell",
                formats: { MOVIE: "Film", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", TV_SHORT: "Kurzserie", MUSIC: "Musik" },
            },
            en: {
                label: "Season",
                season: "Season {0}",
                current: "current",
                formats: { MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", TV_SHORT: "Short", MUSIC: "Music" },
            },
        }
        const lang = I18N[pref("language", "de")] ? pref("language", "de") : "de"

        function t(key, arg) {
            const s = I18N[lang][key]
            return arg === undefined ? s : String(s).replace("{0}", String(arg))
        }

        const titleLanguage = pref("titleLanguage", "english")
        const includeExtras = pref("includeExtras", "no") === "yes"

        // Formats that count as a season. Everything else (movies, OVAs, specials) is only shown
        // when "includeExtras" is on, but is always walked through so a movie between two seasons
        // does not break the chain.
        const SEASON_FORMATS = { TV: true, TV_SHORT: true, ONA: true }
        const MAX_ENTRIES = 40
        const CACHE_MS = 6 * 60 * 60 * 1000

        // -----------------------------------------------------------------------------------------
        // AniList

        const FIELDS = "id type format status episodes seasonYear startDate { year month day } title { romaji english native }"
        // Two levels of relations per request, so a chain of seasons needs only about half as many
        // requests as it has entries.
        const QUERY = "query ($id: Int) { Media(id: $id) { " + FIELDS +
            " relations { edges { relationType node { " + FIELDS +
            " relations { edges { relationType node { " + FIELDS + " } } } } } } } }"

        function plain(v) {
            return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v))
        }

        function cacheGet(id) {
            const v = $store.get("vtss:node:" + id)
            return v && v.time && (Date.now() - v.time) < CACHE_MS ? v : null
        }

        function remember(media, withRelations) {
            if (!media || !media.id) return
            const old = cacheGet(media.id)
            const node = {
                time: Date.now(),
                id: media.id,
                type: media.type,
                format: media.format,
                status: media.status,
                episodes: media.episodes,
                seasonYear: media.seasonYear,
                startDate: media.startDate || {},
                title: media.title || {},
                rel: old ? old.rel : null,
            }
            if (withRelations) {
                const edges = (media.relations && media.relations.edges) || []
                node.rel = []
                edges.forEach((edge) => {
                    if (!edge || !edge.node) return
                    node.rel.push({ type: edge.relationType, id: edge.node.id, mediaType: edge.node.type })
                    remember(edge.node, !!edge.node.relations)
                })
            }
            $store.set("vtss:node:" + media.id, node)
        }

        function fetchMedia(id) {
            const res = plain($anilist.customQuery({ query: QUERY, variables: { id: id } }, ""))
            const media = res && (res.Media || (res.data && res.data.Media))
            if (!media) throw new Error("no media " + id)
            remember(media, true)
        }

        // All anime connected to this one through PREQUEL/SEQUEL, sorted by start date.
        function loadFranchise(startId) {
            const seen = {}
            const result = []
            const queue = [startId]
            while (queue.length && result.length < MAX_ENTRIES) {
                const id = queue.shift()
                if (seen[id]) continue
                seen[id] = true
                let node = cacheGet(id)
                if (!node || !node.rel) {
                    fetchMedia(id)
                    node = cacheGet(id)
                }
                if (!node) continue
                result.push(node)
                ;(node.rel || []).forEach((r) => {
                    if ((r.type === "PREQUEL" || r.type === "SEQUEL") && r.mediaType !== "MANGA" && !seen[r.id]) queue.push(r.id)
                })
            }
            result.sort((a, b) => dateKey(a) - dateKey(b) || a.id - b.id)
            return result
        }

        function dateKey(node) {
            const d = node.startDate || {}
            if (!d.year) return 99999999
            return d.year * 10000 + (d.month || 12) * 100 + (d.day || 28)
        }

        // -----------------------------------------------------------------------------------------
        // Dropdown entries

        function titleOf(node) {
            const tl = node.title || {}
            if (titleLanguage === "native") return tl.native || tl.romaji || tl.english || ("#" + node.id)
            if (titleLanguage === "romaji") return tl.romaji || tl.english || tl.native || ("#" + node.id)
            return tl.english || tl.romaji || tl.native || ("#" + node.id)
        }

        function buildOptions(franchise, currentId) {
            const options = []
            let season = 0
            franchise.forEach((node) => {
                const isSeason = !!SEASON_FORMATS[node.format]
                if (isSeason) season++
                if (!isSeason && !includeExtras && node.id !== currentId) return
                const year = (node.startDate && node.startDate.year) || node.seasonYear
                const prefix = isSeason ? t("season", season) : (t("formats")[node.format] || node.format || "?")
                options.push({
                    id: node.id,
                    label: prefix + " · " + titleOf(node) + (year ? " (" + year + ")" : ""),
                })
            })
            return options
        }

        function escapeHtml(s) {
            return String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
        }

        // -----------------------------------------------------------------------------------------
        // Page integration

        const TITLE_CONTAINER = "[data-media-page-header-entry-details-title-container]"
        const state = { mediaId: 0, options: null, injecting: false, pathname: "" }

        function removeSwitchers() {
            return ctx.dom.query(".vtss-switcher")
                .then((els) => (els || []).forEach((el) => el.remove()))
                .catch(() => {})
        }

        function inject() {
            const mediaId = state.mediaId
            const options = state.options
            if (!mediaId || !options || options.length < 2 || state.injecting) return
            state.injecting = true

            ctx.dom.queryOne(".vtss-switcher")
                .then((existing) => {
                    if (existing) {
                        return Promise.resolve(existing.getAttribute("data-media-id")).then((id) => {
                            if (String(id) === String(mediaId)) return null
                            existing.remove()
                            return ctx.dom.queryOne(TITLE_CONTAINER)
                        })
                    }
                    return ctx.dom.queryOne(TITLE_CONTAINER)
                })
                .then((title) => {
                    if (!title || state.mediaId !== mediaId) return
                    return ctx.dom.createElement("div").then((wrap) => {
                        const optionsHtml = options.map((o) =>
                            "<option value=\"" + o.id + "\"" + (o.id === mediaId ? " selected" : "") +
                            " style=\"background:#151515;color:#fff\">" + escapeHtml(o.label) + "</option>",
                        ).join("")
                        wrap.setAttribute("class", "vtss-switcher")
                        wrap.setAttribute("data-media-id", String(mediaId))
                        wrap.setCssText("display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-top:.75rem;")
                        wrap.setInnerHTML(
                            "<span style=\"color:var(--muted, #a1a1aa);font-weight:600;font-size:.95rem\">" + escapeHtml(t("label")) + "</span>" +
                            "<select class=\"vtss-select\" style=\"color-scheme:dark;background:rgba(0,0,0,.45);color:#fff;" +
                            "border:1px solid rgba(255,255,255,.18);border-radius:.6rem;padding:.4rem 2rem .4rem .75rem;" +
                            "font-size:.95rem;font-weight:600;max-width:min(90vw,32rem);cursor:pointer;backdrop-filter:blur(6px)\">" +
                            optionsHtml + "</select>",
                        )
                        title.after(wrap)
                        return wrap.queryOne("select").then((select) => {
                            if (!select) return
                            select.addEventListener("change", () => {
                                Promise.resolve(select.getProperty("value")).then((value) => {
                                    const id = parseInt(String(value), 10)
                                    if (id && id !== state.mediaId) ctx.screen.navigateTo("/entry", { id: String(id) })
                                })
                            })
                        })
                    })
                })
                .catch((e) => console.warn("season-switcher: could not add the dropdown", e))
                .then(() => {
                    state.injecting = false
                })
        }

        // -----------------------------------------------------------------------------------------
        // Home page rows
        //
        // Rows like genre carousels ("Romance") are loaded straight from AniList by the page, so the
        // library hooks can't touch them. Here the plugin looks at the cards on the home page and
        // hides every further card of a series that already has one in the same row.

        const CARD = "[data-media-entry-card-container][data-media-id]"
        const rows = { timer: null, running: false, again: false, hidden: {}, parents: {} }

        // PREQUEL/SEQUEL ids and start date per id, shared with the library hook through $store
        function loadRelations(ids) {
            const REL_CACHE_MS = 12 * 60 * 60 * 1000
            const rel = {}
            let wanted = ids.slice()
            for (let round = 0; round < 3 && wanted.length; round++) {
                const missing = []
                wanted.forEach((id) => {
                    if (rel[id]) return
                    const c = $store.get("vtss:rel:" + id)
                    if (c && c.time && (Date.now() - c.time) < REL_CACHE_MS && c.start !== undefined) rel[id] = c
                    else if (missing.indexOf(id) === -1) missing.push(id)
                })
                for (let i = 0; i < missing.length; i += 50) {
                    const res = plain($anilist.customQuery({
                        query: "query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id startDate { year month day } relations { edges { relationType node { id type } } } } } }",
                        variables: { ids: missing.slice(i, i + 50) },
                    }, ""))
                    const page = (res && (res.Page || (res.data && res.data.Page))) || {}
                    ;(page.media || []).forEach((m) => {
                        const r = []
                        ;((m.relations && m.relations.edges) || []).forEach((edge) => {
                            if (edge && edge.node && edge.node.type === "ANIME" &&
                                (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL")) r.push(edge.node.id)
                        })
                        const d = m.startDate || {}
                        const entry = {
                            time: Date.now(), rel: r,
                            start: d.year ? d.year * 10000 + (d.month || 12) * 100 + (d.day || 28) : 99999999,
                        }
                        rel[m.id] = entry
                        $store.set("vtss:rel:" + m.id, entry)
                    })
                }
                const next = []
                wanted.forEach((id) => ((rel[id] && rel[id].rel) || []).forEach((other) => {
                    if (!rel[other] && next.indexOf(other) === -1) next.push(other)
                }))
                wanted = next
            }
            return rel
        }

        function seriesRoots(rel) {
            const parent = {}
            const find = (x) => {
                while (parent[x] !== undefined && parent[x] !== x) x = parent[x]
                return x
            }
            Object.keys(rel).forEach((key) => {
                const id = parseInt(key, 10)
                if (parent[id] === undefined) parent[id] = id
                ;(rel[key].rel || []).forEach((other) => {
                    if (parent[other] === undefined) parent[other] = other
                    const ra = find(id), rb = find(other)
                    if (ra !== rb) parent[rb] = ra
                })
            })
            return find
        }

        // The element that takes the card's place in the row: the card itself, or its wrapper when
        // the wrapper holds only this card (e.g. a carousel slide)
        function slotOf(card) {
            if (rows.parents[card.id]) return Promise.resolve(rows.parents[card.id])
            return card.getParent().then((parent) => {
                if (!parent) return null
                return parent.getChildren().then((children) => {
                    if (children && children.length === 1) {
                        return parent.getParent().then((grand) => ({ hide: parent.id, row: grand ? grand.id : parent.id }))
                    }
                    return { hide: card.id, row: parent.id }
                })
            }).then((slot) => {
                if (slot) rows.parents[card.id] = slot
                return slot
            })
        }

        function mergeRows() {
            if (rows.running) {
                rows.again = true
                return
            }
            if (state.pathname !== "/" || pref("mergeLibrary", "yes") !== "yes") return
            rows.running = true
            const latest = pref("mergeKeep", "first") === "latest"

            ctx.dom.query(CARD)
                .then((cards) => {
                    cards = (cards || []).filter((c) => c && c.attributes && c.attributes["data-media-type"] !== "manga")
                    const ids = []
                    cards.forEach((c) => {
                        const id = parseInt(String(c.attributes["data-media-id"] || ""), 10)
                        if (id && ids.indexOf(id) === -1) ids.push(id)
                    })
                    if (!ids.length) return
                    const rel = loadRelations(ids)
                    const find = seriesRoots(rel)
                    return Promise.all(cards.map((c) => slotOf(c).catch(() => null))).then((slots) => {
                        // Per row and series: the card to keep
                        const keep = {}
                        cards.forEach((c, i) => {
                            const slot = slots[i]
                            if (!slot) return
                            const id = parseInt(String(c.attributes["data-media-id"]), 10)
                            const key = slot.row + ":" + find(id)
                            const start = rel[id] ? rel[id].start : 99999999
                            const cur = keep[key]
                            if (!cur || (latest ? start > cur.start : start < cur.start)) keep[key] = { hide: slot.hide, start: start }
                        })
                        cards.forEach((c, i) => {
                            const slot = slots[i]
                            if (!slot) return
                            const id = parseInt(String(c.attributes["data-media-id"]), 10)
                            const shouldHide = keep[slot.row + ":" + find(id)].hide !== slot.hide
                            if (shouldHide && !rows.hidden[slot.hide]) {
                                rows.hidden[slot.hide] = true
                                ctx.dom.asElement(slot.hide).setStyle("display", "none")
                            }
                            else if (!shouldHide && rows.hidden[slot.hide]) {
                                delete rows.hidden[slot.hide]
                                ctx.dom.asElement(slot.hide).removeStyle("display")
                            }
                        })
                    })
                })
                .catch((e) => console.warn("season-switcher: could not merge rows", e))
                .then(() => {
                    rows.running = false
                    if (rows.again) {
                        rows.again = false
                        scheduleMergeRows()
                    }
                })
        }

        function scheduleMergeRows() {
            if (state.pathname !== "/") return
            if (rows.timer) rows.timer()
            rows.timer = ctx.setTimeout(() => {
                rows.timer = null
                mergeRows()
            }, 400)
        }

        // -----------------------------------------------------------------------------------------
        // Clickable episodes
        //
        // On the info page of an anime that is not on your disk, Seanime lists the episodes but
        // clicking them does nothing. Here a click on the picture or title opens online streaming
        // with exactly that episode. Seanime only picks the view when the page opens, so the plugin
        // leaves the page for a moment and comes back with the episode in the address.

        const EPISODE = "[data-undownloaded-episode-list] [data-episode-grid-item][data-episode-number]"
        const episodes = { done: {} }

        function playEpisode(mediaId, episodeNumber) {
            ctx.screen.navigateTo("/settings")
            ctx.setTimeout(() => {
                ctx.screen.navigateTo("/entry", { id: String(mediaId), tab: "onlinestream", episode: String(episodeNumber) })
            }, 60)
        }

        function setupEpisode(item) {
            if (!item || episodes.done[item.id]) return
            const mediaId = parseInt(String(item.attributes["data-media-id"] || state.mediaId || ""), 10)
            const episodeNumber = parseInt(String(item.attributes["data-episode-number"] || ""), 10)
            if (!mediaId || !episodeNumber) return
            episodes.done[item.id] = true

            const onClick = () => playEpisode(mediaId, episodeNumber)
            item.queryOne("[data-episode-grid-item-image-container]").then((image) => {
                if (!image) return
                image.setStyle("cursor", "pointer")
                image.addEventListener("click", onClick)
                return ctx.dom.createElement("div").then((overlay) => {
                    overlay.setAttribute("class", "vtss-play")
                    overlay.setCssText("position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;" +
                        "pointer-events:none;font-size:2rem;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.8);opacity:.85")
                    overlay.setText("▶")
                    image.append(overlay)
                })
            }).catch(() => {})
            item.queryOne("[data-episode-grid-item-title]").then((title) => {
                if (!title) return
                title.setStyle("cursor", "pointer")
                title.addEventListener("click", onClick)
            }).catch(() => {})
        }

        function onPage(pathname, searchParams) {
            if (state.pathname !== pathname) {
                state.pathname = pathname
                rows.hidden = {}
                rows.parents = {}
                episodes.done = {}
                scheduleMergeRows()
            }
            const id = pathname === "/entry" ? parseInt(String((searchParams && searchParams.id) || ""), 10) : 0
            if (id === state.mediaId) return
            state.mediaId = id || 0
            state.options = null
            removeSwitchers()
            if (!id) return

            // Let the page start rendering before the (blocking) AniList request
            ctx.setTimeout(() => {
                if (state.mediaId !== id) return
                try {
                    const options = buildOptions(loadFranchise(id), id)
                    if (state.mediaId !== id) return
                    state.options = options
                    inject()
                }
                catch (e) {
                    console.warn("season-switcher: could not load seasons for " + id, e)
                }
            }, 50)
        }

        ctx.dom.onReady(() => {
            // The header is rendered after the page data has loaded and can be re-rendered,
            // so add the dropdown whenever the title container (re)appears.
            ctx.dom.observe(TITLE_CONTAINER, (elements) => {
                if (elements && elements.length) inject()
            })
            ctx.dom.observe(EPISODE, (elements) => {
                if (pref("episodeClick", "yes") !== "yes") return
                ;(elements || []).forEach(setupEpisode)
            })
            // Cards on the home page appear while rows load and scroll into view
            ctx.dom.observe(CARD, () => scheduleMergeRows())
            ctx.screen.onNavigate((e) => onPage(e.pathname, e.searchParams))
            ctx.screen.loadCurrent()
        })
    })
}
