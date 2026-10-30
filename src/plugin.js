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
                episodesTab: "Folgen",
            },
            en: {
                label: "Season",
                season: "Season {0}",
                current: "current",
                formats: { MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", TV_SHORT: "Short", MUSIC: "Music" },
                episodesTab: "Episodes",
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
                // AniList titles already say "Season 2" etc., so only extras get a label
                const extra = isSeason ? "" : (t("formats")[node.format] || node.format || "")
                options.push({
                    id: node.id,
                    label: titleOf(node) + (extra || year ? " (" + [extra, year].filter(Boolean).join(", ") + ")" : ""),
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
                            "<option value=\"" + o.id + "\"" + (o.id === mediaId ? " selected" : "") + ">" +
                            escapeHtml(o.label) + "</option>",
                        ).join("")
                        wrap.setAttribute("class", "vtss-switcher")
                        wrap.setAttribute("data-media-id", String(mediaId))
                        // Layout and sizes (phone and desktop) come from the plugin's style sheet
                        ensureStyle()
                        wrap.setInnerHTML(
                            "<span class=\"vtss-label\">" + escapeHtml(t("label")) + "</span>" +
                            "<select class=\"vtss-select\">" + optionsHtml + "</select>",
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
        const rows = { timer: null, running: false, again: false, hidden: {}, parents: {}, swapped: {}, redirect: null }

        // PREQUEL/SEQUEL ids, start date, format, title and cover per id
        function loadRelations(ids) {
            const REL_CACHE_MS = 12 * 60 * 60 * 1000
            const rel = {}
            let wanted = ids.slice()
            for (let round = 0; round < 3 && wanted.length; round++) {
                const missing = []
                wanted.forEach((id) => {
                    if (rel[id]) return
                    const c = $store.get("vtss:info:" + id)
                    if (c && c.time && (Date.now() - c.time) < REL_CACHE_MS) rel[id] = c
                    else if (missing.indexOf(id) === -1) missing.push(id)
                })
                for (let i = 0; i < missing.length; i += 50) {
                    const res = plain($anilist.customQuery({
                        query: "query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id format season seasonYear startDate { year month day } " +
                            "title { romaji english native } coverImage { extraLarge large } " +
                            "relations { edges { relationType node { id type } } } } } }",
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
                            id: m.id, format: m.format, season: m.season, seasonYear: m.seasonYear || d.year,
                            title: m.title || {}, cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || "",
                        }
                        rel[m.id] = entry
                        $store.set("vtss:info:" + m.id, entry)
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
                            // A card of a later season: show the series under its first season
                            if (!shouldHide && !latest) {
                                const first = firstSeason(rel, find, id)
                                if (first && first.id !== id) swapCard(c, id, first)
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

        function firstSeason(rel, find, id) {
            const root = find(id)
            let best = null
            Object.keys(rel).forEach((key) => {
                const node = rel[key]
                if (!node || !node.id || find(node.id) !== root) return
                const score = (SEASON_FORMATS[node.format] ? 0 : 100000000) + node.start
                if (!best || score < best.score) best = { score: score, node: node }
            })
            return best ? best.node : null
        }

        function capitalize(s) {
            s = String(s || "").toLowerCase()
            return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
        }

        // Shows the first season's title, year and cover on the card, and opens the first season
        // when the card is clicked
        function swapCard(card, fromId, first) {
            if (rows.swapped[card.id] === first.id) return
            rows.swapped[card.id] = first.id
            const el = ctx.dom.asElement(card.id)
            // Clicking the card opens the first season instead
            el.addClass("vtss-swapped")
            ensureStyle()
            el.queryOne("[data-media-entry-card-title-section-title]").then((title) => {
                if (title) title.setText(titleOf(first))
            }).catch(() => {})
            el.queryOne("[data-media-entry-card-title-section-year-season]").then((year) => {
                if (year) year.setText((capitalize(first.season) + " " + (first.seasonYear || "")).trim())
            }).catch(() => {})
            if (first.cover) {
                el.queryOne("[data-media-entry-card-body-image]").then((image) => {
                    if (!image) return null
                    if (String(image.tagName).toUpperCase() === "IMG") return image
                    return image.queryOne("img")
                }).then((img) => {
                    if (!img) return
                    img.removeAttribute("srcset")
                    img.setAttribute("src", first.cover)
                }).catch(() => {})
            }
            el.addEventListener("click", () => {
                rows.redirect = { from: fromId, to: first.id, time: Date.now() }
                const st = ctx.screen.state && ctx.screen.state()
                const cur = st && st.get ? st.get() : null
                // The card's own link may already have opened the later season
                if (cur && cur.pathname === "/entry" && String(cur.searchParams && cur.searchParams.id) === String(fromId)) {
                    rows.redirect = null
                    ctx.screen.navigateTo("/entry", { id: String(first.id) })
                }
            })
        }

        // Season dropdown. On phones (below 1024px, where Seanime centers the title) it is centered,
        // fills the width and uses 16px text so iOS does not zoom in when it is tapped.
        const SWITCHER_CSS = " .vtss-switcher { display: flex; align-items: center; justify-content: center; gap: .6rem;" +
            " margin-top: .75rem; width: 100%; }" +
            " .vtss-label { flex: none; color: var(--muted, #a1a1aa); font-weight: 600; font-size: .95rem; }" +
            " .vtss-select { flex: 1 1 auto; min-width: 0; max-width: 32rem; min-height: 44px; color-scheme: dark;" +
            " background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.18); border-radius: .6rem;" +
            " padding: .4rem 2rem .4rem .75rem; font-size: 16px; font-weight: 600; cursor: pointer;" +
            " text-overflow: ellipsis; white-space: nowrap; overflow: hidden; backdrop-filter: blur(6px); }" +
            " .vtss-select option { background: #151515; color: #fff; }" +
            " @media (min-width: 1024px) { .vtss-switcher { justify-content: flex-start; width: auto; }" +
            " .vtss-select { flex: 0 1 auto; min-height: 0; font-size: .95rem; } }" +
            // Play symbol on episode pictures and tappable titles
            " .vtss-play { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center;" +
            " pointer-events: none; font-size: 2rem; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.8); opacity: .85; }" +
            " .vtss-tap { cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }"

        function ensureStyle() {
            if (rows.styled) return
            rows.styled = true
            ctx.dom.queryOne("#vtss-style").then((existing) => {
                if (existing) return
                return Promise.all([ctx.dom.createElement("style"), ctx.dom.queryOne("body")]).then((res) => {
                    const style = res[0], body = res[1]
                    if (!style || !body) return
                    style.setAttribute("id", "vtss-style")
                    // Popup and badges still describe the later season, so they are hidden on
                    // cards that show the first season
                    style.setText([
                        "[data-media-entry-card-hover-popup]",
                        "[data-media-entry-card-body-progress-badge-container]",
                        "[data-media-entry-card-body-score-badge-container]",
                        "[data-media-entry-card-body-releasing-badge-container]",
                        "[data-media-entry-card-body-missing-episodes-badge-container]",
                        "[data-media-entry-card-body-progress-bar-container]",
                    ].map((sel) => ".vtss-swapped " + sel).join(", ") + " { display: none !important; }" +
                        (forceInfo ? " [data-anime-entry-page-tabs-container] { display: none !important; }" : "") +
                        SWITCHER_CSS)
                    body.append(style)
                })
            }).catch(() => {
                rows.styled = false
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

        // Seanime only picks the view (episode list, online streaming, ...) when an anime page
        // opens, so to switch it the plugin leaves the page for a moment (via the home page, so the
        // back button leads there) and comes back with the view in the address
        function reopenEntry(mediaId, params) {
            ctx.screen.navigateTo("/")
            ctx.setTimeout(() => {
                const q = { id: String(mediaId) }
                Object.keys(params).forEach((k) => q[k] = String(params[k]))
                ctx.screen.navigateTo("/entry", q)
            }, 60)
        }

        function playEpisode(mediaId, episodeNumber) {
            reopenEntry(mediaId, { tab: "onlinestream", episode: episodeNumber })
        }

        // -----------------------------------------------------------------------------------------
        // Info page
        //
        // Instead of starting the online stream right away, anime pages open on the plugin's own
        // "Episodes" tab: Seanime's episode list with pictures and descriptions. The stream only
        // starts when you click an episode. The source tabs (Local library, Online streaming, ...)
        // are hidden.

        const INFO_TAB = "ext:viktempest-season-switcher"
        const forceInfo = pref("infoPage", "yes") === "yes"

        ctx.anime.registerEntryEpisodeTab({
            name: t("episodesTab"),
            icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' width='18' height='18'><path d='M4 5h16v2H4zm0 6h10v2H4zm0 6h10v2H4zm13-5 5 3.5-5 3.5z'/></svg>",
            shouldShow: () => true,
            onSelectEpisode: (e) => {
                if (e && e.mediaId && e.episodeNumber) playEpisode(e.mediaId, e.episodeNumber)
            },
        })

        // Returns true when the page is being replaced
        function routeToInfoPage(pathname, params, prev) {
            if (!forceInfo || pathname !== "/entry") return false
            const id = String((params && params.id) || "")
            if (!id) return false
            const tab = String((params && params.tab) || "")
            const prevSame = prev && prev.pathname === "/entry" && prev.id === id
            if (tab) return false
            if (prevSame) {
                // Back button from the info page: don't bounce back into it
                if (prev.tab === INFO_TAB) {
                    ctx.screen.navigateTo("/")
                    return true
                }
                // Seanime removes ?episode=… from the address once the stream plays
                return false
            }
            ctx.screen.navigateTo("/entry", { id: id, tab: INFO_TAB })
            return true
        }

        // If Seanime had already chosen online streaming before the address changed (cached
        // page), the info tab is ignored; then reopen the page once more
        const ONLINE_VIEW = "[data-anime-entry-page-online-streaming-view]"
        function checkOnlineView() {
            const loc = state.loc
            if (!forceInfo || !loc || loc.pathname !== "/entry" || loc.tab !== INFO_TAB) return
            if (state.reopened === loc.id) return
            state.reopened = loc.id
            reopenEntry(loc.id, { tab: INFO_TAB })
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
                image.addClass("vtss-tap")
                image.addEventListener("click", onClick)
                return ctx.dom.createElement("div").then((overlay) => {
                    overlay.setAttribute("class", "vtss-play")
                    overlay.setText("▶")
                    image.append(overlay)
                })
            }).catch(() => {})
            item.queryOne("[data-episode-grid-item-title]").then((title) => {
                if (!title) return
                title.addClass("vtss-tap")
                title.addEventListener("click", onClick)
            }).catch(() => {})
        }

        function onPage(pathname, searchParams) {
            const prev = state.loc
            state.loc = {
                pathname: pathname,
                id: String((searchParams && searchParams.id) || ""),
                tab: String((searchParams && searchParams.tab) || ""),
            }
            if (pathname === "/entry" && state.loc.id !== state.reopened) state.reopened = ""
            // Clicked a home page card that shows a first season but links to a later one
            const r = rows.redirect
            if (r && pathname === "/entry" && state.loc.id === String(r.from)) {
                rows.redirect = null
                if (Date.now() - r.time < 5000) {
                    ctx.screen.navigateTo("/entry", forceInfo ? { id: String(r.to), tab: INFO_TAB } : { id: String(r.to) })
                    return
                }
            }
            if (routeToInfoPage(pathname, searchParams, prev)) return
            if (state.pathname !== pathname) {
                state.pathname = pathname
                rows.hidden = {}
                rows.parents = {}
                rows.swapped = {}
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
            ctx.dom.observe(ONLINE_VIEW, (elements) => {
                if (elements && elements.length) checkOnlineView()
            })
            ensureStyle()
            // Cards on the home page appear while rows load and scroll into view
            ctx.dom.observe(CARD, () => scheduleMergeRows())
            ctx.screen.onNavigate((e) => onPage(e.pathname, e.searchParams))
            ctx.screen.loadCurrent()
        })
    })
}
