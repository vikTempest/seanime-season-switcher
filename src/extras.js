/// <reference path="../plugin.d.ts" />
/// <reference path="../app.d.ts" />

// -------------------------------------------------------------------------------------------------
// Extras for VikTempest Seanime UI:
//   - screensaver with the anime of the home page banner (trending) after some idle minutes
//   - sleep timer in the tray (pause after X minutes or after this episode)
//   - notice about new seasons of anime on your list
//   - filler episodes dimmed or hidden
//   - right-click menu on episodes
//   - rating window after the last episode of a season
//   - quick search with Ctrl+K
// Built into viktempest-ui.json by suite/build.py. Uses vsTray(), vsTrayHeader(), vsOpenSettings()
// and vsShare from suite/settings.js when they are there.

function init() {
    $ui.register((ctx) => {
        const I18N = {
            de: {
                saverBack: "Zurück zu Seanime", saverOpen: "Ansehen", saverEpisodes: "{0} Folgen", saverHint: "Bildschirmschoner",
                sleepTitle: "Schlaftimer", sleepOff: "Aus", sleepLeft: "pausiert in {0} min", sleepAfterEp: "pausiert nach dieser Folge",
                sleepNone: "aus", sleepEp: "Nach dieser Folge", sleepSet: "Schlaftimer: {0}", sleepDone: "Schlaftimer: Wiedergabe pausiert. Gute Nacht!",
                sleepMin: "{0} min", sleepStopped: "Schlaftimer aus.",
                newTitle: "Neue Staffeln", newToast: "Neue Staffel: {0}", newToastMany: "{0} neue Staffeln für Anime auf deiner Liste. Mehr im Symbol oben.",
                newAiring: "läuft gerade", newSoon: "startet {0}", newFinished: "fertig", newSoonNoDate: "angekündigt",
                quick: "Schnellsuche", quickHint: "Anime auf deiner Liste oder Aktion suchen …", quickActions: "Aktionen", quickList: "Deine Liste",
                quickSettings: "Einstellungen öffnen", quickSaver: "Bildschirmschoner jetzt starten", quickSleep30: "Schlaftimer 30 min", quickSleepOff: "Schlaftimer aus",
                status: { CURRENT: "schaue ich", PLANNING: "geplant", COMPLETED: "fertig", PAUSED: "pausiert", DROPPED: "abgebrochen", REPEATING: "nochmal" },
                menuWatched: "Bis hier als gesehen markieren", menuPlay: "Online-Stream starten", menuWatchedDone: "Fortschritt auf {0} gesetzt.",
                menuFailed: "Konnte den Fortschritt nicht speichern: {0}",
                rateAsk: "Letzte Folge von „{0}“ geschafft. Wie fandest du es?",
            },
            en: {
                saverBack: "Back to Seanime", saverOpen: "Watch", saverEpisodes: "{0} episodes", saverHint: "Screensaver",
                sleepTitle: "Sleep timer", sleepOff: "Off", sleepLeft: "pauses in {0} min", sleepAfterEp: "pauses after this episode",
                sleepNone: "off", sleepEp: "After this episode", sleepSet: "Sleep timer: {0}", sleepDone: "Sleep timer: playback paused. Good night!",
                sleepMin: "{0} min", sleepStopped: "Sleep timer off.",
                newTitle: "New seasons", newToast: "New season: {0}", newToastMany: "{0} new seasons for anime on your list. More in the icon at the top.",
                newAiring: "airing now", newSoon: "starts {0}", newFinished: "finished", newSoonNoDate: "announced",
                quick: "Quick search", quickHint: "Search anime on your list or an action …", quickActions: "Actions", quickList: "Your list",
                quickSettings: "Open settings", quickSaver: "Start screensaver now", quickSleep30: "Sleep timer 30 min", quickSleepOff: "Sleep timer off",
                status: { CURRENT: "watching", PLANNING: "planning", COMPLETED: "completed", PAUSED: "paused", DROPPED: "dropped", REPEATING: "rewatching" },
                menuWatched: "Mark watched up to here", menuPlay: "Start online stream", menuWatchedDone: "Progress set to {0}.",
                menuFailed: "Could not save the progress: {0}",
                rateAsk: "You finished \"{0}\". How did you like it?",
            },
            es: {
                saverBack: "Volver a Seanime", saverOpen: "Ver", saverEpisodes: "{0} episodios", saverHint: "Salvapantallas",
                sleepTitle: "Temporizador", sleepOff: "No", sleepLeft: "pausa en {0} min", sleepAfterEp: "pausa tras este episodio",
                sleepNone: "apagado", sleepEp: "Tras este episodio", sleepSet: "Temporizador: {0}", sleepDone: "Temporizador: reproducción en pausa. ¡Buenas noches!",
                sleepMin: "{0} min", sleepStopped: "Temporizador apagado.",
                newTitle: "Temporadas nuevas", newToast: "Temporada nueva: {0}", newToastMany: "{0} temporadas nuevas de anime de tu lista. Más en el icono de arriba.",
                newAiring: "en emisión", newSoon: "empieza {0}", newFinished: "terminada", newSoonNoDate: "anunciada",
                quick: "Búsqueda rápida", quickHint: "Busca anime de tu lista o una acción …", quickActions: "Acciones", quickList: "Tu lista",
                quickSettings: "Abrir ajustes", quickSaver: "Iniciar salvapantallas", quickSleep30: "Temporizador 30 min", quickSleepOff: "Temporizador apagado",
                status: { CURRENT: "viendo", PLANNING: "planeado", COMPLETED: "completado", PAUSED: "en pausa", DROPPED: "abandonado", REPEATING: "repitiendo" },
                menuWatched: "Marcar visto hasta aquí", menuPlay: "Ver en streaming", menuWatchedDone: "Progreso: {0}.",
                menuFailed: "No se pudo guardar el progreso: {0}",
                rateAsk: "Terminaste \"{0}\". ¿Qué te pareció?",
            },
            pt: {
                saverBack: "Voltar ao Seanime", saverOpen: "Assistir", saverEpisodes: "{0} episódios", saverHint: "Protetor de tela",
                sleepTitle: "Timer para dormir", sleepOff: "Não", sleepLeft: "pausa em {0} min", sleepAfterEp: "pausa após este episódio",
                sleepNone: "desligado", sleepEp: "Após este episódio", sleepSet: "Timer: {0}", sleepDone: "Timer: reprodução pausada. Boa noite!",
                sleepMin: "{0} min", sleepStopped: "Timer desligado.",
                newTitle: "Temporadas novas", newToast: "Temporada nova: {0}", newToastMany: "{0} temporadas novas de animes da sua lista. Mais no ícone acima.",
                newAiring: "em exibição", newSoon: "começa {0}", newFinished: "terminada", newSoonNoDate: "anunciada",
                quick: "Busca rápida", quickHint: "Busque um anime da sua lista ou uma ação …", quickActions: "Ações", quickList: "Sua lista",
                quickSettings: "Abrir configurações", quickSaver: "Iniciar protetor de tela", quickSleep30: "Timer 30 min", quickSleepOff: "Timer desligado",
                status: { CURRENT: "assistindo", PLANNING: "planejado", COMPLETED: "completo", PAUSED: "pausado", DROPPED: "largado", REPEATING: "reassistindo" },
                menuWatched: "Marcar assistido até aqui", menuPlay: "Assistir online", menuWatchedDone: "Progresso: {0}.",
                menuFailed: "Não foi possível salvar o progresso: {0}",
                rateAsk: "Você terminou \"{0}\". O que achou?",
            },
            ja: {
                saverBack: "Seanimeに戻る", saverOpen: "見る", saverEpisodes: "{0}話", saverHint: "スクリーンセーバー",
                sleepTitle: "スリープタイマー", sleepOff: "オフ", sleepLeft: "{0}分後に一時停止", sleepAfterEp: "このエピソードの後に一時停止",
                sleepNone: "オフ", sleepEp: "このエピソードの後", sleepSet: "スリープタイマー: {0}", sleepDone: "スリープタイマー: 一時停止しました。おやすみなさい！",
                sleepMin: "{0}分", sleepStopped: "スリープタイマーをオフにしました。",
                newTitle: "新シーズン", newToast: "新シーズン: {0}", newToastMany: "リストのアニメに新シーズンが{0}件あります。上のアイコンで確認できます。",
                newAiring: "放送中", newSoon: "{0}開始", newFinished: "完結", newSoonNoDate: "発表済み",
                quick: "クイック検索", quickHint: "リストのアニメや操作を検索 …", quickActions: "操作", quickList: "あなたのリスト",
                quickSettings: "設定を開く", quickSaver: "スクリーンセーバーを開始", quickSleep30: "スリープタイマー30分", quickSleepOff: "スリープタイマーをオフ",
                status: { CURRENT: "視聴中", PLANNING: "予定", COMPLETED: "完了", PAUSED: "一時停止", DROPPED: "中断", REPEATING: "再視聴" },
                menuWatched: "ここまで視聴済みにする", menuPlay: "オンラインで再生", menuWatchedDone: "進捗を{0}にしました。",
                menuFailed: "進捗を保存できませんでした: {0}",
                rateAsk: "「{0}」を見終わりました。評価しますか？",
            },
        }

        // Settings are read when they are used, so changes work without a restart
        function pref(key, fallback) {
            const v = $getUserPreference(key)
            return v === undefined || v === null || v === "" ? fallback : String(v)
        }
        function lang() {
            const l = pref("language", "de")
            return I18N[l] ? l : "en"
        }
        function t(key, arg) {
            const table = I18N[lang()] || I18N.en
            let s = table[key] !== undefined ? table[key] : I18N.en[key]
            if (typeof s === "string" && arg !== undefined) s = s.split("{0}").join(String(arg))
            return s
        }
        function plain(v) {
            try { return JSON.parse(JSON.stringify(v)) } catch (e) { return null }
        }
        function errMsg(e) {
            return String((e && e.message) || e || "")
        }
        function titleOf(media) {
            const tl = (media && media.title) || {}
            const want = pref("titleLanguage", "english")
            if (want === "native") return tl.native || tl.romaji || tl.english || ""
            if (want === "romaji") return tl.romaji || tl.english || tl.native || ""
            return tl.english || tl.romaji || tl.native || ""
        }
        const share = typeof vsShare === "object" && vsShare ? vsShare : { traySections: [] }
        const tray = typeof vsTray === "function" ? vsTray() : null
        function trayUpdate() {
            try { if (tray) tray.update() } catch (e) {}
        }
        function openSettings() {
            if (typeof vsOpenSettings === "function") vsOpenSettings()
        }

        // Your anime list from Seanime's cache (no AniList request)
        function listEntries() {
            const out = []
            try {
                const col = plain($anilist.getAnimeCollection(false))
                const lists = (col && col.MediaListCollection && col.MediaListCollection.lists) || []
                lists.forEach((list) => ((list && list.entries) || []).forEach((entry) => {
                    if (entry && entry.media && entry.media.id) out.push(entry)
                }))
            }
            catch (e) {
                console.warn("viktempest-ui extras: could not read your list", e)
            }
            return out
        }

        // -----------------------------------------------------------------------------------------
        // Player state (needs the "playback" permission; without it these features just stay quiet)

        const vc = ctx.videoCore
        const player = { playing: false, lastEvent: 0, completed: null }
        function onVideo(type, fn) {
            try {
                if (vc && vc.addEventListener) vc.addEventListener(type, (e) => {
                    player.lastEvent = Date.now()
                    try { fn(e || {}) } catch (err) { console.warn("viktempest-ui extras: " + type, err) }
                })
            }
            catch (e) {
                console.warn("viktempest-ui extras: player events not available", e)
            }
        }
        function playbackInfo() {
            try { return plain(vc && vc.getCurrentPlaybackInfo ? vc.getCurrentPlaybackInfo() : null) } catch (e) { return null }
        }
        function pause() {
            try { if (vc && vc.pause) vc.pause() } catch (e) { console.warn("viktempest-ui extras: pause failed", e) }
        }

        onVideo("video-resumed", () => { player.playing = true; sleep.onPlay() })
        onVideo("video-can-play", (e) => { player.playing = !e.paused; sleep.onPlay() })
        onVideo("video-status", (e) => { player.playing = !e.paused })
        onVideo("video-paused", () => { player.playing = false })
        onVideo("video-terminated", () => { player.playing = false; rate.onStop() })
        onVideo("video-ended", (e) => { player.playing = false; sleep.onEnded(e); rate.onStop() })
        onVideo("video-completed", () => rate.onCompleted())

        // -----------------------------------------------------------------------------------------
        // Activity: the last time you used the mouse or keyboard in Seanime. Each listener sends
        // one event and is then off for a while, so moving the mouse doesn't flood the plugin.

        let lastActive = Date.now()
        const ACTIVITY_EVENTS = ["mousemove", "pointerdown", "keydown", "wheel", "touchstart"]
        const ACTIVITY_PAUSE_MS = 15000
        let watchedBody = ""

        function watchActivity() {
            ctx.dom.queryOne("body").then((body) => {
                if (!body || body.id === watchedBody) return
                watchedBody = body.id
                ACTIVITY_EVENTS.forEach((ev) => {
                    const arm = () => {
                        let off = null
                        off = body.addEventListener(ev, () => {
                            lastActive = Date.now()
                            if (typeof off === "function") off()
                            ctx.setTimeout(arm, ACTIVITY_PAUSE_MS)
                        })
                    }
                    arm()
                })
            }).catch((e) => console.warn("viktempest-ui extras: activity", e))
        }
        ctx.dom.onMainTabReady(() => { watchedBody = ""; watchActivity() })
        watchActivity()

        // -----------------------------------------------------------------------------------------
        // Screensaver

        const SAVER_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#000;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
  .slide{position:absolute;inset:0;opacity:0;transition:opacity 1.6s ease}
  .slide.on{opacity:1}
  .slide .img{position:absolute;inset:-4%;background-size:cover;background-position:center;transform:scale(1.02);animation:none}
  .slide.on .img{animation:kb 16s ease-out forwards}
  @keyframes kb{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-1%)}}
  .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.1) 75%),linear-gradient(0deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,0) 45%)}
  .info{position:absolute;left:6vw;bottom:22vh;max-width:min(640px,80vw)}
  .tag{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--a,#e50914);font-weight:700}
  h1{font-size:clamp(28px,5vw,64px);line-height:1.05;margin:.3em 0 .25em;text-shadow:0 2px 20px rgba(0,0,0,.6)}
  .meta{color:rgba(255,255,255,.75);font-size:15px;margin-bottom:12px}
  .desc{color:rgba(255,255,255,.85);font-size:16px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .open{margin-top:18px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:9px 18px;font-size:15px;cursor:pointer}
  .open:hover{background:rgba(255,255,255,.24)}
  .back{position:absolute;left:50%;bottom:6vh;transform:translateX(-50%);background:var(--a,#e50914);color:#fff;border:0;border-radius:999px;padding:14px 34px;font-size:17px;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .back:hover{filter:brightness(1.1)}
  .clock{position:absolute;right:4vw;top:4vh;font-size:clamp(22px,3vw,40px);font-weight:300;color:rgba(255,255,255,.85)}
  @media (max-width:700px){.info{left:5vw;right:5vw;bottom:24vh}.desc{-webkit-line-clamp:4}}
</style></head>
<body>
<div id="slides"></div>
<div class="clock" id="clock"></div>
<button class="back" id="back">Zurück zu Seanime</button>
<script>
  var items = [], idx = -1, timer = null, text = {}, lang = "en";
  var slides = document.getElementById("slides");
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function strip(s){var d=document.createElement("div");d.innerHTML=String(s||"");return d.textContent||""}
  function pickTitle(m, want){var t=m.title||{};if(want==="native")return t.native||t.romaji||t.english||"";if(want==="romaji")return t.romaji||t.english||t.native||"";return t.english||t.romaji||t.native||""}
  function clock(){var d=new Date();document.getElementById("clock").textContent=d.toLocaleTimeString(lang,{hour:"2-digit",minute:"2-digit"})}
  function show(i){
    if(!items.length)return;
    idx=(i+items.length)%items.length;
    var m=items[idx];
    var el=document.createElement("div");el.className="slide";
    var meta=[m.seasonYear,(m.genres||[]).slice(0,3).join(" · "),m.episodes?String(text.saverEpisodes||"{0}").split("{0}").join(m.episodes):""].filter(Boolean).join("  •  ");
    el.innerHTML='<div class="img" style="background-image:url(&quot;'+esc(m.bannerImage||(m.coverImage&&m.coverImage.extraLarge)||"")+'&quot;)"></div><div class="shade"></div>'+
      '<div class="info"><div class="tag">'+esc(text.saverHint||"")+'</div><h1>'+esc(m.t)+'</h1><div class="meta">'+esc(meta)+'</div><div class="desc">'+esc(strip(m.description))+'</div>'+
      '<button class="open">'+esc(text.saverOpen||"Watch")+'</button></div>';
    el.querySelector(".open").addEventListener("click",function(){window.webview.send("open",{id:m.id})});
    slides.appendChild(el);
    requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add("on")})});
    var old=slides.children;for(var k=0;k<old.length-1;k++){(function(o){o.classList.remove("on");setTimeout(function(){if(o.parentNode)o.parentNode.removeChild(o)},1800)})(old[k])}
  }
  function start(list){
    items=list.filter(function(m){return m&&(m.bannerImage||(m.coverImage&&m.coverImage.extraLarge))});
    if(!items.length)return;
    for(var i=items.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var x=items[i];items[i]=items[j];items[j]=x}
    clearInterval(timer);show(0);timer=setInterval(function(){show(idx+1)},12000);
  }
  // The same anime as the big banner of the home page: what is trending on AniList right now
  function trending(want, fallback){
    var q="query{Page(perPage:20){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){id title{english romaji native} bannerImage coverImage{extraLarge} description(asHtml:false) genres episodes seasonYear}}}";
    fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({query:q})})
      .then(function(r){return r.json()})
      .then(function(j){
        var list=((j&&j.data&&j.data.Page&&j.data.Page.media)||[]).filter(function(m){return m.bannerImage});
        list.forEach(function(m){m.t=pickTitle(m,want)});
        start(list.length>=3?list:fallback);
      })
      .catch(function(){start(fallback)});
  }
  function close(){window.webview.send("close",{})}
  document.getElementById("back").addEventListener("click",close);
  document.addEventListener("keydown",function(e){if(e.key==="Escape"||e.key==="Enter")close()});
  window.webview.on("init",function(d){
    text=d.text||{};lang=d.lang||"en";
    document.getElementById("back").textContent=text.saverBack||"Back";
    var a=d.accent||"";if(a)document.documentElement.style.setProperty("--a",a);
    clock();setInterval(clock,10000);
    var fb=(d.fallback||[]);
    if(fb.length)start(fb);
    trending(d.titleLanguage||"english",fb);
  });
  window.addEventListener("load",function(){window.webview.send("ready",{})});
</script>
</body></html>`

        const saver = { view: null, shown: false }

        function fallbackItems() {
            // Anime from your list (watching first) in case AniList can't be reached from the page
            const order = { CURRENT: 0, REPEATING: 0, PLANNING: 1, PAUSED: 2, COMPLETED: 3, DROPPED: 4 }
            return listEntries()
                .filter((e) => e.media.bannerImage)
                .sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5))
                .slice(0, 20)
                .map((e) => ({
                    id: e.media.id, t: titleOf(e.media), bannerImage: e.media.bannerImage, coverImage: e.media.coverImage,
                    description: e.media.description || "", genres: e.media.genres || [], episodes: e.media.episodes || 0,
                    seasonYear: e.media.seasonYear || (e.media.startDate && e.media.startDate.year) || "",
                }))
        }

        function accentHex() {
            try {
                if (typeof vsAccentHex === "function" && typeof vsLoadSettings === "function") return vsAccentHex(vsLoadSettings())
            } catch (e) {}
            return ""
        }

        function showSaver() {
            if (saver.shown) return
            if (share.pickerOpen) return // the colour picker uses the same place on the page
            saver.shown = true
            if (!saver.view) {
                saver.view = ctx.newWebview({
                    slot: "fixed",
                    zIndex: 99999,
                    style: "left:0;top:0;width:100vw;height:100vh;border-radius:0;border:0",
                    window: { frameless: true },
                })
                saver.view.setContent(() => SAVER_HTML)
                saver.view.channel.on("ready", () => {
                    saver.view.channel.send("init", {
                        text: I18N[lang()] || I18N.en,
                        lang: lang(),
                        accent: accentHex(),
                        titleLanguage: pref("titleLanguage", "english"),
                        fallback: fallbackItems(),
                    })
                })
                saver.view.channel.on("close", () => hideSaver())
                saver.view.channel.on("open", (e) => {
                    hideSaver()
                    if (e && e.id) ctx.screen.navigateTo("/entry", { id: String(e.id) })
                })
            }
            else {
                // A hidden webview keeps its page: show it again and load it fresh for new pictures
                saver.view.setContent(() => SAVER_HTML)
                saver.view.show()
            }
        }

        function hideSaver() {
            saver.shown = false
            lastActive = Date.now()
            try { if (saver.view) saver.view.hide() } catch (e) {}
        }

        function saverCheck() {
            if (saver.shown || pref("screensaver", "yes") !== "yes") return
            const minutes = parseInt(pref("screensaverMinutes", "5"), 10) || 5
            if (Date.now() - lastActive < minutes * 60000) return
            // Not while something plays. (After 6 hours without any player news the state is old.)
            if (player.playing && Date.now() - player.lastEvent < 6 * 3600 * 1000) return
            showSaver()
        }

        // -----------------------------------------------------------------------------------------
        // Sleep timer

        const sleep = {
            until: 0,        // pause at this time
            afterEp: false,  // pause when the episode ends
            pauseNext: 0,    // the next episode started on its own: pause it until then
            set(minutes) {
                this.afterEp = minutes === "ep"
                this.until = this.afterEp || !minutes ? 0 : Date.now() + minutes * 60000
                this.pauseNext = 0
                if (!minutes) ctx.toast.info(t("sleepStopped"))
                else ctx.toast.success(t("sleepSet", this.afterEp ? t("sleepEp") : t("sleepMin", minutes)))
                trayUpdate()
            },
            // Used in the tray render: only plain JavaScript there (texts are read once)
            texts: null,
            label() {
                if (!this.texts) this.texts = { ep: t("sleepAfterEp"), left: t("sleepLeft", "{0}"), none: t("sleepNone") }
                if (this.afterEp) return this.texts.ep
                if (this.until) return this.texts.left.split("{0}").join(String(Math.max(1, Math.round((this.until - Date.now()) / 60000))))
                return this.texts.none
            },
            fire() {
                this.until = 0
                this.afterEp = false
                pause()
                ctx.toast.info(t("sleepDone"))
                trayUpdate()
            },
            check() {
                if (this.until && Date.now() >= this.until) this.fire()
                if (this.pauseNext && Date.now() > this.pauseNext) this.pauseNext = 0
            },
            onEnded() {
                if (!this.afterEp) return
                // With auto-next on, the next episode starts by itself: pause it as soon as it plays
                this.pauseNext = Date.now() + 90000
                this.fire()
            },
            onPlay() {
                if (this.pauseNext && Date.now() < this.pauseNext) {
                    this.pauseNext = 0
                    pause()
                }
            },
        }

        // -----------------------------------------------------------------------------------------
        // Rating after the last episode (opens the Custom Ratings window when that part is on)

        const rate = {
            pending: null,
            onCompleted() {
                if (pref("rateAfter", "yes") !== "yes") return
                const info = playbackInfo()
                const media = info && info.media
                const ep = info && info.episode
                if (!media || !media.id || !ep) return
                const num = ep.progressNumber || ep.episodeNumber || 0
                const total = media.episodes || 0
                if (!total || num < total) return
                let asked = {}
                try { asked = $storage.get("vsx:rateAsked") || {} } catch (e) {}
                if (asked[media.id]) return
                this.pending = media
            },
            onStop() {
                const media = this.pending
                this.pending = null
                if (!media || typeof share.rate !== "function") return
                try {
                    const asked = $storage.get("vsx:rateAsked") || {}
                    asked[media.id] = Date.now()
                    $storage.set("vsx:rateAsked", asked)
                } catch (e) {}
                ctx.toast.info(t("rateAsk", titleOf(media)))
                share.rate(media)
            },
        }

        // -----------------------------------------------------------------------------------------
        // New seasons: sequels of anime on your list that are not on your list yet

        const NEW_KEY = "vsx:newSeasons"
        const NEW_SEEN_KEY = "vsx:newSeasonsSeen"
        const NEW_EVERY_MS = 24 * 3600 * 1000
        const SEASON_FORMATS = { TV: 1, TV_SHORT: 1, ONA: 1 }
        let newSeasons = []
        try { newSeasons = ($storage.get(NEW_KEY) || {}).items || [] } catch (e) {}
        newSeasons.forEach((s) => { s.state = seasonState(s) })

        function dateText(d) {
            if (!d || !d.year) return ""
            if (!d.month) return String(d.year)
            return (d.day ? d.day + "." : "") + d.month + "." + d.year
        }

        function checkNewSeasons(force) {
            if (pref("newSeasons", "yes") !== "yes") return
            let last = {}
            try { last = $storage.get(NEW_KEY) || {} } catch (e) {}
            if (!force && last.time && Date.now() - last.time < NEW_EVERY_MS) return
            let col
            try { col = plain($anilist.getAnimeCollectionWithRelations()) }
            catch (e) {
                console.warn("viktempest-ui extras: new seasons", e)
                return
            }
            const lists = (col && col.MediaListCollection && col.MediaListCollection.lists) || []
            const onList = {}
            const watched = []
            lists.forEach((l) => ((l && l.entries) || []).forEach((e) => {
                if (!e || !e.media) return
                onList[e.media.id] = true
                if (e.status === "COMPLETED" || e.status === "CURRENT" || e.status === "REPEATING") watched.push(e.media)
            }))
            const found = {}
            watched.forEach((m) => {
                const edges = (m.relations && m.relations.edges) || []
                edges.forEach((edge) => {
                    const n = edge && edge.node
                    if (!n || edge.relationType !== "SEQUEL" || onList[n.id] || found[n.id]) return
                    if (!SEASON_FORMATS[n.format]) return
                    if (n.status === "CANCELLED") return
                    found[n.id] = { id: n.id, title: titleOf(n), status: n.status, start: n.startDate || null, from: titleOf(m) }
                })
            })
            newSeasons = Object.keys(found).map((k) => found[k])
            newSeasons.forEach((s) => { s.state = seasonState(s) })
            try { $storage.set(NEW_KEY, { time: Date.now(), items: newSeasons }) } catch (e) {}

            // A message only for seasons you haven't been told about yet
            let seen = {}
            try { seen = $storage.get(NEW_SEEN_KEY) || {} } catch (e) {}
            const fresh = newSeasons.filter((s) => !seen[s.id])
            fresh.forEach((s) => { seen[s.id] = Date.now() })
            try { $storage.set(NEW_SEEN_KEY, seen) } catch (e) {}
            if (fresh.length === 1) ctx.toast.info(t("newToast", fresh[0].title))
            else if (fresh.length > 1) ctx.toast.info(t("newToastMany", fresh.length))
            trayUpdate()
        }

        function seasonState(s) {
            if (s.status === "RELEASING") return t("newAiring")
            if (s.status === "FINISHED") return t("newFinished")
            const d = dateText(s.start)
            return d ? t("newSoon", d) : t("newSoonNoDate")
        }

        // -----------------------------------------------------------------------------------------
        // Filler episodes: Seanime marks them (data-is-filler), this dims or hides them

        function fillerCss() {
            const mode = pref("filler", "normal")
            if (mode === "hide") return "[data-episode-grid-item][data-is-filler=\"true\"]{display:none !important}"
            if (mode === "dim") return "[data-episode-grid-item][data-is-filler=\"true\"]{opacity:.45;filter:grayscale(.6)}" +
                "[data-episode-grid-item][data-is-filler=\"true\"]:hover{opacity:1;filter:none}"
            return ""
        }
        let fillerApplied = null
        function applyFiller(force) {
            const css = fillerCss()
            if (!force && css === fillerApplied) return
            fillerApplied = css
            Promise.all([ctx.dom.queryOne("[data-vsx-filler]"), ctx.dom.queryOne("body")]).then((res) => {
                if (res[0]) {
                    res[0].setText(css)
                    return
                }
                if (!css || !res[1]) return
                return ctx.dom.createElement("style").then((style) => {
                    style.setAttribute("data-vsx-filler", "1")
                    style.setText(css)
                    res[1].append(style)
                })
            }).catch((e) => console.warn("viktempest-ui extras: filler", e))
        }
        ctx.dom.onMainTabReady(() => applyFiller(true))
        ctx.screen.onNavigate(() => applyFiller(false))
        applyFiller(true)

        // -----------------------------------------------------------------------------------------
        // Right-click on episodes in the Episodes tab of this extension

        if (pref("episodeMenu", "yes") === "yes") {
            const tabType = "episodeTab:" + (typeof VS_EXT_ID === "string" ? VS_EXT_ID : "viktempest-ui")
            const episodeOf = (e) => (e && e.episode) || {}
            const mediaOf = (ep) => ep.baseAnime || {}
            try {
                const watchedItem = ctx.action.newEpisodeGridItemMenuItem({ label: t("menuWatched"), type: tabType })
                watchedItem.mount()
                watchedItem.onClick((e) => {
                    const ep = episodeOf(e)
                    const media = mediaOf(ep)
                    const num = ep.progressNumber || ep.episodeNumber
                    if (!media.id || !num) return
                    try {
                        $anilist.updateEntryProgress(media.id, num, media.episodes || undefined)
                        try { $anilist.refreshAnimeCollection() } catch (err) {}
                        ctx.toast.success(t("menuWatchedDone", num))
                    }
                    catch (err) {
                        ctx.toast.error(t("menuFailed", errMsg(err)))
                    }
                })
                const playItem = ctx.action.newEpisodeGridItemMenuItem({ label: t("menuPlay"), type: tabType })
                playItem.mount()
                playItem.onClick((e) => {
                    const ep = episodeOf(e)
                    const media = mediaOf(ep)
                    if (media.id && ep.episodeNumber) {
                        ctx.screen.navigateTo("/entry", { id: String(media.id), tab: "onlinestream", episode: String(ep.episodeNumber) })
                    }
                })
            }
            catch (e) {
                console.warn("viktempest-ui extras: episode menu", e)
            }
        }

        // -----------------------------------------------------------------------------------------
        // Quick search (Ctrl+K, Cmd+K on a Mac)

        let palette = null
        if (pref("quickSearch", "yes") === "yes") {
            try {
                palette = ctx.newCommandPalette({ placeholder: t("quickHint"), keyboardShortcut: "mod+k" })
                const fill = () => {
                    const items = [
                        { label: t("quickSettings"), value: "action " + t("quickSettings"), heading: t("quickActions"), filterType: "includes", onSelect: () => { palette.close(); openSettings() } },
                        { label: t("quickSaver"), value: "action " + t("quickSaver"), heading: t("quickActions"), filterType: "includes", onSelect: () => { palette.close(); showSaver() } },
                        { label: t("quickSleep30"), value: "action " + t("quickSleep30"), heading: t("quickActions"), filterType: "includes", onSelect: () => { palette.close(); sleep.set(30) } },
                    ]
                    if (sleep.until || sleep.afterEp) {
                        items.push({ label: t("quickSleepOff"), value: "action " + t("quickSleepOff"), heading: t("quickActions"), filterType: "includes", onSelect: () => { palette.close(); sleep.set(0) } })
                    }
                    const statusText = t("status") || {}
                    const order = { CURRENT: 0, REPEATING: 0, PAUSED: 1, PLANNING: 2, COMPLETED: 3, DROPPED: 4 }
                    listEntries()
                        .sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5))
                        .forEach((entry) => {
                            const m = entry.media
                            const tl = m.title || {}
                            const name = titleOf(m)
                            if (!name) return
                            const st = statusText[entry.status] || ""
                            items.push({
                                label: name + (st ? "  ·  " + st : ""),
                                // all title versions, so English and Romaji both find it
                                value: [name, tl.english, tl.romaji, tl.native, m.id].filter(Boolean).join(" | "),
                                heading: t("quickList"),
                                filterType: "includes",
                                onSelect: () => {
                                    palette.close()
                                    ctx.screen.navigateTo("/entry", { id: String(m.id) })
                                },
                            })
                        })
                    palette.setItems(items)
                }
                palette.onOpen(fill)
            }
            catch (e) {
                console.warn("viktempest-ui extras: quick search", e)
            }
        }

        // -----------------------------------------------------------------------------------------
        // Tray: sleep timer, quick search and new seasons below the settings button

        if (share.traySections && tray) {
            // Click handlers are made once: the render function only builds components
            const ev = {
                sleep15: ctx.eventHandler("vsx-sleep15", () => sleep.set(15)),
                sleep30: ctx.eventHandler("vsx-sleep30", () => sleep.set(30)),
                sleep60: ctx.eventHandler("vsx-sleep60", () => sleep.set(60)),
                sleepEp: ctx.eventHandler("vsx-sleepEp", () => sleep.set("ep")),
                sleepOff: ctx.eventHandler("vsx-sleepOff", () => sleep.set(0)),
                quick: ctx.eventHandler("vsx-quick", () => { if (palette) palette.open() }),
            }
            const seasonClicks = {}
            const seasonClick = (id) => {
                if (!seasonClicks[id]) seasonClicks[id] = ctx.eventHandler("vsx-new-" + id, () => ctx.screen.navigateTo("/entry", { id: String(id) }))
                return seasonClicks[id]
            }
            const text = {
                sleepTitle: t("sleepTitle"), sleepEp: t("sleepEp"), sleepOff: t("sleepOff"),
                quick: t("quick") + " (Ctrl+K)", newTitle: t("newTitle"),
            }
            const showNew = pref("newSeasons", "yes") === "yes"
            share.traySections.push((tr) => {
                const items = []
                items.push(tr.text(text.sleepTitle + ": " + sleep.label(), { className: "font-semibold" }))
                items.push(tr.flex([
                    tr.button("15", { size: "sm", intent: "gray-subtle", onClick: ev.sleep15 }),
                    tr.button("30", { size: "sm", intent: "gray-subtle", onClick: ev.sleep30 }),
                    tr.button("60", { size: "sm", intent: "gray-subtle", onClick: ev.sleep60 }),
                    tr.button(text.sleepEp, { size: "sm", intent: "gray-subtle", onClick: ev.sleepEp }),
                    tr.button(text.sleepOff, { size: "sm", intent: "gray-subtle", onClick: ev.sleepOff }),
                ], { gap: 2 }))
                if (palette) items.push(tr.button(text.quick, { size: "sm", intent: "gray-subtle", onClick: ev.quick }))
                if (showNew && newSeasons.length) {
                    items.push(tr.text(text.newTitle, { className: "font-semibold" }))
                    newSeasons.slice(0, 8).forEach((s) => {
                        items.push(tr.button(s.title + " · " + s.state, { size: "sm", intent: "primary-subtle", onClick: seasonClick(s.id) }))
                    })
                }
                return items
            })
        }

        // -----------------------------------------------------------------------------------------
        // One clock for everything that waits

        ctx.setInterval(() => {
            sleep.check()
            saverCheck()
            if (sleep.until) trayUpdate()
        }, 30000)
        // New seasons: a few minutes after the start, then once a day
        ctx.setTimeout(() => checkNewSeasons(false), 3 * 60000)
        ctx.setInterval(() => checkNewSeasons(false), 6 * 3600 * 1000)
    })
}
