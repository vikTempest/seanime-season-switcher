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
// UI language: German, English, Spanish, Portuguese, Japanese (setting "language").

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
                // Several rounds, so seasons are also connected through entries that are not shown here
                // (e.g. Season 1 and 3 in this section, Season 2 somewhere else or not on your list)
                let wanted = ids.slice()
                for (let round = 0; round < 8 && wanted.length; round++) {
                    const missing = []
                    wanted.forEach((id) => {
                        if (rel[id]) return
                        const c = $store.get("vtss:rel:" + id)
                        if (c && c.time && (Date.now() - c.time) < CACHE_MS) rel[id] = c.rel
                        else if (missing.indexOf(id) === -1) missing.push(id)
                    })
                    for (let i = 0; i < missing.length; i += 25) {
                        const chunk = missing.slice(i, i + 25)
                        try {
                            const res = JSON.parse(JSON.stringify($anilist.customQuery({
                                query: "query ($ids: [Int]) { Page(perPage: 25) { media(id_in: $ids, type: ANIME) { id startDate { year month day } relations { edges { relationType node { id type } } } } } }",
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
                watched: "✓ Gesehen",
                next: "▶ Weiterschauen",
                minutes: "{0} min geschaut",
                continueWatching: "Weiterschauen",
                toEpisodes: "Folgenübersicht",
                playFailed: "Der Stream konnte nicht geöffnet werden. Ist Online-Streaming in den Einstellungen aktiv?",
                defaultSet: "Season Switcher: Anime-Seiten öffnen ab jetzt mit der Folgenliste.",
                notOnList: "nicht auf deiner Liste",
                seasons: "{0} Staffeln",
                rateLimit: "AniList ist gerade ausgelastet. Die Staffeln werden in etwa einer Minute geladen.",
            },
            en: {
                label: "Season",
                season: "Season {0}",
                current: "current",
                formats: { MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", TV_SHORT: "Short", MUSIC: "Music" },
                episodesTab: "Episodes",
                watched: "✓ Watched",
                next: "▶ Continue",
                minutes: "{0} min watched",
                continueWatching: "Continue watching",
                toEpisodes: "All episodes",
                playFailed: "Could not open the stream. Is online streaming enabled in the settings?",
                defaultSet: "Season Switcher: anime pages now open on the episode list.",
                notOnList: "not on your list",
                seasons: "{0} seasons",
                rateLimit: "AniList is busy right now. The seasons will load in about a minute.",
            },
            es: {
                label: "Temporada",
                season: "Temporada {0}",
                current: "actual",
                formats: { MOVIE: "Película", OVA: "OVA", ONA: "ONA", SPECIAL: "Especial", TV_SHORT: "Corto", MUSIC: "Música" },
                episodesTab: "Episodios",
                watched: "✓ Visto",
                next: "▶ Continuar",
                minutes: "{0} min vistos",
                continueWatching: "Seguir viendo",
                toEpisodes: "Todos los episodios",
                playFailed: "No se pudo abrir el stream. ¿Está activado el streaming online en los ajustes?",
                defaultSet: "Season Switcher: las páginas de anime se abren ahora con la lista de episodios.",
                notOnList: "no está en tu lista",
                seasons: "{0} temporadas",
                rateLimit: "AniList está ocupado. Las temporadas se cargarán en un minuto.",
            },
            pt: {
                label: "Temporada",
                season: "Temporada {0}",
                current: "atual",
                formats: { MOVIE: "Filme", OVA: "OVA", ONA: "ONA", SPECIAL: "Especial", TV_SHORT: "Curta", MUSIC: "Música" },
                episodesTab: "Episódios",
                watched: "✓ Assistido",
                next: "▶ Continuar",
                minutes: "{0} min assistidos",
                continueWatching: "Continuar assistindo",
                toEpisodes: "Todos os episódios",
                playFailed: "Não foi possível abrir o stream. O streaming online está ativado nas configurações?",
                defaultSet: "Season Switcher: as páginas de anime agora abrem com a lista de episódios.",
                notOnList: "não está na sua lista",
                seasons: "{0} temporadas",
                rateLimit: "O AniList está ocupado. As temporadas serão carregadas em cerca de um minuto.",
            },
            ja: {
                label: "シーズン",
                season: "シーズン{0}",
                current: "現在",
                formats: { MOVIE: "映画", OVA: "OVA", ONA: "ONA", SPECIAL: "スペシャル", TV_SHORT: "ショート", MUSIC: "音楽" },
                episodesTab: "エピソード",
                watched: "✓ 視聴済み",
                next: "▶ 続きから",
                minutes: "{0}分視聴",
                continueWatching: "続きを見る",
                toEpisodes: "エピソード一覧",
                playFailed: "ストリームを開けませんでした。設定でオンラインストリーミングが有効になっていますか？",
                defaultSet: "Season Switcher: アニメのページはエピソード一覧で開くようになりました。",
                notOnList: "リストにありません",
                seasons: "{0}シーズン",
                rateLimit: "AniListが混み合っています。約1分後にシーズンを読み込みます。",
            },
        }
        // Read when used, so a change on the settings page applies on the next page
        function lang() {
            const l = pref("language", "de")
            return I18N[l] ? l : "en"
        }

        function t(key, arg) {
            const table = I18N[lang()]
            const s = table[key] !== undefined ? table[key] : I18N.en[key]
            return arg === undefined ? s : String(s).replace("{0}", String(arg))
        }

        const titleLanguage = () => pref("titleLanguage", "english")
        const includeExtras = () => pref("includeExtras", "no") === "yes"

        // Formats that count as a season. Everything else (movies, OVAs, specials) is only shown
        // when "includeExtras" is on, but is always walked through so a movie between two seasons
        // does not break the chain.
        const SEASON_FORMATS = { TV: true, TV_SHORT: true, ONA: true }
        const MAX_ENTRIES = 40
        // Same as the library hook above: AniList data is kept 12 hours
        const CACHE_MS = 12 * 60 * 60 * 1000

        // -----------------------------------------------------------------------------------------
        // AniList

        const FIELDS = "id type format status episodes seasonYear startDate { year month day } title { romaji english native }"
        // Two levels of relations per request, so a chain of seasons needs only about half as many
        // requests as it has entries.
        const QUERY = "query ($id: Int) { Media(id: $id) { " + FIELDS +
            " relations { edges { relationType node { " + FIELDS +
            " relations { edges { relationType node { " + FIELDS + " } } } } } } } }"

        // AniList allows only a few requests per minute, shared with Seanime. Say so once instead
        // of silently showing no seasons.
        let rateLimitToast = 0
        function checkRateLimit(e) {
            const msg = String((e && (e.message || e)) || "")
            if (!/429|too many|rate.?limit/i.test(msg)) return
            if (Date.now() - rateLimitToast < 120000) return
            rateLimitToast = Date.now()
            ctx.toast.warning(t("rateLimit"))
        }

        // Tells the settings page that a part of Seanime's page was found (see "Status" there)
        function health(name) {
            try {
                if (typeof vsHealth === "function") vsHealth(name)
            }
            catch (e) {}
        }

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
            const tlang = titleLanguage()
            if (tlang === "native") return tl.native || tl.romaji || tl.english || ("#" + node.id)
            if (tlang === "romaji") return tl.romaji || tl.english || tl.native || ("#" + node.id)
            return tl.english || tl.romaji || tl.native || ("#" + node.id)
        }

        // Your list entries (status and watched episodes) per anime id, from Seanime's copy of your
        // AniList collection. Kept for a minute so switching pages doesn't read it every time.
        const listCache = { time: 0, map: null }
        function listEntries() {
            if (listCache.map && Date.now() - listCache.time < 60000) return listCache.map
            const map = {}
            try {
                const col = plain($anilist.getAnimeCollection(false))
                const lists = (col && col.MediaListCollection && col.MediaListCollection.lists) || []
                lists.forEach((list) => ((list && list.entries) || []).forEach((entry) => {
                    if (entry && entry.media && entry.media.id) map[entry.media.id] = { status: entry.status, progress: entry.progress || 0 }
                }))
            }
            catch (e) {
                console.warn("season-switcher: could not read your list", e)
                return null
            }
            listCache.time = Date.now()
            listCache.map = map
            return map
        }

        // "✓" in front when finished, "· 5/12" behind while watching, or "· not on your list"
        function withProgress(label, node, entries) {
            if (!entries) return label
            const entry = entries[node.id]
            if (!entry) return label + " · " + t("notOnList")
            if (entry.status === "COMPLETED") return "✓ " + label
            if ((entry.status === "CURRENT" || entry.status === "PAUSED" || entry.status === "REPEATING") && entry.progress > 0) {
                return label + " · " + entry.progress + "/" + (node.episodes || "?")
            }
            return label
        }

        function buildOptions(franchise, currentId) {
            const entries = pref("showProgress", "yes") === "yes" ? listEntries() : null
            const options = []
            let season = 0
            franchise.forEach((node) => {
                const isSeason = !!SEASON_FORMATS[node.format]
                if (isSeason) season++
                if (!isSeason && !includeExtras() && node.id !== currentId) return
                const year = (node.startDate && node.startDate.year) || node.seasonYear
                // AniList titles already say "Season 2" etc., so only extras get a label
                const extra = isSeason ? "" : (t("formats")[node.format] || node.format || "")
                options.push({
                    id: node.id,
                    label: withProgress(titleOf(node) + (extra || year ? " (" + [extra, year].filter(Boolean).join(", ") + ")" : ""), node, entries),
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
        const rows = { timer: null, running: false, again: false, hidden: {}, parents: {}, swapped: {}, badged: {}, redirect: null }

        // PREQUEL/SEQUEL ids, start date, format, title and cover per id
        function loadRelations(ids) {
            const REL_CACHE_MS = CACHE_MS
            const rel = {}
            let wanted = ids.slice()
            for (let round = 0; round < 8 && wanted.length; round++) {
                const missing = []
                wanted.forEach((id) => {
                    if (rel[id]) return
                    const c = $store.get("vtss:info:" + id)
                    if (c && c.time && (Date.now() - c.time) < REL_CACHE_MS) rel[id] = c
                    else if (missing.indexOf(id) === -1) missing.push(id)
                })
                for (let i = 0; i < missing.length; i += 25) {
                    let res = null
                    try {
                        res = plain($anilist.customQuery({
                            query: "query ($ids: [Int]) { Page(perPage: 25) { media(id_in: $ids, type: ANIME) { id format season seasonYear startDate { year month day } " +
                                "title { romaji english native } coverImage { extraLarge large } " +
                                "relations { edges { relationType node { id type } } } } } }",
                            variables: { ids: missing.slice(i, i + 25) },
                        }, ""))
                    }
                    catch (e) {
                        // e.g. AniList's request limit: use what we have, the rest comes next time
                        console.warn("season-switcher: could not load relations", e)
                        checkRateLimit(e)
                        continue
                    }
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
                            if (!shouldHide) seasonBadge(c, seasonCount(rel, find, id))
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

        // Number of seasons (TV, short, ONA) of the series this anime belongs to
        function seasonCount(rel, find, id) {
            const root = find(id)
            let n = 0
            Object.keys(rel).forEach((key) => {
                const node = rel[key]
                if (node && node.id && SEASON_FORMATS[node.format] && find(node.id) === root) n++
            })
            return n
        }

        // Small "3 seasons" mark on the cover of a card that stands for several seasons
        function seasonBadge(card, count) {
            const n = pref("seasonBadge", "yes") === "yes" && count > 1 ? count : 0
            if ((rows.badged[card.id] || 0) === n) return
            rows.badged[card.id] = n
            const el = ctx.dom.asElement(card.id)
            el.queryOne("[data-media-entry-card-body]").then((body) => {
                if (!body) return
                return body.query(".vtss-seasons").then((old) => {
                    ;(old || []).forEach((o) => o.remove())
                    if (!n) return
                    return ctx.dom.createElement("div").then((badge) => {
                        badge.setAttribute("class", "vtss-seasons")
                        badge.setText(t("seasons", n))
                        body.append(badge)
                    })
                })
            }).catch(() => {})
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

        // Episodes tab: no big "continue watching" carousel above the list, watched episodes keep
        // their picture but get a small check mark, and the last started episode a progress bar
        const TAB_VIEW = "[data-anime-entry-page-plugin-episode-tab-view]"
        const EPISODES_CSS = " " + TAB_VIEW + " :has([data-episode-card]):not(:has([data-episode-grid-item])) { display: none !important; }" +
            " " + TAB_VIEW + " [data-episode-grid-item][data-is-watched=\"true\"] .opacity-25 { opacity: .55 !important; }" +
            " .vtss-watched { position: absolute; top: .35rem; left: .35rem; z-index: 4; padding: .1rem .45rem; border-radius: .4rem;" +
            " background: rgba(0,0,0,.7); color: #fff; font-size: .75rem; font-weight: 600; pointer-events: none; }" +
            " .vtss-next { position: absolute; top: .35rem; left: .35rem; z-index: 4; padding: .1rem .5rem; border-radius: .4rem;" +
            " background: rgb(var(--color-brand-500)); color: #fff; font-size: .75rem; font-weight: 700; pointer-events: none; }" +
            " .vtss-progress { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4; height: 4px; background: rgba(255,255,255,.2); pointer-events: none; }" +
            " .vtss-progress > div { height: 100%; background: rgb(var(--color-brand-500)); }" +
            " .vtss-progress-label { position: absolute; bottom: .4rem; right: .35rem; z-index: 4; padding: .1rem .45rem; border-radius: .4rem;" +
            " background: rgba(0,0,0,.7); color: #fff; font-size: .75rem; font-weight: 600; pointer-events: none; }" +
            " .vtss-continue { margin: 0 0 1.75rem; }" +
            " .vtss-seasons { position: absolute; top: .45rem; left: .45rem; z-index: 11; padding: .1rem .5rem; border-radius: .4rem;" +
            " background: rgba(0,0,0,.72); color: #fff; font-size: .72rem; font-weight: 700; pointer-events: none;" +
            " box-shadow: inset 0 0 0 1px rgb(var(--color-brand-500) / .7); }" +
            " .vtss-continue-label { font-size: 1.15rem; font-weight: 600; margin: 0 0 .75rem; }" +
            " .vtss-continue-item { cursor: pointer; }" +
            " .vtss-continue [data-vtss-copy-action] { display: none !important; }" +
            // Episode list next to the stream: picture and title only (Seanime blurs titles per its spoiler settings)
            " [data-anime-entry-page-online-streaming-view] [data-episode-grid-item-episode-description] { display: none !important; }" +
            " .vtss-episodes-btn { display: inline-flex; align-items: center; gap: .4rem; height: 2rem; padding: 0 .85rem; border-radius: 9999px;" +
            " background: rgba(255,255,255,.07); color: inherit; font-size: .875rem; font-weight: 600; cursor: pointer; white-space: nowrap; }" +
            " .vtss-episodes-btn:hover { background: rgba(255,255,255,.14); }"

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
            ctx.dom.queryOne("[data-vtss-style]").then((existing) => {
                if (existing) return
                return Promise.all([ctx.dom.createElement("style"), ctx.dom.queryOne("body")]).then((res) => {
                    const style = res[0], body = res[1]
                    if (!style || !body) return
                    // Seanime finds plugin elements by their id, so the id must stay as it is
                    style.setAttribute("data-vtss-style", "1")
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
                        EPISODES_CSS +
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
        // opens or its id in the address changes. Plugins can't go to the home page directly
        // (navigateTo ignores "/"), and Seanime turns "0123" into 123, so the plugin opens the
        // anime page without an id: Seanime then goes to the home page by itself, which resets
        // the view. Once that happened, the plugin opens the anime with the view in the address.
        function reopenEntry(mediaId, params) {
            const id = String(mediaId)
            const q = { id: id }
            Object.keys(params).forEach((k) => q[k] = String(params[k]))
            const pending = { marker: "vtss" + id + "x" + Date.now(), q: q }
            state.pending = pending
            ctx.screen.navigateTo("/entry", { vtss: pending.marker })
            // Normally continued in onPage once Seanime has left the anime page
            ctx.setTimeout(() => finishReopen(pending), 3000)
        }

        function finishReopen(pending) {
            if (state.pending !== pending) return
            state.pending = null
            ctx.screen.navigateTo("/entry", pending.q)
            if (pending.q.tab !== "onlinestream") return
            // Tell the user when Seanime didn't open the stream, instead of silently doing nothing
            ctx.setTimeout(() => {
                ctx.dom.queryOne(ONLINE_VIEW).then((el) => {
                    if (!el) ctx.toast.warning(t("playFailed"))
                }).catch(() => {})
            }, 4000)
        }

        // Online streaming only. (Debrid and torrent streaming have no "open episode N" address.)
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

        // The reliable way: make the Episodes tab Seanime's "Default episode source". Seanime asks
        // you once to allow it. Afterwards the plugin doesn't need to redirect pages anymore.
        // If you change the setting back later, the plugin leaves it alone.
        function storageGet(key) {
            try { return $storage.get(key) } catch (e) { return undefined }
        }
        function storageSet(key, value) {
            try { $storage.set(key, value) } catch (e) {}
        }
        const defaultSource = { set: storageGet("vtss:defaultSourceSet") === true }
        if (forceInfo && !defaultSource.set && ctx.appSettings && ctx.appSettings.set) {
            ctx.setTimeout(() => {
                Promise.resolve(ctx.appSettings.set("library.defaultPlaybackSource", INFO_TAB))
                    .then(() => {
                        defaultSource.set = true
                        storageSet("vtss:defaultSourceSet", true)
                        ctx.toast.success(t("defaultSet"))
                    })
                    .catch((e) => console.warn("season-switcher: could not set the default episode source", e))
            }, 1500)
        }

        ctx.anime.registerEntryEpisodeTab({
            name: t("episodesTab"),
            icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' width='18' height='18'><path d='M4 5h16v2H4zm0 6h10v2H4zm0 6h10v2H4zm13-5 5 3.5-5 3.5z'/></svg>",
            shouldShow: () => true,
            onSelectEpisode: (e) => {
                if (e && e.mediaId && e.episodeNumber) playEpisode(e.mediaId, e.episodeNumber)
            },
        })

        // Watched mark and progress on the episodes in the Episodes tab
        const TAB_EPISODE = TAB_VIEW + " [data-episode-grid-item][data-episode-number]"
        const marks = { done: {}, progress: {} }

        // Your AniList progress for the anime on this page (number of watched episodes)
        function listProgress(mediaId) {
            if (marks.progress[mediaId]) return marks.progress[mediaId]
            marks.progress[mediaId] = ctx.dom.queryOne("[data-anime-entry-page]")
                .then((page) => page ? page.getAttribute("data-anime-entry-list-data") : null)
                .then((json) => {
                    try { return (JSON.parse(String(json || "{}")) || {}).progress || 0 } catch (e) { return 0 }
                })
                .catch(() => 0)
            return marks.progress[mediaId]
        }

        function markEpisode(item) {
            const attrs = item.attributes || {}
            const watched = attrs["data-is-watched"] === "true"
            const key = item.id + ":" + watched
            if (marks.done[key]) return
            marks.done[key] = true
            const mediaId = parseInt(String(attrs["data-media-id"] || state.mediaId || ""), 10)
            const episodeNumber = parseInt(String(attrs["data-episode-number"] || ""), 10)

            let history = null
            if (!watched && mediaId && episodeNumber) {
                try {
                    const h = ctx.continuity.getWatchHistoryItem(mediaId)
                    if (h && h.episodeNumber === episodeNumber && h.currentTime > 30 && h.duration > 0) history = h
                }
                catch (e) {}
            }

            Promise.all([
                item.queryOne("[data-episode-grid-item-image-container]"),
                watched || !mediaId ? Promise.resolve(-1) : listProgress(mediaId),
            ]).then((res) => {
                const image = res[0], progress = res[1]
                if (!image) return
                // "Continue watching" is just a mark on the next episode instead of the big row
                const isNext = !watched && progress >= 0 && episodeNumber === progress + 1
                return image.query(".vtss-watched, .vtss-next, .vtss-progress, .vtss-progress-label").then((old) => {
                    ;(old || []).forEach((el) => el.remove())
                    const add = []
                    if (watched) add.push(["vtss-watched", t("watched")])
                    else if (isNext) add.push(["vtss-next", t("next")])
                    if (history) {
                        const pct = Math.max(2, Math.min(100, Math.round(history.currentTime / history.duration * 100)))
                        add.push(["vtss-progress", null, "<div style=\"width:" + pct + "%\"></div>"])
                        add.push(["vtss-progress-label", t("minutes", Math.max(1, Math.round(history.currentTime / 60)))])
                    }
                    return Promise.all(add.map(() => ctx.dom.createElement("div"))).then((els) => {
                        els.forEach((el, k) => {
                            el.setAttribute("class", add[k][0])
                            if (add[k][1]) el.setText(add[k][1])
                            if (add[k][2]) el.setInnerHTML(add[k][2])
                            image.append(el)
                        })
                        if (isNext || history) scheduleContinue()
                    })
                })
            }).catch(() => {})
        }

        // "Continue watching": the episode you stopped in (or the next one) as a single list
        // entry above the list, in place of Seanime's big row of episode cards. It is a copy of
        // that episode's list entry (Seanime opens the list on the page with the next episode).
        const CAROUSEL = TAB_VIEW + " > :has([data-episode-card]):not(:has([data-episode-grid-item]))"
        const cont = { timer: null, html: "" }

        function scheduleContinue() {
            if (cont.timer) cont.timer()
            cont.timer = ctx.setTimeout(() => {
                cont.timer = null
                renderContinue()
            }, 400)
        }

        function continueEpisode(mediaId) {
            try {
                const h = ctx.continuity.getWatchHistoryItem(mediaId)
                if (h && h.episodeNumber && h.currentTime > 30 && h.duration > 0 && h.currentTime / h.duration < 0.9) {
                    return Promise.resolve(h.episodeNumber)
                }
            }
            catch (e) {}
            return listProgress(mediaId).then((progress) => progress + 1)
        }

        function removeContinue() {
            cont.html = ""
            return ctx.dom.query(".vtss-continue").then((old) => (old || []).forEach((el) => el.remove())).catch(() => {})
        }

        function renderContinue() {
            const mediaId = state.mediaId
            if (!mediaId) return
            continueEpisode(mediaId).then((ep) => {
                if (state.mediaId !== mediaId) return
                return Promise.all([
                    ctx.dom.queryOne(TAB_EPISODE + "[data-episode-number=\"" + ep + "\"]"),
                    ctx.dom.queryOne(CAROUSEL),
                ]).then((res) => {
                    const item = res[0], carousel = res[1]
                    if (!item || !carousel) return removeContinue()
                    return Promise.all([item.getProperty("outerHTML"), item.getParent()]).then((r) => {
                        const html = String(r[0] || "").split("data-episode-grid-item").join("data-vtss-copy")
                            .replace(/\sid="[^"]*"/g, "")
                        if (!html) return
                        return ctx.dom.query(".vtss-continue").then((old) => {
                            if (old && old.length && cont.html === html) return
                            ;(old || []).forEach((el) => el.remove())
                            cont.html = html
                            return (r[1] ? r[1].getProperty("className") : Promise.resolve("")).then((gridClass) => {
                                return ctx.dom.createElement("div").then((panel) => {
                                    panel.setAttribute("class", "vtss-continue")
                                    panel.setInnerHTML(
                                        "<div class=\"vtss-continue-label\">" + t("continueWatching") + "</div>" +
                                        "<div class=\"vtss-continue-item " + String(gridClass || "") + "\">" + html + "</div>")
                                    panel.addEventListener("click", () => playEpisode(mediaId, ep))
                                    carousel.before(panel)
                                })
                            })
                        })
                    })
                })
            }).catch((e) => console.warn("season-switcher: continue panel", e))
        }

        // Returns true when the page is being replaced
        function routeToInfoPage(pathname, params, prev) {
            if (!forceInfo || defaultSource.set || pathname !== "/entry") return false
            const id = String((params && params.id) || "")
            if (!id) return false
            const tab = String((params && params.tab) || "")
            const prevSame = prev && prev.pathname === "/entry" && prev.id === id
            if (tab) return false
            if (prevSame) {
                // Back button from the info page: don't bounce back into it
                if (prev.tab === INFO_TAB) return false
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
            if (!forceInfo || defaultSource.set || !loc || loc.pathname !== "/entry" || loc.tab !== INFO_TAB) return
            if (state.reopened === loc.id) return
            state.reopened = loc.id
            reopenEntry(loc.id, { tab: INFO_TAB })
        }

        // Button above the episode list next to the stream that leads back to the Episodes tab
        const VIEW_TOGGLE = ONLINE_VIEW + " button[title^=\"Switch to\"]"
        function addEpisodesButton(toggle) {
            const mediaId = state.mediaId
            if (!toggle || !mediaId) return
            ctx.dom.queryOne("[data-vtss-episodes-btn]").then((existing) => {
                if (existing) return
                return ctx.dom.createElement("button").then((btn) => {
                    btn.setAttribute("class", "vtss-episodes-btn")
                    btn.setAttribute("type", "button")
                    btn.setAttribute("data-vtss-episodes-btn", "1")
                    btn.setText("☰ " + t("toEpisodes"))
                    btn.addEventListener("click", () => reopenEntry(state.mediaId || mediaId, { tab: INFO_TAB }))
                    toggle.before(btn)
                })
            }).catch(() => {})
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
            const pending = state.pending
            if (pending) {
                const marker = String((searchParams && searchParams.vtss) || "")
                if (pathname === "/entry" && marker === pending.marker) {
                    // Seanime has reset the view and is about to go to the home page by itself
                    ctx.setTimeout(() => finishReopen(pending), 150)
                    return
                }
                if (pathname === "/" || (pathname === "/entry" && !(searchParams && searchParams.id))) {
                    // Seanime has left the anime page; now open it with the wanted view
                    ctx.setTimeout(() => finishReopen(pending), 50)
                    return
                }
            }
            const prev = state.loc
            state.loc = {
                pathname: pathname,
                id: String(parseInt(String((searchParams && searchParams.id) || ""), 10) || ""),
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
                rows.badged = {}
                episodes.done = {}
                marks.done = {}
                marks.progress = {}
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
                    checkRateLimit(e)
                }
            }, 50)
        }

        ctx.dom.onReady(() => {
            // The header is rendered after the page data has loaded and can be re-rendered,
            // so add the dropdown whenever the title container (re)appears.
            ctx.dom.observe(TITLE_CONTAINER, (elements) => {
                if (elements && elements.length) {
                    health("title")
                    inject()
                }
            })
            ctx.dom.observe(EPISODE, (elements) => {
                if (pref("episodeClick", "yes") !== "yes") return
                ;(elements || []).forEach(setupEpisode)
            })
            ctx.dom.observe(TAB_EPISODE, (elements) => {
                if (elements && elements.length) health("episodes")
                ;(elements || []).forEach(markEpisode)
                if (elements && elements.length) scheduleContinue()
            })
            ctx.dom.observe(ONLINE_VIEW, (elements) => {
                if (elements && elements.length) {
                    health("stream")
                    checkOnlineView()
                }
            })
            ctx.dom.observe(VIEW_TOGGLE, (elements) => {
                if (elements && elements.length) addEpisodesButton(elements[0])
            })
            ensureStyle()
            // Cards on the home page appear while rows load and scroll into view
            ctx.dom.observe(CARD, (elements) => {
                if (elements && elements.length) health("cards")
                scheduleMergeRows()
            })
            ctx.screen.onNavigate((e) => onPage(e.pathname, e.searchParams))
            ctx.screen.loadCurrent()
        })
    })
}
