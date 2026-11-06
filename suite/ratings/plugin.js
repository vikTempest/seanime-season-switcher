/// <reference path="./plugin.d.ts" />
/// <reference path="./app.d.ts" />

// AniList Custom Ratings for Seanime
//
// Adds a "Custom Rating" section with your AniList Advanced Scoring categories (e.g. Story,
// Characters, Visuals) below Seanime's own list editor. When you click Save, the average becomes
// your score. There is also a "Rate" button on anime and manga pages (and in the media card
// context menu) that opens the same rating in a separate window.
// Existing category scores are loaded from AniList, arrow keys step by 1, 0.5 or 0.1, and the
// overall score is the average of the rated categories, like on AniList. A second button,
// "Custom Lists", assigns the entry to your custom lists. Everything is saved directly to AniList.
//
// UI language: German, English, Spanish, Portuguese, Japanese (plugin setting "language").

function init() {

    // ---------------------------------------------------------------------------------------------
    // Save hooks for Seanime's own list editor.
    //
    // When you change categories in the "Custom Rating" section of the editor, the plugin stores
    // the pending rating in $store. When you then click Seanime's Save button, these hooks put the
    // average in as your score and save the category scores to AniList.
    // Hooks run in their own runtime, so everything they need is inside them.

    $app.onPreUpdateEntry((e) => {
        try {
            const pending = $store.get("acr:pending:" + e.mediaId)
            const fresh = pending && pending.time && (Date.now() - pending.time) < 30 * 60 * 1000
            if (fresh && pending.scoreRaw !== null && pending.scoreRaw !== undefined) {
                e.scoreRaw = pending.scoreRaw
            }
        }
        catch (err) {
            console.error("anilist-custom-ratings: pre update hook failed", err)
        }
        e.next()
    })

    $app.onPostUpdateEntry((e) => {
        try {
            // The entry changed, so the cached copy is out of date
            $store.set("acr:entry:" + e.mediaId, { time: 0 })

            const key = "acr:pending:" + e.mediaId
            const pending = $store.get(key)
            const fresh = pending && pending.time && (Date.now() - pending.time) < 30 * 60 * 1000
            if (fresh) {
                $store.set(key, { time: 0 })
            }
            // Only the score changed: the pre update hook already saved it, no extra request needed
            if (fresh && pending.advancedScores && pending.advancedScores.length) {
                const token = $database.anilist.getToken()
                if (token) {
                    const variables = { mediaId: e.mediaId, advancedScores: pending.advancedScores }
                    if (pending.scoreRaw !== null && pending.scoreRaw !== undefined) variables.scoreRaw = pending.scoreRaw
                    $anilist.customQuery({
                        query: "mutation ($mediaId: Int, $advancedScores: [Float], $scoreRaw: Int) { SaveMediaListEntry(mediaId: $mediaId, advancedScores: $advancedScores, scoreRaw: $scoreRaw) { id } }",
                        variables: variables,
                    }, token)
                }
            }
        }
        catch (err) {
            console.error("anilist-custom-ratings: saving category scores failed", err)
        }
        e.next()
    })

    $ui.register((ctx) => {

        // -----------------------------------------------------------------------------------------
        // Translations

        const I18N = {
            en: {
                anime: "anime", manga: "manga",
                rate: "Rate", lists: "Custom Lists",
                rateMenu: "Rate (categories)", listsMenu: "Custom Lists",
                ratingTitle: "Rate: {0}", listsTitle: "Custom Lists: {0}",
                loading: "Loading your settings from AniList…",
                error: "Error",
                notOnList: "This {0} is not on your list yet. Saving will add it as \"Planning\".",
                noCategoriesTitle: "No categories set up",
                noCategoriesDesc: "On anilist.co go to Settings → Lists, enable \"Advanced Scoring\" for your {0} list and add your categories. They will show up here afterwards.",
                current: "Currently on AniList: {0} / {1}",
                total: "Overall (average): {0} / {1}",
                totalInvalid: "Overall: please only enter numbers from 0 to {0}",
                step: "Arrow key step",
                stepHint: "Steps of 0.5 and 0.1 need the \"10 Point Decimal\" scoring system on AniList.",
                cancel: "Cancel", save: "Save",
                savedScore: "Rating saved: {0}",
                saveFailed: "Saving failed: {0}",
                enterNumber: "\"{0}\": please enter a number from 0 to {1}.",
                notLoggedIn: "You are not logged in to AniList in Seanime.",
                accountFailed: "Could not load your AniList account.",
                unknownError: "Unknown error",
                noLists: "You have no {0} custom lists yet. Create one below.",
                hideStatus: "Hide from status lists (only show in custom lists). Seanime then no longer shows it under Watching or Continue Watching.",
                newListPh: "New {0} custom list…",
                create: "Create",
                listExists: "The list \"{0}\" already exists.",
                listCreated: "List \"{0}\" created and selected. Click Save to apply.",
                listCreateFailed: "Could not create the list: {0}",
                savedLists: "Saved: {0}",
                savedNoLists: "Saved: in no custom list",
                editorTitle: "Custom Rating",
                editorAvg: "Average: {0} / {1}",
                editorScore: "Saved as Score: {0}",
                editorHint: "Change a category and the average becomes your Score when you click Save.",
                editorNotFound: "Could not detect this title. Use the \"Rate\" button on its page instead.",
                editorLoading: "Loading your categories…",
                editorNoCategories: "No rating categories set up. On anilist.co go to Settings → Lists → Advanced Scoring.",
                setupTitle: "Set up your rating categories",
                setupDesc: "You don't have any categories yet. Enter them separated by commas and the plugin sets them up on your AniList account for your {0} list (Advanced Scoring is turned on for you).",
                setupDefault: "Story, Characters, Animation, Music, Enjoyment",
                setupButton: "Set up categories",
                setupDone: "Categories set up: {0}",
                setupFailed: "Could not set up categories: {0}",
                setupEmpty: "Please enter at least one category.",
                trayTitle: "AniList Custom Ratings",
                trayHowTo: "Rate with the \"Rate\" button on an anime or manga page, or with the edit button (pencil) on a card: your categories appear below the normal fields.",
                trayLoggedIn: "Logged in to AniList as {0}.",
                trayNotLoggedIn: "Not logged in to AniList. Log in to AniList in Seanime first, then the plugin works.",
                trayCats: "{0} categories: {1}",
                trayNoCats: "{0}: no categories yet.",
                traySetupAnime: "Set up for anime",
                traySetupManga: "Set up for manga",
                trayRefresh: "Refresh",
                trayRefreshed: "Updated.",
            },
            de: {
                anime: "Anime", manga: "Manga",
                rate: "Bewerten", lists: "Custom Lists",
                rateMenu: "Bewerten (Kategorien)", listsMenu: "Custom Lists",
                ratingTitle: "Bewerten: {0}", listsTitle: "Custom Lists: {0}",
                loading: "Lade deine Einstellungen von AniList…",
                error: "Fehler",
                notOnList: "Dieser {0} ist noch nicht auf deiner Liste. Beim Speichern wird er als \"Planning\" hinzugefügt.",
                noCategoriesTitle: "Keine Kategorien eingerichtet",
                noCategoriesDesc: "Aktiviere auf anilist.co unter Settings → Lists das \"Advanced Scoring\" für deine {0}-Liste und lege dort deine Kategorien an. Danach erscheinen sie hier.",
                current: "Aktuell auf AniList: {0} / {1}",
                total: "Gesamt (Durchschnitt): {0} / {1}",
                totalInvalid: "Gesamt: bitte nur Zahlen von 0 bis {0} eingeben",
                step: "Schritt mit Pfeiltasten",
                stepHint: "Schritte von 0,5 und 0,1 gehen nur mit dem Bewertungssystem \"10 Point Decimal\" auf AniList.",
                cancel: "Abbrechen", save: "Speichern",
                savedScore: "Bewertung gespeichert: {0}",
                saveFailed: "Speichern fehlgeschlagen: {0}",
                enterNumber: "\"{0}\": bitte eine Zahl von 0 bis {1} eingeben.",
                notLoggedIn: "Du bist in Seanime nicht bei AniList angemeldet.",
                accountFailed: "AniList-Konto konnte nicht geladen werden.",
                unknownError: "Unbekannter Fehler",
                noLists: "Du hast noch keine {0} Custom Lists. Leg unten eine an.",
                hideStatus: "In den Status-Listen ausblenden (nur in Custom Lists zeigen). Seanime zeigt den Titel dann nicht mehr unter Watching und Continue Watching.",
                newListPh: "Neue {0} Custom List…",
                create: "Anlegen",
                listExists: "Die Liste \"{0}\" gibt es schon.",
                listCreated: "Liste \"{0}\" angelegt und ausgewählt. Zum Übernehmen auf Speichern klicken.",
                listCreateFailed: "Liste konnte nicht angelegt werden: {0}",
                savedLists: "Gespeichert: {0}",
                savedNoLists: "Gespeichert: in keiner Custom List",
                editorTitle: "Custom Rating",
                editorAvg: "Durchschnitt: {0} / {1}",
                editorScore: "Wird als Score gespeichert: {0}",
                editorHint: "Ändere eine Kategorie, dann wird der Durchschnitt beim Speichern dein Score.",
                editorNotFound: "Titel konnte nicht erkannt werden. Nutze stattdessen den Button \"Bewerten\" auf seiner Seite.",
                editorLoading: "Lade deine Kategorien…",
                editorNoCategories: "Keine Bewertungskategorien eingerichtet. Auf anilist.co unter Settings → Lists → Advanced Scoring.",
                setupTitle: "Bewertungskategorien einrichten",
                setupDesc: "Du hast noch keine Kategorien. Gib sie mit Komma getrennt ein, dann richtet das Plugin sie auf deinem AniList-Konto für deine {0}-Liste ein (Advanced Scoring wird dabei eingeschaltet).",
                setupDefault: "Story, Charaktere, Animation, Musik, Spaß",
                setupButton: "Kategorien einrichten",
                setupDone: "Kategorien eingerichtet: {0}",
                setupFailed: "Kategorien konnten nicht eingerichtet werden: {0}",
                setupEmpty: "Bitte gib mindestens eine Kategorie ein.",
                trayTitle: "AniList Custom Ratings",
                trayHowTo: "Bewerten kannst du mit dem Button „Bewerten“ auf einer Anime- oder Manga-Seite oder mit dem Bearbeiten-Button (Stift) auf einer Karte: Deine Kategorien erscheinen dort unter den normalen Feldern.",
                trayLoggedIn: "Bei AniList angemeldet als {0}.",
                trayNotLoggedIn: "Nicht bei AniList angemeldet. Melde dich zuerst in Seanime bei AniList an, dann funktioniert das Plugin.",
                trayCats: "{0}-Kategorien: {1}",
                trayNoCats: "{0}: noch keine Kategorien.",
                traySetupAnime: "Für Anime einrichten",
                traySetupManga: "Für Manga einrichten",
                trayRefresh: "Aktualisieren",
                trayRefreshed: "Aktualisiert.",
            },
            es: {
                anime: "anime", manga: "manga",
                rate: "Calificar", lists: "Listas personalizadas",
                rateMenu: "Calificar (categorías)", listsMenu: "Listas personalizadas",
                ratingTitle: "Calificar: {0}", listsTitle: "Listas personalizadas: {0}",
                loading: "Cargando tus ajustes de AniList…",
                error: "Error",
                notOnList: "Este {0} aún no está en tu lista. Al guardar se añadirá como \"Planning\".",
                noCategoriesTitle: "No hay categorías configuradas",
                noCategoriesDesc: "En anilist.co ve a Settings → Lists, activa \"Advanced Scoring\" para tu lista de {0} y añade tus categorías. Después aparecerán aquí.",
                current: "Actualmente en AniList: {0} / {1}",
                total: "Total (promedio): {0} / {1}",
                totalInvalid: "Total: introduce solo números del 0 al {0}",
                step: "Paso con las flechas",
                stepHint: "Los pasos de 0,5 y 0,1 requieren el sistema de puntuación \"10 Point Decimal\" en AniList.",
                cancel: "Cancelar", save: "Guardar",
                savedScore: "Calificación guardada: {0}",
                saveFailed: "No se pudo guardar: {0}",
                enterNumber: "\"{0}\": introduce un número del 0 al {1}.",
                notLoggedIn: "No has iniciado sesión en AniList en Seanime.",
                accountFailed: "No se pudo cargar tu cuenta de AniList.",
                unknownError: "Error desconocido",
                noLists: "Aún no tienes listas personalizadas de {0}. Crea una abajo.",
                hideStatus: "Ocultar de las listas de estado (mostrar solo en listas personalizadas). Seanime ya no lo mostrará en Watching ni en Continue Watching.",
                newListPh: "Nueva lista personalizada de {0}…",
                create: "Crear",
                listExists: "La lista \"{0}\" ya existe.",
                listCreated: "Lista \"{0}\" creada y seleccionada. Pulsa Guardar para aplicar.",
                listCreateFailed: "No se pudo crear la lista: {0}",
                savedLists: "Guardado: {0}",
                savedNoLists: "Guardado: en ninguna lista personalizada",
                editorTitle: "Calificación personalizada",
                editorAvg: "Promedio: {0} / {1}",
                editorScore: "Se guardará como Score: {0}",
                editorHint: "Cambia una categoría y el promedio será tu Score al pulsar Save.",
                editorNotFound: "No se pudo detectar este título. Usa el botón \"Calificar\" en su página.",
                editorLoading: "Cargando tus categorías…",
                editorNoCategories: "No hay categorías configuradas. En anilist.co ve a Settings → Lists → Advanced Scoring.",
                setupTitle: "Configura tus categorías de calificación",
                setupDesc: "Aún no tienes categorías. Escríbelas separadas por comas y el plugin las configurará en tu cuenta de AniList para tu lista de {0} (Advanced Scoring se activa automáticamente).",
                setupDefault: "Historia, Personajes, Animación, Música, Disfrute",
                setupButton: "Configurar categorías",
                setupDone: "Categorías configuradas: {0}",
                setupFailed: "No se pudieron configurar las categorías: {0}",
                setupEmpty: "Escribe al menos una categoría.",
                trayTitle: "AniList Custom Ratings",
                trayHowTo: "Califica con el botón \"Calificar\" en la página de un anime o manga, o con el botón de editar (lápiz) en una tarjeta: tus categorías aparecen debajo de los campos normales.",
                trayLoggedIn: "Sesión de AniList iniciada como {0}.",
                trayNotLoggedIn: "No has iniciado sesión en AniList. Inicia sesión en AniList dentro de Seanime y el plugin funcionará.",
                trayCats: "Categorías de {0}: {1}",
                trayNoCats: "{0}: aún no hay categorías.",
                traySetupAnime: "Configurar para anime",
                traySetupManga: "Configurar para manga",
                trayRefresh: "Actualizar",
                trayRefreshed: "Actualizado.",
            },
            pt: {
                anime: "anime", manga: "mangá",
                rate: "Avaliar", lists: "Listas personalizadas",
                rateMenu: "Avaliar (categorias)", listsMenu: "Listas personalizadas",
                ratingTitle: "Avaliar: {0}", listsTitle: "Listas personalizadas: {0}",
                loading: "Carregando suas configurações do AniList…",
                error: "Erro",
                notOnList: "Este {0} ainda não está na sua lista. Ao salvar, ele será adicionado como \"Planning\".",
                noCategoriesTitle: "Nenhuma categoria configurada",
                noCategoriesDesc: "No anilist.co, vá em Settings → Lists, ative o \"Advanced Scoring\" para a sua lista de {0} e adicione suas categorias. Depois elas aparecerão aqui.",
                current: "Atualmente no AniList: {0} / {1}",
                total: "Total (média): {0} / {1}",
                totalInvalid: "Total: digite apenas números de 0 a {0}",
                step: "Passo com as setas",
                stepHint: "Passos de 0,5 e 0,1 exigem o sistema de notas \"10 Point Decimal\" no AniList.",
                cancel: "Cancelar", save: "Salvar",
                savedScore: "Avaliação salva: {0}",
                saveFailed: "Falha ao salvar: {0}",
                enterNumber: "\"{0}\": digite um número de 0 a {1}.",
                notLoggedIn: "Você não está conectado ao AniList no Seanime.",
                accountFailed: "Não foi possível carregar sua conta do AniList.",
                unknownError: "Erro desconhecido",
                noLists: "Você ainda não tem listas personalizadas de {0}. Crie uma abaixo.",
                hideStatus: "Ocultar das listas de status (mostrar só nas listas personalizadas). O Seanime deixa de mostrá-lo em Watching e Continue Watching.",
                newListPh: "Nova lista personalizada de {0}…",
                create: "Criar",
                listExists: "A lista \"{0}\" já existe.",
                listCreated: "Lista \"{0}\" criada e selecionada. Clique em Salvar para aplicar.",
                listCreateFailed: "Não foi possível criar a lista: {0}",
                savedLists: "Salvo: {0}",
                savedNoLists: "Salvo: em nenhuma lista personalizada",
                editorTitle: "Avaliação personalizada",
                editorAvg: "Média: {0} / {1}",
                editorScore: "Será salvo como Score: {0}",
                editorHint: "Altere uma categoria e a média vira seu Score ao clicar em Save.",
                editorNotFound: "Não foi possível detectar este título. Use o botão \"Avaliar\" na página dele.",
                editorLoading: "Carregando suas categorias…",
                editorNoCategories: "Nenhuma categoria configurada. No anilist.co vá em Settings → Lists → Advanced Scoring.",
                setupTitle: "Configure suas categorias de avaliação",
                setupDesc: "Você ainda não tem categorias. Digite-as separadas por vírgula e o plugin as configura na sua conta do AniList para a sua lista de {0} (o Advanced Scoring é ativado automaticamente).",
                setupDefault: "História, Personagens, Animação, Música, Diversão",
                setupButton: "Configurar categorias",
                setupDone: "Categorias configuradas: {0}",
                setupFailed: "Não foi possível configurar as categorias: {0}",
                setupEmpty: "Digite pelo menos uma categoria.",
                trayTitle: "AniList Custom Ratings",
                trayHowTo: "Avalie com o botão \"Avaliar\" na página de um anime ou mangá, ou com o botão de editar (lápis) em um card: suas categorias aparecem abaixo dos campos normais.",
                trayLoggedIn: "Conectado ao AniList como {0}.",
                trayNotLoggedIn: "Você não está conectado ao AniList. Entre no AniList pelo Seanime e o plugin vai funcionar.",
                trayCats: "Categorias de {0}: {1}",
                trayNoCats: "{0}: ainda sem categorias.",
                traySetupAnime: "Configurar para anime",
                traySetupManga: "Configurar para mangá",
                trayRefresh: "Atualizar",
                trayRefreshed: "Atualizado.",
            },
            ja: {
                anime: "アニメ", manga: "マンガ",
                rate: "評価する", lists: "カスタムリスト",
                rateMenu: "評価する（カテゴリー）", listsMenu: "カスタムリスト",
                ratingTitle: "評価：{0}", listsTitle: "カスタムリスト：{0}",
                loading: "AniListから設定を読み込んでいます…",
                error: "エラー",
                notOnList: "この{0}はまだリストにありません。保存すると「Planning」として追加されます。",
                noCategoriesTitle: "カテゴリーが設定されていません",
                noCategoriesDesc: "anilist.co の Settings → Lists で{0}リストの「Advanced Scoring」を有効にし、カテゴリーを追加してください。追加後、ここに表示されます。",
                current: "現在のAniListのスコア：{0} / {1}",
                total: "総合（平均）：{0} / {1}",
                totalInvalid: "総合：0〜{0}の数字のみ入力してください",
                step: "矢印キーの刻み",
                stepHint: "0.5と0.1の刻みは、AniListの採点方式が「10 Point Decimal」の場合のみ使えます。",
                cancel: "キャンセル", save: "保存",
                savedScore: "評価を保存しました：{0}",
                saveFailed: "保存に失敗しました：{0}",
                enterNumber: "「{0}」：0〜{1}の数字を入力してください。",
                notLoggedIn: "SeanimeでAniListにログインしていません。",
                accountFailed: "AniListアカウントを読み込めませんでした。",
                unknownError: "不明なエラー",
                noLists: "{0}のカスタムリストはまだありません。下で作成できます。",
                hideStatus: "ステータスリストから非表示にする（カスタムリストのみに表示）。SeanimeのWatchingやContinue Watchingにも表示されなくなります。",
                newListPh: "新しい{0}カスタムリスト…",
                create: "作成",
                listExists: "リスト「{0}」はすでに存在します。",
                listCreated: "リスト「{0}」を作成して選択しました。保存を押すと反映されます。",
                listCreateFailed: "リストを作成できませんでした：{0}",
                savedLists: "保存しました：{0}",
                savedNoLists: "保存しました：カスタムリストなし",
                editorTitle: "カスタム評価",
                editorAvg: "平均：{0} / {1}",
                editorScore: "スコアとして保存：{0}",
                editorHint: "カテゴリーを変更すると、Saveを押したときに平均がスコアになります。",
                editorNotFound: "この作品を判別できませんでした。作品ページの「評価する」ボタンを使ってください。",
                editorLoading: "カテゴリーを読み込んでいます…",
                editorNoCategories: "評価カテゴリーがありません。anilist.co の Settings → Lists → Advanced Scoring で設定してください。",
                setupTitle: "評価カテゴリーを設定する",
                setupDesc: "まだカテゴリーがありません。カンマ区切りで入力すると、プラグインがAniListアカウントの{0}リストに設定します（Advanced Scoringも自動で有効になります）。",
                setupDefault: "ストーリー, キャラクター, 作画, 音楽, 楽しさ",
                setupButton: "カテゴリーを設定",
                setupDone: "カテゴリーを設定しました：{0}",
                setupFailed: "カテゴリーを設定できませんでした：{0}",
                setupEmpty: "カテゴリーを1つ以上入力してください。",
                trayTitle: "AniList Custom Ratings",
                trayHowTo: "アニメ・マンガのページの「評価する」ボタン、またはカードの編集ボタン（鉛筆）から評価できます。カテゴリーは通常の項目の下に表示されます。",
                trayLoggedIn: "AniListに{0}としてログインしています。",
                trayNotLoggedIn: "AniListにログインしていません。まずSeanimeでAniListにログインしてください。",
                trayCats: "{0}のカテゴリー：{1}",
                trayNoCats: "{0}：カテゴリーはまだありません。",
                traySetupAnime: "アニメ用に設定",
                traySetupManga: "マンガ用に設定",
                trayRefresh: "更新",
                trayRefreshed: "更新しました。",
            },
        }

        function pref(key, fallback) {
            try {
                const v = $getUserPreference(key)
                return v ? String(v) : fallback
            }
            catch (e) {
                return fallback
            }
        }

        const LANG = I18N[pref("language", "en")] ? pref("language", "en") : "en"

        function t(key) {
            let str = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key
            for (let i = 1; i < arguments.length; i++) {
                str = str.split("{" + (i - 1) + "}").join(String(arguments[i]))
            }
            return str
        }

        // -----------------------------------------------------------------------------------------
        // GraphQL

        const QUERY_VIEWER = `query {
  Viewer {
    id
    name
    mediaListOptions {
      scoreFormat
      animeList { customLists advancedScoring advancedScoringEnabled }
      mangaList { customLists advancedScoring advancedScoringEnabled }
    }
  }
}`

        const QUERY_ENTRY = `query ($mediaId: Int, $userId: Int) {
  MediaList(mediaId: $mediaId, userId: $userId) {
    id
    status
    score
    advancedScores
    hiddenFromStatusLists
    customLists(asArray: true)
  }
}`

        // Recent entries, used to find out on which scale AniList stored your category scores
        const QUERY_RECENT_SCORES = `query ($userId: Int, $type: MediaType) {
  Page(perPage: 50) {
    mediaList(userId: $userId, type: $type, sort: UPDATED_TIME_DESC) { advancedScores }
  }
}`

        const MUTATION_SAVE_SCORES = `mutation ($mediaId: Int, $score: Float, $advancedScores: [Float], $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, score: $score, advancedScores: $advancedScores, status: $status) {
    id
    status
    score
    advancedScores
  }
}`

        const MUTATION_SAVE_LISTS = `mutation ($mediaId: Int, $customLists: [String], $hidden: Boolean, $status: MediaListStatus) {
  SaveMediaListEntry(mediaId: $mediaId, customLists: $customLists, hiddenFromStatusLists: $hidden, status: $status) {
    id
    status
    hiddenFromStatusLists
    customLists(asArray: true)
  }
}`

        const MUTATION_ANIME_LISTS = `mutation ($lists: [String]) {
  UpdateUser(animeListOptions: { customLists: $lists }) { id }
}`

        const MUTATION_MANGA_LISTS = `mutation ($lists: [String]) {
  UpdateUser(mangaListOptions: { customLists: $lists }) { id }
}`

        const MUTATION_SETUP_ANIME = `mutation ($names: [String]) {
  UpdateUser(animeListOptions: { advancedScoring: $names, advancedScoringEnabled: true }) { id }
}`

        const MUTATION_SETUP_MANGA = `mutation ($names: [String]) {
  UpdateUser(mangaListOptions: { advancedScoring: $names, advancedScoringEnabled: true }) { id }
}`

        // -----------------------------------------------------------------------------------------
        // Score scales

        const SCALES = {
            POINT_100: { max: 100, decimals: 0, steps: ["1", "5", "10"] },
            POINT_10_DECIMAL: { max: 10, decimals: 1, steps: ["1", "0.5", "0.1"] },
            POINT_10: { max: 10, decimals: 0, steps: ["1"] },
            POINT_5: { max: 5, decimals: 0, steps: ["1"] },
            POINT_3: { max: 3, decimals: 0, steps: ["1"] },
        }

        // Max number of rating categories shown (one field reference each)
        const MAX_CATEGORIES = 20

        // -----------------------------------------------------------------------------------------
        // State

        const s = {
            mode: "rating",     // "rating" | "lists"
            media: null,        // { id, title, type: "ANIME" | "MANGA" }
            loading: false,
            saving: false,
            error: "",
            userId: 0,
            scoreFormat: "",
            categories: [],     // advanced scoring categories for this media type
            storedFactor: 1,    // stored category value = displayed value * storedFactor
            step: pref("step", "1"),
            lists: [],          // custom list names for this media type
            selected: {},       // list name -> boolean
            hidden: false,      // hiddenFromStatusLists
            entryExists: false,
            entryScore: 0,
            newListName: "",
            setupNames: "",
        }

        const modal = ctx.newModal({ title: "AniList" })

        // Category score fields. Field references keep the typed values in sync with the client,
        // and let the +/- buttons change the value shown in the input.
        const scoreRefs = []
        for (let i = 0; i < MAX_CATEGORIES; i++) {
            const ref = ctx.fieldRef("")
            ref.onValueChange(() => modal.update())
            scoreRefs.push(ref)
        }

        // Scale detection per media type, cached for the session

        // -----------------------------------------------------------------------------------------
        // Helpers

        function plain(v) {
            // Convert Go values into plain JS objects/arrays
            return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v))
        }

        function getToken() {
            try {
                return $database.anilist.getToken() || ""
            }
            catch (e) {
                return ""
            }
        }

        function query(body) {
            const token = getToken()
            if (!token) throw new Error(t("notLoggedIn"))
            return plain($anilist.customQuery(body, token))
        }

        // AniList only allows a limited number of requests per minute, shared with Seanime itself.
        // So the plugin remembers your account settings and entries for a while instead of asking
        // AniList every time a window opens.
        const VIEWER_TTL = 30 * 60 * 1000
        const ENTRY_TTL = 10 * 60 * 1000

        function cached(key, ttl) {
            const c = $store.get(key)
            if (c && c.time && (Date.now() - c.time) < ttl) return c
            return null
        }

        function getViewer() {
            const token = getToken()
            if (!token) throw new Error(t("notLoggedIn"))
            const account = token.slice(-16)
            const c = cached("acr:viewer", VIEWER_TTL)
            if (c && c.account === account && c.viewer) return plain(c.viewer)
            const viewer = (query({ query: QUERY_VIEWER }) || {}).Viewer
            if (!viewer) throw new Error(t("accountFailed"))
            $store.set("acr:viewer", { time: Date.now(), account: account, viewer: viewer })
            return viewer
        }

        function forgetViewer() {
            $store.set("acr:viewer", { time: 0 })
        }

        // Your list entry for a title, or null when it is not on your list
        function getEntry(mediaId, userId) {
            const key = "acr:entry:" + mediaId
            const c = cached(key, ENTRY_TTL)
            if (c && c.userId === userId) return c.entry ? plain(c.entry) : null
            let entry = null
            try {
                const res = query({ query: QUERY_ENTRY, variables: { mediaId: mediaId, userId: userId } })
                entry = (res && res.MediaList) || null
            }
            catch (e) {
                // AniList answers with "Not Found." when the media is not on the user's list
                if (!/not found/i.test(errMsg(e))) throw e
            }
            $store.set(key, { time: Date.now(), userId: userId, entry: entry })
            return entry
        }

        function forgetEntry(mediaId) {
            $store.set("acr:entry:" + mediaId, { time: 0 })
        }

        function errMsg(e) {
            if (!e) return t("unknownError")
            if (typeof e === "string") return e
            return e.message || String(e)
        }

        function titleOf(media) {
            const ti = (media && media.title) || {}
            return ti.userPreferred || ti.english || ti.romaji || ti.native || ("#" + (media && media.id))
        }

        function kindOf(type) {
            return type === "MANGA" ? t("manga") : t("anime")
        }

        function scale() {
            return SCALES[s.scoreFormat] || SCALES.POINT_100
        }

        function round(n, decimals) {
            const f = Math.pow(10, decimals)
            return Math.round(n * f) / f
        }

        function formatNum(n) {
            return String(round(n, scale().decimals))
        }

        function validStep() {
            const steps = scale().steps
            return steps.indexOf(s.step) !== -1 ? s.step : steps[0]
        }

        // Parses a typed score; returns null when the input is invalid
        function parseScore(str) {
            const sc = scale()
            const v = String(str === undefined || str === null ? "" : str).trim().replace(",", ".")
            if (v === "") return 0
            if (!/^\d+(\.\d+)?$/.test(v) && !/^\.\d+$/.test(v)) return null
            const n = parseFloat(v)
            if (isNaN(n) || n < 0 || n > sc.max) return null
            return round(n, sc.decimals)
        }

        function categoryValue(i) {
            const v = scoreRefs[i].current
            return v === undefined || v === null ? "" : String(v)
        }

        // Average of all rated (non-zero) categories, like AniList does
        function average() {
            let sum = 0, count = 0
            for (let i = 0; i < s.categories.length; i++) {
                const n = parseScore(categoryValue(i))
                if (n === null) return null
                if (n > 0) {
                    sum += n
                    count++
                }
            }
            if (!count) return 0
            return round(sum / count, scale().decimals)
        }

        function numbersOf(adv) {
            const out = []
            if (!adv || typeof adv !== "object") return out
            for (const k in adv) {
                const n = Number(adv[k])
                if (!isNaN(n)) out.push(n)
            }
            return out
        }

        // AniList stores category scores as 0–100 values. Depending on how they were saved they can
        // also be on your score format's scale. We look at your existing scores to find out.
        function detectStoredFactor(entryAdv, scoreFormat, type, userId) {
            const sc = SCALES[scoreFormat] || SCALES.POINT_100
            if (sc.max >= 100) return 1
            const cacheKey = type + ":" + scoreFormat
            let values = numbersOf(entryAdv).filter((n) => n > 0)
            if (!values.length) {
                const known = $store.get("acr:factor:" + userId + ":" + cacheKey)
                if (known) return known
                try {
                    const res = query({ query: QUERY_RECENT_SCORES, variables: { userId: userId, type: type } })
                    const entries = (res && res.Page && res.Page.mediaList) || []
                    for (let i = 0; i < entries.length; i++) {
                        values = values.concat(numbersOf(entries[i].advancedScores).filter((n) => n > 0))
                    }
                }
                catch (e) {
                    console.warn("anilist-custom-ratings: could not detect score scale", e)
                }
            }
            let factor = 1
            if (values.length && values.some((n) => n > sc.max)) factor = 100 / sc.max
            if (values.length) $store.set("acr:factor:" + userId + ":" + cacheKey, factor)
            return factor
        }

        function parseEntryCustomLists(raw) {
            // asArray: true -> [{ name, enabled }], fallback: { name: bool }
            const out = {}
            if (!raw) return out
            if (Array.isArray(raw)) {
                for (let i = 0; i < raw.length; i++) {
                    if (raw[i] && raw[i].name) out[raw[i].name] = !!raw[i].enabled
                }
            } else if (typeof raw === "object") {
                for (const k in raw) out[k] = !!raw[k]
            }
            return out
        }

        function refreshCollection(type) {
            try {
                if (type === "MANGA") $anilist.refreshMangaCollection()
                else $anilist.refreshAnimeCollection()
            }
            catch (e) {
                console.warn("anilist-custom-ratings: refresh failed", e)
            }
        }

        // -----------------------------------------------------------------------------------------
        // Arrow key stepping: turn the score fields into number inputs with the chosen step

        function applyInputAttributes(elements) {
            const sc = scale()
            const step = validStep()
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i]
                try {
                    el.setAttribute("type", "number")
                    el.setAttribute("inputmode", "decimal")
                    el.setAttribute("min", "0")
                    el.setAttribute("max", String(sc.max))
                    el.setAttribute("step", step)
                }
                catch (e) {
                    console.warn("anilist-custom-ratings: could not set input attributes", e)
                }
            }
        }

        let refetchInputs = null
        ctx.dom.onReady(() => {
            const observer = ctx.dom.observe(".acr-score input", (elements) => applyInputAttributes(elements))
            refetchInputs = observer && observer[1]
        })

        function reapplyStep() {
            if (refetchInputs) {
                try {
                    refetchInputs()
                }
                catch (e) {
                    // ignore
                }
            }
        }

        function nudge(i, direction) {
            const sc = scale()
            const step = parseFloat(validStep())
            const current = parseScore(categoryValue(i)) || 0
            let next = round(current + direction * step, sc.decimals)
            if (next < 0) next = 0
            if (next > sc.max) next = sc.max
            scoreRefs[i].setValue(next ? formatNum(next) : "")
            modal.update()
        }

        // -----------------------------------------------------------------------------------------
        // Loading and saving

        function load() {
            s.loading = true
            s.error = ""
            modal.update()
            try {
                const viewer = getViewer()
                s.userId = viewer.id
                const opts = viewer.mediaListOptions || {}
                const listOpts = (s.media.type === "MANGA" ? opts.mangaList : opts.animeList) || {}
                s.scoreFormat = opts.scoreFormat || "POINT_100"
                s.categories = (listOpts.advancedScoring || []).filter((n) => !!n).slice(0, MAX_CATEGORIES)
                s.lists = (listOpts.customLists || []).filter((n) => !!n)

                s.selected = {}
                s.hidden = false
                s.entryExists = false
                s.entryScore = 0
                let adv = null
                const entry = getEntry(s.media.id, s.userId)
                if (entry) {
                    s.entryExists = true
                    s.entryScore = Number(entry.score) || 0
                    s.hidden = !!entry.hiddenFromStatusLists
                    s.selected = parseEntryCustomLists(entry.customLists)
                    adv = entry.advancedScores
                    if (typeof adv === "string") {
                        try {
                            adv = JSON.parse(adv)
                        }
                        catch (e) {
                            adv = null
                        }
                    }
                }

                if (s.mode === "rating") {
                    s.storedFactor = detectStoredFactor(adv, s.scoreFormat, s.media.type, s.userId)
                    for (let i = 0; i < s.categories.length; i++) {
                        const raw = adv ? Number(adv[s.categories[i]]) : 0
                        const shown = raw ? raw / s.storedFactor : 0
                        scoreRefs[i].setValue(shown ? formatNum(shown) : "")
                    }
                }
            }
            catch (e) {
                s.error = errMsg(e)
            }
            s.loading = false
            modal.update()
        }

        function saveScores() {
            if (s.saving) return
            const advancedScores = []
            for (let i = 0; i < s.categories.length; i++) {
                const n = parseScore(categoryValue(i))
                if (n === null) {
                    ctx.toast.warning(t("enterNumber", s.categories[i], scale().max))
                    return
                }
                advancedScores.push(round(n * s.storedFactor, 1))
            }
            const score = average()

            s.saving = true
            s.error = ""
            modal.update()
            try {
                const variables = { mediaId: s.media.id, score: score, advancedScores: advancedScores }
                if (!s.entryExists) variables.status = "PLANNING"
                const res = query({ query: MUTATION_SAVE_SCORES, variables: variables })
                forgetEntry(s.media.id)
                const entry = res && res.SaveMediaListEntry
                if (entry) {
                    s.entryExists = true
                    s.entryScore = Number(entry.score) || 0
                }
                refreshCollection(s.media.type)
                ctx.toast.success(t("savedScore", formatNum(score)))
                modal.close()
            }
            catch (e) {
                s.error = errMsg(e)
                ctx.toast.error(t("saveFailed", s.error))
            }
            s.saving = false
            modal.update()
        }

        function saveLists() {
            if (s.saving) return
            s.saving = true
            s.error = ""
            modal.update()
            try {
                const names = s.lists.filter((n) => !!s.selected[n])
                const variables = { mediaId: s.media.id, customLists: names, hidden: s.hidden }
                if (!s.entryExists) variables.status = "PLANNING"
                const res = query({ query: MUTATION_SAVE_LISTS, variables: variables })
                forgetEntry(s.media.id)
                const entry = res && res.SaveMediaListEntry
                if (entry) {
                    s.entryExists = true
                    s.hidden = !!entry.hiddenFromStatusLists
                    s.selected = parseEntryCustomLists(entry.customLists)
                }
                refreshCollection(s.media.type)
                ctx.toast.success(names.length ? t("savedLists", names.join(", ")) : t("savedNoLists"))
                modal.close()
            }
            catch (e) {
                s.error = errMsg(e)
                ctx.toast.error(t("saveFailed", s.error))
            }
            s.saving = false
            modal.update()
        }

        function createList() {
            const name = (s.newListName || "").trim()
            if (!name) return
            if (s.lists.some((n) => n.toLowerCase() === name.toLowerCase())) {
                ctx.toast.warning(t("listExists", name))
                return
            }
            s.saving = true
            modal.update()
            try {
                const lists = s.lists.concat([name])
                query({
                    query: s.media.type === "MANGA" ? MUTATION_MANGA_LISTS : MUTATION_ANIME_LISTS,
                    variables: { lists: lists },
                })
                forgetViewer()
                s.lists = lists
                s.selected[name] = true
                s.newListName = ""
                ctx.toast.success(t("listCreated", name))
            }
            catch (e) {
                ctx.toast.error(t("listCreateFailed", errMsg(e)))
            }
            s.saving = false
            modal.update()
        }

        function openFor(media, type, mode) {
            if (!media || !media.id) return
            s.mode = mode
            s.media = { id: media.id, title: titleOf(media), type: type }
            s.categories = []
            s.lists = []
            s.selected = {}
            s.newListName = ""
            s.error = ""
            s.loading = true
            for (let i = 0; i < scoreRefs.length; i++) scoreRefs[i].setValue("")
            modal.open()
            load()
        }

        // -----------------------------------------------------------------------------------------
        // First-time setup: create the rating categories on AniList for users who have none yet

        function parseCategoryNames(text) {
            const out = []
            const parts = String(text || "").split(/[,;\n、，]/)
            for (let i = 0; i < parts.length; i++) {
                const name = parts[i].trim().slice(0, 40)
                if (name && !out.some((n) => n.toLowerCase() === name.toLowerCase())) out.push(name)
            }
            return out.slice(0, MAX_CATEGORIES)
        }

        // Sets up the categories on AniList; returns the names or throws
        function setupCategories(type, text) {
            const names = parseCategoryNames(text)
            if (!names.length) throw new Error(t("setupEmpty"))
            query({ query: type === "MANGA" ? MUTATION_SETUP_MANGA : MUTATION_SETUP_ANIME, variables: { names: names } })
            forgetViewer()
            return names
        }

        function runSetupInModal() {
            if (s.saving || !s.media) return
            s.saving = true
            modal.update()
            try {
                const names = setupCategories(s.media.type, s.setupNames || t("setupDefault"))
                ctx.toast.success(t("setupDone", names.join(", ")))
                s.saving = false
                load()
                return
            }
            catch (e) {
                ctx.toast.error(t("setupFailed", errMsg(e)))
            }
            s.saving = false
            modal.update()
        }

        // -----------------------------------------------------------------------------------------
        // Rendering

        function renderRating(items, key, kind) {
            const sc = scale()

            if (s.entryExists && s.entryScore) {
                items.push(modal.text(t("current", formatNum(s.entryScore), sc.max), { className: "text-[--muted]" }))
            }

            if (!s.categories.length) {
                if (!s.setupNames) s.setupNames = t("setupDefault")
                items.push(modal.alert({
                    title: t("setupTitle"),
                    description: t("setupDesc", kind),
                    intent: "info",
                }))
                items.push(modal.input({
                    value: s.setupNames,
                    disabled: s.saving,
                    onChange: ctx.eventHandler("acr-setup-names-" + key, (e) => {
                        s.setupNames = (e && e.value) || ""
                    }),
                    className: "w-full",
                }))
                items.push(modal.flex([
                    modal.button(t("cancel"), {
                        intent: "gray-subtle",
                        onClick: ctx.eventHandler("acr-cancel", () => modal.close()),
                    }),
                    modal.button(t("setupButton"), {
                        intent: "primary",
                        loading: s.saving,
                        disabled: s.saving,
                        onClick: ctx.eventHandler("acr-setup-" + key, () => runSetupInModal()),
                    }),
                ], { gap: 2, className: "justify-end" }))
                return
            }

            const step = validStep()
            if (sc.steps.length > 1) {
                items.push(modal.select({
                    label: t("step"),
                    value: step,
                    options: sc.steps.map((v) => ({ label: LANG === "en" || LANG === "ja" ? v : v.replace(".", ","), value: v })),
                    disabled: s.saving,
                    onChange: ctx.eventHandler("acr-step", (e) => {
                        const v = e && e.value ? String(e.value) : ""
                        if (v && sc.steps.indexOf(v) !== -1) {
                            s.step = v
                            reapplyStep()
                            modal.update()
                        }
                    }),
                }))
            } else {
                items.push(modal.text(t("stepHint"), { className: "text-sm text-[--muted]" }))
            }

            const rows = s.categories.map((cat, i) => modal.flex([
                modal.input({
                    label: cat,
                    placeholder: "0–" + sc.max,
                    value: categoryValue(i),
                    fieldRef: scoreRefs[i],
                    disabled: s.saving,
                    className: "acr-score w-full",
                }),
                modal.button("−", {
                    intent: "gray-subtle",
                    disabled: s.saving,
                    onClick: ctx.eventHandler("acr-minus-" + i, () => nudge(i, -1)),
                }),
                modal.button("+", {
                    intent: "gray-subtle",
                    disabled: s.saving,
                    onClick: ctx.eventHandler("acr-plus-" + i, () => nudge(i, 1)),
                }),
            ], { gap: 2, className: "items-end" }))
            items.push(modal.stack(rows, { gap: 3 }))

            const avg = average()
            items.push(modal.text(
                avg === null ? t("totalInvalid", sc.max) : t("total", avg ? formatNum(avg) : "–", sc.max),
                { className: "font-semibold" },
            ))

            items.push(modal.flex([
                modal.button(t("cancel"), {
                    intent: "gray-subtle",
                    onClick: ctx.eventHandler("acr-cancel", () => modal.close()),
                }),
                modal.button(t("save"), {
                    intent: "primary",
                    loading: s.saving,
                    disabled: s.saving || avg === null,
                    onClick: ctx.eventHandler("acr-save-scores-" + key, () => saveScores()),
                }),
            ], { gap: 2, className: "justify-end" }))
        }

        function renderLists(items, key, kind) {
            if (!s.lists.length) {
                items.push(modal.text(t("noLists", kind), { className: "text-[--muted]" }))
            }

            const checks = s.lists.map((name) => modal.checkbox({
                label: name,
                value: !!s.selected[name],
                disabled: s.saving,
                onChange: ctx.eventHandler("acr-check-" + key + "-" + name, (e) => {
                    s.selected[name] = !!(e && e.value)
                }),
            }))
            if (checks.length) items.push(modal.stack(checks, { gap: 2 }))

            items.push(modal.switch({
                label: t("hideStatus"),
                value: !!s.hidden,
                disabled: s.saving,
                onChange: ctx.eventHandler("acr-hidden-" + key, (e) => {
                    s.hidden = !!(e && e.value)
                }),
            }))

            items.push(modal.flex([
                modal.input({
                    placeholder: t("newListPh", kind),
                    value: s.newListName,
                    disabled: s.saving,
                    onChange: ctx.eventHandler("acr-newlist-" + key, (e) => {
                        s.newListName = (e && e.value) || ""
                    }),
                    className: "w-full",
                }),
                modal.button(t("create"), {
                    intent: "gray-subtle",
                    disabled: s.saving,
                    onClick: ctx.eventHandler("acr-create-" + key, () => createList()),
                }),
            ], { gap: 2, className: "items-end" }))

            items.push(modal.flex([
                modal.button(t("cancel"), {
                    intent: "gray-subtle",
                    onClick: ctx.eventHandler("acr-cancel", () => modal.close()),
                }),
                modal.button(t("save"), {
                    intent: "primary",
                    loading: s.saving,
                    disabled: s.saving,
                    onClick: ctx.eventHandler("acr-save-lists-" + key, () => saveLists()),
                }),
            ], { gap: 2, className: "justify-end" }))
        }

        modal.render(() => {
            if (!s.media) return modal.text("")

            const items = []
            const kind = kindOf(s.media.type)
            const key = s.media.type + "-" + s.media.id

            items.push(modal.text(t(s.mode === "rating" ? "ratingTitle" : "listsTitle", s.media.title), { className: "font-semibold text-lg" }))

            if (s.loading) {
                items.push(modal.text(t("loading"), { className: "text-[--muted]" }))
                return modal.stack(items, { gap: 3 })
            }

            if (s.error) {
                items.push(modal.alert({ title: t("error"), description: s.error, intent: "alert" }))
                if (!s.userId) return modal.stack(items, { gap: 4 })
            }

            if (!s.entryExists) {
                items.push(modal.alert({ description: t("notOnList", kind), intent: "info" }))
            }

            if (s.mode === "rating") renderRating(items, key, kind)
            else renderLists(items, key, kind)

            return modal.stack(items, { gap: 4 })
        })

        // -----------------------------------------------------------------------------------------
        // Seanime's own list editor: "Custom Rating" section below the form
        //
        // The section is a webview in the "after-media-entry-form" slot. It finds out which title
        // the editor is open for, shows your categories with their current scores, and keeps the
        // pending rating in $store. The save hooks at the top of init() apply it when you click
        // Seanime's Save button. The average is also shown in Seanime's Score field.

        const PENDING_PREFIX = "acr:pending:"

        const editor = {
            media: null,        // { id, type }
            scoreFormat: "",
            categories: [],
            storedFactor: 1,
            setupMedia: null,   // title the setup form is shown for
        }

        const EDITOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #e4e4e7; font-size: 14px; }
  .wrap { padding: 12px 0 4px 0; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .title { font-weight: 600; font-size: 15px; }
  .muted { color: #a1a1aa; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px 14px; }
  label { display: block; font-weight: 500; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  input, select { box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #e4e4e7; font: inherit; outline: none; }
  select { width: auto; height: 32px; padding: 0 8px; }
  input:focus, select:focus { border-color: rgba(255,255,255,0.35); }
  input.bad { border-color: #ef4444; }
  .foot { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 12px; align-items: baseline; }
  .avg { font-weight: 600; }
  .btn { flex: none; height: 40px; padding: 0 14px; border-radius: 8px; border: 0; background: #6366f1; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  .btn:disabled { opacity: 0.6; cursor: default; }
  /* Phones and tablets: 16px text so iOS does not zoom in on tap, bigger touch targets */
  @media (hover: none), (max-width: 1023px) {
    input, select, .btn { font-size: 16px; height: 44px; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
  }
</style>
</head>
<body>
<div class="wrap" id="root"><div class="muted" id="msg"></div></div>
<script>
  var state = null;
  var timer = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmt(s, a, b) {
    return String(s).split("{0}").join(a).split("{1}").join(b);
  }

  function parse(v) {
    v = String(v === undefined || v === null ? "" : v).trim().replace(",", ".");
    if (v === "") return 0;
    if (!/^(\\d+(\\.\\d+)?|\\.\\d+)$/.test(v)) return null;
    var n = parseFloat(v);
    if (isNaN(n) || n < 0 || n > state.max) return null;
    var f = Math.pow(10, state.decimals);
    return Math.round(n * f) / f;
  }

  function average(values) {
    var sum = 0, count = 0;
    for (var i = 0; i < values.length; i++) {
      var n = parse(values[i]);
      if (n === null) return null;
      if (n > 0) { sum += n; count++; }
    }
    if (!count) return 0;
    var f = Math.pow(10, state.decimals);
    return Math.round((sum / count) * f) / f;
  }

  function showMessage(text) {
    var root = document.getElementById("root");
    root.innerHTML = "";
    root.appendChild(el("div", "muted", text));
  }

  function render() {
    var root = document.getElementById("root");
    root.innerHTML = "";

    var head = el("div", "head");
    head.appendChild(el("div", "title", state.labels.title));
    if (state.steps.length > 1) {
      var stepWrap = el("div", "muted");
      stepWrap.appendChild(document.createTextNode(state.labels.step + " "));
      var sel = el("select");
      for (var s = 0; s < state.steps.length; s++) {
        var o = el("option", "", state.steps[s]);
        o.value = state.steps[s];
        if (state.steps[s] === state.step) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", function () {
        state.step = sel.value;
        var inputs = document.querySelectorAll("input[data-i]");
        for (var k = 0; k < inputs.length; k++) inputs[k].step = state.step;
        webview.send("step", { step: state.step });
      });
      stepWrap.appendChild(sel);
      head.appendChild(stepWrap);
    }
    root.appendChild(head);

    var grid = el("div", "grid");
    for (var i = 0; i < state.categories.length; i++) {
      var cell = el("div");
      var lab = el("label", "", state.categories[i]);
      lab.title = state.categories[i];
      var input = el("input");
      input.type = "number";
      input.inputMode = "decimal";
      input.min = "0";
      input.max = String(state.max);
      input.step = state.step;
      input.placeholder = "0–" + state.max;
      input.value = state.values[i] || "";
      input.setAttribute("data-i", String(i));
      input.addEventListener("input", onInput);
      cell.appendChild(lab);
      cell.appendChild(input);
      grid.appendChild(cell);
    }
    root.appendChild(grid);

    var foot = el("div", "foot");
    foot.appendChild(el("span", "avg", ""));
    foot.appendChild(el("span", "muted score", ""));
    root.appendChild(foot);
    root.appendChild(el("div", "muted hint", state.labels.hint));
    updateFooter();
  }

  function updateFooter() {
    var avg = average(state.values);
    var avgEl = document.querySelector(".avg");
    var scoreEl = document.querySelector(".score");
    if (!avgEl) return;
    avgEl.textContent = fmt(state.labels.avg, avg === null ? "?" : (avg ? String(avg) : "–"), state.max);
    var raw = (avg && avg !== null) ? Math.round(avg / state.max * 100) : 0;
    scoreEl.textContent = (state.dirty && raw) ? fmt(state.labels.score, String(raw / 10), "") : "";
    var inputs = document.querySelectorAll("input[data-i]");
    for (var k = 0; k < inputs.length; k++) {
      var bad = parse(inputs[k].value) === null;
      if (bad) inputs[k].classList.add("bad"); else inputs[k].classList.remove("bad");
    }
  }

  function onInput(ev) {
    var i = parseInt(ev.target.getAttribute("data-i"), 10);
    state.values[i] = ev.target.value;
    state.dirty = true;
    updateFooter();
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      webview.send("change", { mediaId: state.mediaId, values: state.values.slice() });
    }, 150);
  }

  webview.on("status", function (data) {
    showMessage(data && data.text ? data.text : "");
  });

  webview.on("setup", function (data) {
    var root = document.getElementById("root");
    root.innerHTML = "";
    root.appendChild(el("div", "title", data.title));
    var desc = el("div", "muted", data.desc);
    desc.style.margin = "6px 0 10px 0";
    root.appendChild(desc);
    var row = el("div", "setup");
    row.style.display = "flex";
    row.style.gap = "8px";
    var input = el("input");
    input.type = "text";
    input.value = data.value || "";
    var btn = el("button", "btn", data.button);
    btn.addEventListener("click", function () {
      btn.disabled = true;
      webview.send("setupSave", { names: input.value });
    });
    row.appendChild(input);
    row.appendChild(btn);
    root.appendChild(row);
  });

  webview.on("setupFailed", function () {
    var b = document.querySelector("button.btn");
    if (b) b.disabled = false;
  });

  webview.on("init", function (data) {
    state = data;
    state.dirty = false;
    render();
  });

  window.addEventListener("load", function () {
    webview.send("ready", {});
  });
</script>
</body>
</html>`

        const editorView = ctx.newWebview({
            slot: "after-media-entry-form",
            autoHeight: true,
            fullWidth: true,
        })
        editorView.setContent(() => EDITOR_HTML)

        function editorStatus(text) {
            try {
                editorView.channel.send("status", { text: text })
            }
            catch (e) {
                console.warn("anilist-custom-ratings: could not update editor section", e)
            }
        }

        function mediaIdFromBanner(src) {
            if (!src) return null
            let url = String(src)
            try {
                url = decodeURIComponent(url)
            }
            catch (e) {
                // keep as is
            }
            const m = /media\/(anime|manga)\/banner\/[a-z]*(\d+)-/i.exec(url)
            if (!m) return null
            return { id: parseInt(m[2], 10), type: m[1].toLowerCase() === "manga" ? "MANGA" : "ANIME" }
        }

        function findInCollection(getter, type, title) {
            let col = null
            try {
                col = plain(getter())
            }
            catch (e) {
                return null
            }
            const lists = (col && col.MediaListCollection && col.MediaListCollection.lists) || []
            for (let i = 0; i < lists.length; i++) {
                const entries = (lists[i] && lists[i].entries) || []
                for (let j = 0; j < entries.length; j++) {
                    const media = entries[j] && entries[j].media
                    const ti = (media && media.title) || {}
                    if (media && (ti.userPreferred === title || ti.romaji === title || ti.english === title || ti.native === title)) {
                        return { id: media.id, type: type }
                    }
                }
            }
            return null
        }

        function mediaFromTitle(title) {
            title = (title || "").trim()
            if (!title) return null
            return findInCollection(() => $anilist.getRawAnimeCollection(false), "ANIME", title)
                || findInCollection(() => $anilist.getRawMangaCollection(false), "MANGA", title)
        }

        function identifyEditorMedia() {
            const formSel = "[role=\"dialog\"]:has([data-anilist-media-entry-modal-form])"
            return ctx.dom.queryOne("[data-anilist-media-entry-modal-banner-image]")
                .then((img) => img ? img.getAttribute("src") : null)
                .then((src) => {
                    const fromBanner = mediaIdFromBanner(src)
                    if (fromBanner) return fromBanner
                    return ctx.dom.queryOne(formSel + " .UI-Modal__title")
                        .then((el) => el || ctx.dom.queryOne(formSel + " p.line-clamp-1"))
                        .then((el) => el ? el.getText() : "")
                        .then((title) => mediaFromTitle(title))
                })
        }

        function loadEditor(media) {
            const viewer = getViewer()
            const opts = viewer.mediaListOptions || {}
            const listOpts = (media.type === "MANGA" ? opts.mangaList : opts.animeList) || {}
            const scoreFormat = opts.scoreFormat || "POINT_100"
            const sc = SCALES[scoreFormat] || SCALES.POINT_100
            const categories = (listOpts.advancedScoring || []).filter((n) => !!n)

            editor.scoreFormat = scoreFormat
            updateScoreStep()

            if (!categories.length) {
                editor.setupMedia = media
                editorView.channel.send("setup", {
                    title: t("setupTitle"),
                    desc: t("setupDesc", kindOf(media.type)),
                    value: t("setupDefault"),
                    button: t("setupButton"),
                })
                return
            }

            const entry = getEntry(media.id, viewer.id)
            let adv = entry && entry.advancedScores
            if (typeof adv === "string") {
                try {
                    adv = JSON.parse(adv)
                }
                catch (e) {
                    adv = null
                }
            }

            const factor = detectStoredFactor(adv, scoreFormat, media.type, viewer.id)
            const values = categories.map((cat) => {
                const raw = adv ? Number(adv[cat]) : 0
                return raw ? String(round(raw / factor, sc.decimals)) : ""
            })

            editor.media = media
            editor.scoreFormat = scoreFormat
            editor.categories = categories
            editor.storedFactor = factor

            const steps = sc.steps
            const step = steps.indexOf(s.step) !== -1 ? s.step : steps[0]

            editorView.channel.send("init", {
                mediaId: media.id,
                categories: categories,
                values: values,
                max: sc.max,
                decimals: sc.decimals,
                steps: steps,
                step: step,
                labels: {
                    title: t("editorTitle"),
                    step: t("step"),
                    avg: t("editorAvg"),
                    score: t("editorScore"),
                    hint: t("editorHint"),
                },
            })
        }

        editorView.channel.on("ready", () => {
            editor.media = null
            editorStatus(t("editorLoading"))
            identifyEditorMedia()
                .then((media) => {
                    if (!media) {
                        editorStatus(t("editorNotFound"))
                        return
                    }
                    try {
                        loadEditor(media)
                    }
                    catch (e) {
                        editorStatus(t("error") + ": " + errMsg(e))
                    }
                })
                .catch((e) => editorStatus(t("error") + ": " + errMsg(e)))
        })

        editorView.channel.on("setupSave", (payload) => {
            const media = editor.setupMedia
            if (!media) return
            try {
                const names = setupCategories(media.type, payload && payload.names)
                ctx.toast.success(t("setupDone", names.join(", ")))
                loadEditor(media)
            }
            catch (e) {
                ctx.toast.error(t("setupFailed", errMsg(e)))
                editorView.channel.send("setupFailed", {})
            }
        })

        editorView.channel.on("step", (payload) => {
            if (payload && payload.step) s.step = String(payload.step)
            updateScoreStep()
        })

        editorView.channel.on("change", (payload) => {
            try {
                if (!editor.media || !payload || payload.mediaId !== editor.media.id) return
                const sc = SCALES[editor.scoreFormat] || SCALES.POINT_100
                const values = payload.values || []
                const advancedScores = []
                let sum = 0, count = 0
                for (let i = 0; i < editor.categories.length; i++) {
                    const v = String(values[i] === undefined || values[i] === null ? "" : values[i]).trim().replace(",", ".")
                    let n = v === "" ? 0 : parseFloat(v)
                    if (isNaN(n) || n < 0 || n > sc.max) {
                        // Invalid input: forget the pending rating so nothing wrong gets saved
                        $store.set(PENDING_PREFIX + editor.media.id, { time: 0 })
                        return
                    }
                    n = round(n, sc.decimals)
                    advancedScores.push(round(n * editor.storedFactor, 1))
                    if (n > 0) {
                        sum += n
                        count++
                    }
                }
                const avg = count ? round(sum / count, sc.decimals) : 0
                const scoreRaw = count ? Math.round(avg / sc.max * 100) : null

                $store.set(PENDING_PREFIX + editor.media.id, {
                    time: Date.now(),
                    scoreRaw: scoreRaw,
                    advancedScores: advancedScores,
                })

                // Show the average in the Score field (0–10). The save hook makes sure it is saved.
                if (scoreRaw !== null) {
                    if (scoreField.el) {
                        try {
                            scoreField.el.setProperty("value", String(scoreRaw / 10))
                        }
                        catch (e) {
                            // the editor was closed
                        }
                    }
                    ctx.dom.queryOne("[data-anilist-media-entry-modal-form] input[name=\"score\"]")
                        .then((input) => {
                            if (input) input.setProperty("value", String(scoreRaw / 10))
                        })
                        .catch(() => {})
                }
            }
            catch (e) {
                console.warn("anilist-custom-ratings: could not handle category change", e)
            }
        })

        // -----------------------------------------------------------------------------------------
        // Score field with your arrow key step
        //
        // Seanime's own Score field always steps by 1 with the arrow keys, and plugins cannot change
        // that. So the plugin hides it and puts its own Score field in the same spot, which steps by
        // the chosen step (1, 0.5 or 0.1). The save hook uses this value when you click Save.

        const NATIVE_SCORE = "[data-anilist-media-entry-modal-form] input[name=\"score\"]"

        const scoreField = {
            el: null,
            creating: false,
        }

        // The step on Seanime's 0–10 Score scale
        function scoreStep10() {
            const step = parseFloat(s.step)
            const sc = SCALES[editor.scoreFormat]
            if (!step || step <= 0) return "1"
            if (!sc) return step <= 1 ? String(step) : "1"
            return String(round(step * 10 / sc.max, 2))
        }

        function updateScoreStep() {
            if (!scoreField.el) return
            try {
                scoreField.el.setAttribute("step", scoreStep10())
            }
            catch (e) {
                // the editor was closed
            }
        }

        function onScoreInput(input, mediaId) {
            Promise.resolve(input.getProperty("value"))
                .then((value) => {
                    const v = String(value === undefined || value === null ? "" : value).trim().replace(",", ".")
                    const n = v === "" ? 0 : parseFloat(v)
                    if (isNaN(n) || n < 0 || n > 10) return
                    const key = PENDING_PREFIX + mediaId
                    const prev = $store.get(key)
                    const fresh = prev && prev.time && (Date.now() - prev.time) < 30 * 60 * 1000
                    $store.set(key, {
                        time: Date.now(),
                        scoreRaw: Math.round(n * 10),
                        advancedScores: fresh ? prev.advancedScores : undefined,
                    })
                })
                .catch((e) => console.warn("anilist-custom-ratings: could not read the score", e))
        }

        function setupScoreField() {
            if (scoreField.creating) return
            scoreField.creating = true
            let native = null
            ctx.dom.queryOne("[data-anilist-media-entry-modal-form] .acr-native-score")
                .then((existing) => existing ? null : ctx.dom.queryOne(NATIVE_SCORE))
                .then((el) => {
                    native = el
                    if (!native) return null
                    return identifyEditorMedia().catch(() => null)
                })
                .then((media) => {
                    if (!native || !media) return null
                    return Promise.all([
                        Promise.resolve(native.getAttribute("class")),
                        Promise.resolve(native.getProperty("value")),
                        ctx.dom.createElement("input"),
                    ]).then((res) => {
                        const cls = res[0], value = res[1], input = res[2]
                        input.setAttribute("type", "number")
                        input.setAttribute("inputmode", "decimal")
                        input.setAttribute("min", "0")
                        input.setAttribute("max", "10")
                        input.setAttribute("step", scoreStep10())
                        input.setAttribute("class", (cls ? String(cls) + " " : "") + "acr-native-score")
                        input.setProperty("value", value === undefined || value === null ? "" : String(value))
                        native.after(input)
                        native.setStyle("display", "none")
                        ctx.dom.queryOne(NATIVE_SCORE + " ~ .UI-NumberInput__controlsContainer")
                            .then((controls) => {
                                if (controls) controls.setStyle("display", "none")
                            })
                            .catch(() => {})
                        scoreField.el = input
                        input.addEventListener("input", () => onScoreInput(input, media.id))
                    })
                })
                .catch((e) => console.warn("anilist-custom-ratings: could not set up the score field", e))
                .then(() => {
                    scoreField.creating = false
                })
        }

        ctx.dom.onReady(() => {
            ctx.dom.observe(NATIVE_SCORE, (elements) => {
                if (elements && elements.length) setupScoreField()
            })
        })

        // -----------------------------------------------------------------------------------------
        // Entry points

        function addButtons(type) {
            const isManga = type === "MANGA"
            const newPageButton = (props) => isManga ? ctx.action.newMangaPageButton(props) : ctx.action.newAnimePageButton(props)

            const rate = newPageButton({ label: t("rate"), intent: "primary-subtle" })
            rate.mount()
            rate.onClick((e) => openFor(e.media, type, "rating"))

            const lists = newPageButton({ label: t("lists"), intent: "gray-subtle" })
            lists.mount()
            lists.onClick((e) => openFor(e.media, type, "lists"))

            const forMedia = isManga ? "manga" : "anime"
            const rateItem = ctx.action.newMediaCardContextMenuItem({ label: t("rateMenu"), for: forMedia })
            rateItem.mount()
            rateItem.onClick((e) => openFor(e.media, type, "rating"))

            const listItem = ctx.action.newMediaCardContextMenuItem({ label: t("listsMenu"), for: forMedia })
            listItem.mount()
            listItem.onClick((e) => openFor(e.media, type, "lists"))
        }

        addButtons("ANIME")
        addButtons("MANGA")

        // Lets VikTempest Seanime UI open the rating window (e.g. after the last episode)
        if (typeof vsShare === "object" && vsShare) vsShare.rate = (media) => openFor(media, "ANIME", "rating")

        // -----------------------------------------------------------------------------------------
        // Tray icon: shows that the plugin is running, how to use it and whether your account is ready

        // The tray is shared with the rest of VikTempest Seanime UI (title and settings button on top)
        // (falls back to its own tray when the file is used on its own)
        const trayOpts = {
            iconUrl: "https://raw.githubusercontent.com/vikTempest/custom-ratings-.5-options/main/icon.png",
            tooltipText: t("trayTitle"),
            withContent: true,
            width: "24rem",
        }
        const tray = typeof vsTray === "function" ? vsTray() : ctx.newTray(trayOpts)
        const trayHeader = () => (typeof vsTrayHeader === "function" ? vsTrayHeader(tray) : [])

        const trayState = {
            loading: false,
            error: "",
            name: "",
            loggedIn: true,
            anime: [],
            manga: [],
            setupNames: "",
            saving: false,
        }

        function loadTray(force) {
            trayState.loading = true
            trayState.error = ""
            tray.update()
            try {
                if (!getToken()) {
                    trayState.loggedIn = false
                }
                else {
                    trayState.loggedIn = true
                    if (force) forgetViewer()
                    const viewer = getViewer()
                    const opts = viewer.mediaListOptions || {}
                    trayState.name = viewer.name || ""
                    trayState.anime = ((opts.animeList && opts.animeList.advancedScoring) || []).filter((n) => !!n)
                    trayState.manga = ((opts.mangaList && opts.mangaList.advancedScoring) || []).filter((n) => !!n)
                }
            }
            catch (e) {
                trayState.error = errMsg(e)
            }
            trayState.loading = false
            tray.update()
            if (force && !trayState.error && trayState.loggedIn) ctx.toast.success(t("trayRefreshed"))
        }

        function traySetup(type) {
            if (trayState.saving) return
            trayState.saving = true
            tray.update()
            try {
                const names = setupCategories(type, trayState.setupNames || t("setupDefault"))
                ctx.toast.success(t("setupDone", names.join(", ")))
                trayState.saving = false
                loadTray(false)
                return
            }
            catch (e) {
                ctx.toast.error(t("setupFailed", errMsg(e)))
            }
            trayState.saving = false
            tray.update()
        }

        tray.onOpen(() => loadTray(false))

        // The render function runs often and must only build components: handlers and texts
        // are made once here.
        const trayEv = {
            names: ctx.eventHandler("acr-tray-setup-names", (e) => { trayState.setupNames = (e && e.value) || "" }),
            anime: ctx.eventHandler("acr-tray-setup-anime", () => traySetup("ANIME")),
            manga: ctx.eventHandler("acr-tray-setup-manga", () => traySetup("MANGA")),
            refresh: ctx.eventHandler("acr-tray-refresh", () => loadTray(true)),
        }
        const trayText = {}
        ;["trayTitle", "trayHowTo", "loading", "trayNotLoggedIn", "error", "traySetupAnime", "traySetupManga", "trayRefresh", "setupDefault", "anime", "manga"]
            .forEach((k) => { trayText[k] = t(k) })
        const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1)
        trayText.animeCats = (names) => cap(names.length ? t("trayCats", trayText.anime, names.join(", ")) : t("trayNoCats", trayText.anime))
        trayText.mangaCats = (names) => cap(names.length ? t("trayCats", trayText.manga, names.join(", ")) : t("trayNoCats", trayText.manga))
        // Texts that depend on the state are made when the state changes
        const trayLines = { key: "", name: "", anime: "", manga: "" }
        function trayLinesFor() {
            const key = trayState.name + "|" + trayState.anime.join(",") + "|" + trayState.manga.join(",")
            if (trayLines.key !== key) {
                trayLines.key = key
                trayLines.name = trayState.name ? t("trayLoggedIn", trayState.name) : ""
                trayLines.anime = trayText.animeCats(trayState.anime)
                trayLines.manga = trayText.mangaCats(trayState.manga)
            }
            return trayLines
        }

        tray.render(() => {
            const items = trayHeader().concat([
                tray.text(trayText.trayTitle, { className: "font-semibold" }),
                tray.text(trayText.trayHowTo, { className: "text-sm text-[--muted]" }),
            ])
            if (trayState.loading) {
                items.push(tray.text(trayText.loading, { className: "text-sm" }))
                return tray.stack(items, { gap: 3 })
            }
            if (!trayState.loggedIn) {
                items.push(tray.alert({ title: trayText.trayNotLoggedIn, intent: "warning" }))
                return tray.stack(items, { gap: 3 })
            }
            if (trayState.error) {
                items.push(tray.alert({ title: trayText.error, description: trayState.error, intent: "alert" }))
            }
            else {
                const lines = trayLinesFor()
                if (lines.name) items.push(tray.text(lines.name, { className: "text-sm" }))
                items.push(tray.text(lines.anime, { className: "text-sm" }))
                items.push(tray.text(lines.manga, { className: "text-sm" }))

                if (!trayState.anime.length || !trayState.manga.length) {
                    if (!trayState.setupNames) trayState.setupNames = trayText.setupDefault
                    items.push(tray.input({ value: trayState.setupNames, disabled: trayState.saving, onChange: trayEv.names }))
                    const buttons = []
                    if (!trayState.anime.length) buttons.push(tray.button(trayText.traySetupAnime, {
                        intent: "primary-subtle", size: "sm", loading: trayState.saving, onClick: trayEv.anime,
                    }))
                    if (!trayState.manga.length) buttons.push(tray.button(trayText.traySetupManga, {
                        intent: "primary-subtle", size: "sm", loading: trayState.saving, onClick: trayEv.manga,
                    }))
                    items.push(tray.flex(buttons, { gap: 2 }))
                }
            }
            items.push(tray.button(trayText.trayRefresh, { intent: "gray-subtle", size: "sm", onClick: trayEv.refresh }))
            return tray.stack(items, { gap: 3 })
        })
    })
}
