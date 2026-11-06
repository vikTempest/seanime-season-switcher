// Tests for the shared AniList cache (suite/anilist.js). Run: node test/anilist.js
const assert = require("assert")
const fs = require("fs")
const vm = require("vm")

const src = fs.readFileSync(__dirname + "/../suite/anilist.js", "utf8")
let failures = 0
function check(name, fn) {
    try { fn(); console.log("ok   " + name) }
    catch (e) { failures++; console.log("FAIL " + name + "\n     " + e.message) }
}

function setup() {
    const store = new Map(), storage = new Map()
    const env = { clock: 0, calls: 0, fail: false }
    const c = vm.createContext({
        $store: { get: (k) => store.get(k), set: (k, v) => store.set(k, JSON.parse(JSON.stringify(v))) },
        $storage: { get: (k) => storage.get(k), set: (k, v) => storage.set(k, JSON.parse(JSON.stringify(v))) },
        $anilist: {
            customQuery(body) {
                env.calls++
                if (env.fail) throw new Error("429 Too Many Requests")
                return { Page: { media: body.variables.ids.filter((id) => id < 1000).map((id) => ({
                    id, type: "ANIME", format: "TV", status: id % 2 ? "FINISHED" : "RELEASING", title: { english: "A" + id },
                    relations: { edges: [{ relationType: "SEQUEL", node: { id: id + 1, type: "ANIME" } }] },
                })) } }
            },
        },
        __env: env,
    })
    vm.runInContext("Date.now = ((n) => () => n() + __env.clock)(Date.now)", c)
    const ani = vm.runInContext(src, c)
    return { ani, store, storage, env }
}

check("one request for up to 50 ids, then from the cache", () => {
    const { ani, env } = setup()
    const ids = Array.from({ length: 50 }, (_, i) => i + 1)
    assert.ok(ani.fetch(ids))
    assert.strictEqual(env.calls, 1)
    assert.ok(ani.fetch(ids))
    assert.strictEqual(env.calls, 1)
    assert.strictEqual(ani.get(7, { full: true }).rel[0].id, 8)
})

check("saved entries come back after a restart", () => {
    const { ani, store, env } = setup()
    ani.fetch([1, 2])
    store.clear()
    assert.ok(ani.get(1, { full: true }))
    assert.ok(ani.fetch([1, 2]))
    assert.strictEqual(env.calls, 1)
})

check("finished anime are kept two weeks, airing ones a day", () => {
    const { ani, env } = setup()
    ani.fetch([1, 2])
    env.clock += 2 * 24 * 3600 * 1000
    assert.ok(ani.get(1, { full: true }), "finished still fresh")
    assert.ok(!ani.get(2, { full: true }), "airing is old")
    assert.ok(ani.get(2, { full: true, stale: true }), "old copy still usable")
})

check("unknown ids are not asked again", () => {
    const { ani, env } = setup()
    ani.fetch([5000])
    ani.fetch([5000])
    assert.strictEqual(env.calls, 1)
})

check("budget per minute", () => {
    const { ani, env } = setup()
    let n = 0
    for (let i = 0; i < 40; i++) {
        try { ani.request({ variables: { ids: [] } }); n++ } catch (e) {}
    }
    assert.strictEqual(n, 12)
    assert.ok(ani.wait() > 0)
    assert.doesNotThrow(() => ani.request({ variables: { ids: [] } }, "", { urgent: true }), "clicks still go through")
    env.clock += 61000
    assert.strictEqual(ani.wait(), 0)
})

check("after 429 every part waits", () => {
    const { ani, env } = setup()
    env.fail = true
    assert.throws(() => ani.fetch([1]))
    env.fail = false
    const calls = env.calls
    assert.strictEqual(ani.fetch([1]), false)
    assert.throws(() => ani.request({ variables: { ids: [] } }, "", { urgent: true }), /429/)
    assert.strictEqual(env.calls, calls)
    env.clock += 66000
    assert.ok(ani.fetch([1]))
})

console.log(failures ? "\n" + failures + " failed" : "\nall passed")
process.exitCode = failures ? 1 : 0
