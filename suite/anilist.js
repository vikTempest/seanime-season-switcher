// Shared AniList cache for every part of the extension. build.py puts this expression wherever the
// sources say $vsAniLib(), because hooks and the UI run in separate runtimes that can't share code.
// They share the data instead:
//   - $storage "vsa:media": every anime ever loaded (survives restarts), written in one piece
//   - $store "vsa:m:<id>": the same entries in memory, read by every runtime
//   - $store "vsa:cooldown" / "vsa:budget": a pause after AniList said "too many requests" and a
//     budget of requests per minute, so the parts together never use up AniList's limit
// Anime that are finished hardly change, so they are kept for two weeks, everything else for a day.
(function () {
    var MEDIA_KEY = "vsa:media"
    var DAY = 24 * 3600 * 1000
    var BUDGET = 12          // requests per minute for the whole extension (AniList allows 30, shared with Seanime)
    var COOLDOWN = 65000     // pause after "too many requests"
    var BATCH = 50           // ids per request (AniList's page limit)
    var MAX_SAVED = 3000
    var FIELDS = "id type format status episodes season seasonYear startDate { year month day } title { romaji english native } coverImage { extraLarge large }"
    var REL = "relations { edges { relationType node { id type } } }"
    var QUERY = "query ($ids: [Int], $n: Int) { Page(perPage: $n) { media(id_in: $ids, type: ANIME) { " + FIELDS + " " + REL + " } } }"
    // Two levels: the anime and its direct relations come complete in one request
    var QUERY_DEEP = "query ($ids: [Int], $n: Int) { Page(perPage: $n) { media(id_in: $ids, type: ANIME) { " + FIELDS +
        " relations { edges { relationType node { " + FIELDS + " " + REL + " } } } } } }"

    function now() { return Date.now() }
    function sget(k) { try { return $store.get(k) } catch (e) { return null } }
    function sset(k, v) { try { $store.set(k, v) } catch (e) {} }
    function plain(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)) }

    function ttl(e) {
        return e.status === "FINISHED" || e.status === "CANCELLED" ? 14 * DAY : DAY
    }

    // Copies the saved entries into memory once per Seanime start
    function load() {
        if (sget("vsa:loaded")) return
        sset("vsa:loaded", true)
        var saved = null
        try { saved = $storage.get(MEDIA_KEY) } catch (e) {}
        if (!saved || typeof saved !== "object") return
        Object.keys(saved).forEach(function (id) {
            var e = saved[id]
            if (e && e.id && !sget("vsa:m:" + id)) sset("vsa:m:" + id, e)
        })
    }

    // The entry for an id. Without "stale" only while it is fresh; "full" means with relations.
    function get(id, opts) {
        load()
        var e = sget("vsa:m:" + id)
        if (!e || !e.id) return null
        if (opts && opts.full && !e.rel) return null
        if (!(opts && opts.stale) && now() - e.time > ttl(e)) return null
        return e
    }

    function entryOf(m, old) {
        var e = {
            time: now(), id: m.id, type: m.type || "ANIME", format: m.format || null, status: m.status || null,
            episodes: m.episodes || null, season: m.season || null, seasonYear: m.seasonYear || null,
            startDate: m.startDate || {}, title: m.title || {},
            cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || (old && old.cover) || "",
            rel: old && old.rel ? old.rel : null,
        }
        if (m.relations && m.relations.edges) {
            e.rel = []
            m.relations.edges.forEach(function (edge) {
                if (!edge || !edge.node || !edge.node.id) return
                e.rel.push({ type: edge.relationType, id: edge.node.id, mediaType: edge.node.type || "ANIME" })
            })
        }
        return e
    }

    // Saves AniList media (and the complete ones among their relations). Returns the new entries.
    function put(list) {
        load()
        var out = []
        function one(m) {
            if (!m || !m.id || (m.type && m.type !== "ANIME")) return
            var old = sget("vsa:m:" + m.id)
            // A relation node without its own relations must not replace a complete entry
            if (!m.relations && old && old.rel && now() - old.time < ttl(old)) return
            var e = entryOf(m, old)
            sset("vsa:m:" + m.id, e)
            out.push(e)
            ;((m.relations && m.relations.edges) || []).forEach(function (edge) {
                if (edge && edge.node && edge.node.title) one(edge.node)
            })
        }
        ;(list || []).forEach(one)
        if (out.length) save(out)
        return out
    }

    function save(entries) {
        try {
            var saved = $storage.get(MEDIA_KEY)
            if (!saved || typeof saved !== "object") saved = {}
            entries.forEach(function (e) { saved[e.id] = e })
            var ids = Object.keys(saved)
            if (ids.length > MAX_SAVED) {
                ids.sort(function (a, b) { return saved[a].time - saved[b].time })
                ids.slice(0, ids.length - MAX_SAVED).forEach(function (id) { delete saved[id] })
            }
            $storage.set(MEDIA_KEY, saved)
        }
        catch (e) {}
    }

    // How long AniList asked us to pause (0 = not paused)
    function cooldown() {
        var c = sget("vsa:cooldown") || 0
        return c > now() ? c - now() : 0
    }

    // How long until requests are allowed again (0 = now)
    function wait() {
        var c = cooldown()
        if (c > 0) return c
        var b = sget("vsa:budget")
        if (b && now() - b.start < 60000 && b.n >= BUDGET) return 60000 - (now() - b.start)
        return 0
    }

    function isLimit(err) {
        return /429|too many|rate.?limit/i.test(String((err && (err.message || err)) || ""))
    }

    // Every AniList request of the extension goes through here. "urgent" is for things you
    // clicked (e.g. saving a rating): they only wait for AniList's pause, not for the budget.
    function request(body, token, opts) {
        var w = opts && opts.urgent ? cooldown() : wait()
        if (w > 0) throw new Error("429 rate limit: waiting " + Math.ceil(w / 1000) + " s")
        var b = sget("vsa:budget")
        if (!b || now() - b.start >= 60000) b = { start: now(), n: 0 }
        b.n++
        sset("vsa:budget", b)
        try {
            return plain($anilist.customQuery(body, token || ""))
        }
        catch (err) {
            if (isLimit(err)) sset("vsa:cooldown", now() + COOLDOWN)
            throw err
        }
    }

    // Loads the ids that are missing or old, at most maxRequests requests. Returns false when not
    // everything could be loaded (limit reached or AniList busy); what is missing comes next time.
    function fetch(ids, opts) {
        opts = opts || {}
        var deep = !!opts.deep
        var max = opts.maxRequests || 1
        var missing = []
        ;(ids || []).forEach(function (id) {
            if (!get(id, { full: true }) && missing.indexOf(id) === -1) missing.push(id)
        })
        var size = deep ? 5 : BATCH
        var done = 0
        for (var i = 0; i < missing.length; i += size) {
            if (done >= max || wait() > 0) return false
            done++
            var chunk = missing.slice(i, i + size)
            var res = request({ query: deep ? QUERY_DEEP : QUERY, variables: { ids: chunk, n: chunk.length } })
            var page = (res && (res.Page || (res.data && res.data.Page))) || {}
            var got = put(page.media || [])
            // Ids AniList doesn't know (deleted entries) are remembered too, so they aren't asked again
            chunk.forEach(function (id) {
                if (!got.some(function (e) { return e.id === id })) {
                    var gone = { time: now(), id: id, type: "ANIME", status: "FINISHED", startDate: {}, title: {}, rel: [], missing: true }
                    sset("vsa:m:" + id, gone)
                }
            })
        }
        return true
    }

    // Your whole list with relations in one request (Seanime's own query), once a day. Fills the
    // cache for everything on your list, so the home page and the season dropdown rarely need more.
    function warm(force) {
        var last = 0
        try { last = $storage.get("vsa:warm") || 0 } catch (e) {}
        if (!force && now() - last < DAY) return null
        if (wait() > 0) return null
        var col = null
        try {
            var b = sget("vsa:budget")
            if (!b || now() - b.start >= 60000) b = { start: now(), n: 0 }
            b.n++
            sset("vsa:budget", b)
            col = plain($anilist.getAnimeCollectionWithRelations())
        }
        catch (err) {
            if (isLimit(err)) sset("vsa:cooldown", now() + COOLDOWN)
            throw err
        }
        var media = []
        var lists = (col && col.MediaListCollection && col.MediaListCollection.lists) || []
        lists.forEach(function (l) { ((l && l.entries) || []).forEach(function (en) { if (en && en.media) media.push(en.media) }) })
        put(media)
        try { $storage.set("vsa:warm", now()) } catch (e) {}
        return col
    }

    return { get: get, put: put, fetch: fetch, request: request, wait: wait, cooldown: cooldown, isLimit: isLimit, warm: warm }
})()
