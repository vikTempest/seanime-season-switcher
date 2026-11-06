# VikTempest Seanime UI

Eine Erweiterung für Seanime mit allem drin:

- **Season Switcher:** Staffeln zusammenfassen, Staffel-Dropdown mit Fortschritt, Folgenliste statt Sofort-Stream
- **AniList Custom Ratings:** Bewertungskategorien und Custom Lists
- **Theme:** schwarzer Netflix-Look in Rot, Lila, Blau oder deinen eigenen Farben
- **Extras:** Bildschirmschoner, Schlaftimer, Schnellsuche (Strg+K), Hinweis auf neue Staffeln, Filler abdunkeln, Rechtsklick auf Folgen, Bewerten nach der letzten Folge, danach direkt zur nächsten Staffel, Weiterschauen mit einem Klick
- **Seitenleiste:** einfahren lassen und Einträge ausblenden

Sprachen: Deutsch, English, Español, Português, 日本語

## Installation

In Seanime unter **Extensions** auf „Add extensions“ klicken und unter „Install from URL“ diesen Link einfügen:

```
https://raw.githubusercontent.com/vikTempest/vikTempest-Seanime-UI/main/viktempest-ui.json
```

Danach die Erweiterung aktivieren und die Berechtigungen bestätigen (AniList, AniList-Token, Datenbank, Wiedergabe, Einstellungen, Speicher). „Wiedergabe“ braucht der Schlaftimer zum Pausieren und der Bildschirmschoner, damit er nie über einem laufenden Video erscheint..

Beim ersten Start passieren zwei Dinge:

1. Ein Fenster fragt, welches **Farbschema** du willst. Ein Klick ändert die Farben sofort, „Fertig“ schließt das Fenster. Du kannst es später jederzeit ändern.
2. Seanime fragt einmal, ob die Erweiterung die „Default episode source“ auf ihren Folgen-Tab setzen darf. Erlaubst du das, öffnet jede Anime-Seite direkt mit der Folgenliste.

**Umstieg von den einzelnen Plugins:** Deinstalliere unter **Extensions** vorher **Season Switcher** und **AniList Custom Ratings**, sonst läuft alles doppelt. Den einzelnen Season Switcher (`season-switcher.json`) gibt es nicht mehr. Hast du das Netflix-Theme unter Einstellungen → User Interface → CSS eingefügt, leere dort die Felder. Deine Bewertungen und Listen liegen auf AniList und bleiben erhalten.

## Einstellungen

Alle Einstellungen stehen auf einer eigenen Seite. So kommst du hin:

- oben in der Leiste auf das Symbol der Erweiterung klicken und dann auf **„Einstellungen öffnen“**, oder
- in der linken Seitenleiste von Seanime auf **„VikTempest Seanime UI“** klicken. Direkt nach der Installation erscheint dieser Eintrag erst, wenn du die Seite einmal neu lädst (Strg+R).

- **Theme:** Aus, Rot, Lila, Blau oder Eigene (Akzent- und Hintergrundfarbe frei wählbar). Wirkt sofort, ohne Speichern.
- **Allgemein:** Sprache und jeden Teil einzeln an/aus
- **Season Switcher:** Titel-Sprache, Filme/OVAs im Dropdown, Fortschritt im Dropdown, Staffeln zusammenfassen, welche Karte pro Serie, Abzeichen „X Staffeln“, Folgenliste statt Sofort-Stream, Folge anklicken startet Stream
- **Seitenleiste:** einfahren (nur ein schmaler Rand bleibt, mit der Maus fährt sie heraus) und einzelne Einträge ausblenden, z. B. Manga, Torrent-Liste oder die Suche (die gibt es auch oben und mit Strg+K). Wirkt sofort.
- **AniList Custom Ratings:** Schrittweite der Pfeiltasten
- **Extras:** Bildschirmschoner an/aus und nach wie vielen Minuten, Hinweis auf neue Staffeln, Filler-Folgen (normal, abdunkeln, ausblenden), Bewerten nach der letzten Folge, danach zur nächsten Staffel, Weiterschauen, Rechtsklick-Menü, Schnellsuche

Die meisten Einstellungen gelten sofort nach dem Speichern, spätestens beim nächsten Seitenwechsel. Nur die mit „nach Neustart“ markierten (Sprache, Teile an/aus, Folgenliste) brauchen einen Neustart von Seanime, weil sich ein Plugin nicht selbst neu laden kann. „Auf Standard zurücksetzen“ stellt alles auf den Anfang.

**Sichern und laden:** „Exportieren“ schreibt alle Einstellungen als Text in das Feld darunter (und in die Zwischenablage). Heb den Text auf, bevor du die Erweiterung deinstallierst, denn Seanime löscht dabei alle ihre Einstellungen. Nach dem Neuinstallieren den Text einfügen und „Importieren“ drücken.

Unter **Status** siehst du, ob die Erweiterung die Teile von Seanime findet, mit denen sie arbeitet. Steht dort nach einem Seanime-Update „noch nicht gesehen“, obwohl du die passende Seite geöffnet hast, hat das Update etwas verändert.

## Season Switcher

**Startseite:** Jede Serie erscheint nur noch einmal. Liegen z. B. Staffel 1 und Staffel 2 im selben Bereich (etwa „Currently watching“ oder „Completed“), bleibt nur eine Karte stehen. Bei „Continue watching“ bleibt die früheste Staffel, also die, bei der du gerade bist. Stehen die Staffeln in verschiedenen Bereichen (Staffel 1 bei „Completed“, Staffel 2 bei „Watching“), bleiben beide sichtbar.

Das gilt auch für die anderen Zeilen der Startseite, z. B. Genre-Zeilen wie „Romance“. Die Karte zeigt immer die erste Staffel (Titel, Jahr, Bild), und ein Klick öffnet Staffel 1. Hat eine Serie mehrere Staffeln, steht oben links auf der Karte ein kleines Abzeichen, z. B. „3 Staffeln“.

**Anime-Seite:** Unter dem Titel steht ein Dropdown **„Staffel“** mit allen Staffeln der Reihe. Wählst du eine aus, springt Seanime auf ihre Seite. Im Dropdown siehst du deinen Stand: „✓“ vor fertigen Staffeln, „5/12“ hinter angefangenen und „nicht auf deiner Liste“ bei Staffeln, die du noch nicht eingetragen hast.

**Folgenliste:** Klickst du auf eine Serie, öffnet sich die Seite mit Infos und allen Folgen, statt sofort einen Stream zu laden. Über der Liste steht unter „Weiterschauen“ die Folge, bei der du aufgehört hast. Erst ein Klick auf eine Folge startet den Online-Stream genau dieser Folge. Dafür lädt die Seite einmal kurz neu, weil Seanime die Ansicht nur beim Öffnen einer Seite wählt. Über den Knopf „Folgenübersicht“ beim Stream kommst du zurück zur Folgenliste.

Die nächste Folge trägt „▶ Weiterschauen“, gesehene Folgen „✓ Gesehen“ und die zuletzt angefangene einen Fortschrittsbalken.

Die Erweiterung ist auf **Online-Streaming** ausgelegt. Willst du Seanime so, wie es ohne diese Optimierung ist (z. B. für Debrid oder Torrent), stell „Anime-Seiten mit Folgenliste öffnen“ und „Folge anklicken startet Online-Stream“ auf „Nein“.

Deine Listen bleiben unverändert: Jede Staffel bleibt auf AniList ein eigener Eintrag.

### Wie die Staffeln gefunden werden

Die Erweiterung folgt auf AniList den Verknüpfungen „Prequel“ und „Sequel“ und sortiert alles nach Startdatum. Als Staffel zählen TV-Serien, Kurzserien und ONAs. Filme, OVAs und Specials werden mit durchlaufen (damit ein Film zwischen zwei Staffeln die Kette nicht unterbricht), aber nur angezeigt, wenn du das einschaltest. Gibt es nur eine Staffel, erscheint kein Dropdown.

Die Daten werden 12 Stunden zwischengespeichert, weil AniList nur wenige Anfragen pro Minute erlaubt. Ist das Limit doch einmal erreicht, zeigt Seanime eine kurze Meldung, und die Staffeln kommen etwa eine Minute später.

## Extras

**Bildschirmschoner:** Machst du eine Weile nichts (Standard 5 Minuten), zeigt Seanime die Anime aus dem großen Banner der Startseite (gerade beliebt auf AniList) bildschirmfüllend mit Titel, Beschreibung und Uhr. Mit „Ansehen“ öffnest du den gezeigten Anime, mit dem Knopf unten in der Mitte (oder Esc) kommst du zurück. Während ein Video läuft, kommt er nie. Ist AniList nicht erreichbar, zeigt er Anime von deiner Liste.

**Symbol oben:** Neben „Einstellungen öffnen“ und den Custom-Ratings-Infos stehen dort der **Schlaftimer** (15, 30, 60 Minuten oder „Nach dieser Folge“, danach pausiert der Player), **Weiterschauen** (deine drei zuletzt geschauten Anime, ein Klick startet die nächste Folge), die Schnellsuche und die neuen Staffeln.

**Neue Staffeln:** Einmal am Tag schaut die Erweiterung, ob es von Anime, die du gesehen hast oder gerade schaust, eine Fortsetzung gibt, die noch nicht auf deiner Liste ist. Neue Funde meldet sie einmal kurz, die ganze Liste steht im Symbol oben.

**Filler:** Folgen, die Seanime als Filler kennt, können abgedunkelt oder ausgeblendet werden.

**Rechtsklick auf Folgen** (im Folgen-Tab): „Bis hier als gesehen markieren“ und „Online-Stream starten“.

**Bewerten nach der letzten Folge:** Hast du die letzte Folge einer Staffel gesehen, öffnet sich nach dem Player einmal das Bewertungsfenster von AniList Custom Ratings.

**Nächste Staffel:** Nach der letzten Folge einer Staffel öffnet sich direkt die Folgenliste der Fortsetzung. Ist sie noch nicht erschienen, sagt dir ein Hinweis, wann sie startet.

**Opening/Ending überspringen** kann Seanime schon selbst: im Player unter Einstellungen „Auto Skip OP/ED“ (nutzt AniSkip). Deshalb hat die Erweiterung dafür nichts Eigenes.

**Schnellsuche:** Strg+K (am Mac Cmd+K) sucht in deiner Liste, zeigt oben „Weiterschauen“ und bietet Aktionen wie Schlaftimer oder Einstellungen. Im Browser kann Strg+K schon belegt sein, dann geht es über das Symbol oben.

## Auf dem Handy

Die Erweiterung läuft auf dem Seanime-Server und funktioniert deshalb auch im Handy-Browser, ohne extra Einstellung. Das Staffel-Dropdown nutzt dort die ganze Breite und ist groß genug zum Tippen.

Seanime schickt Seitenwechsel von Plugins an alle offenen Geräte. Springt eine Seite unerwartet, während Seanime gleichzeitig auf PC und Handy offen ist, schließ Seanime auf dem Gerät, das du gerade nicht nutzt.

## Für Entwickler

- `viktempest-ui.json`: die installierbare Erweiterung
- `suite/settings.js`: Einstellungsseite, Farbschemas, Farbwahl beim ersten Start, Laden der Teile
- `src/plugin.js`: Season Switcher
- `src/extras.js`: Extras (Bildschirmschoner, Schlaftimer, neue Staffeln, Filler, Rechtsklick, Bewerten, Schnellsuche)
- `suite/ratings/plugin.js`: AniList Custom Ratings (Kopie aus dem Repo custom-ratings-.5-options)
- `suite/theme/`: Netflix-Theme (Desktop und Handy). Die Dateien bleiben direkt als Custom CSS nutzbar. Beim Bauen werden die festen Farben durch die Farben des gewählten Schemas ersetzt.
- `test/smoke.js`: startet die Erweiterung mit nachgebauten Seanime-Schnittstellen und prüft die wichtigsten Abläufe

Wichtig: Seanime führt `init()` (Hooks) und die Funktion in `$ui.register()` in getrennten Umgebungen aus, jeweils nur aus ihrem eigenen Quelltext. `suite/build.py` packt deshalb alles für die Oberfläche (Einstellungsseite und die Oberfläche beider Teile) in eine einzige `$ui.register()`-Funktion. Der Test macht das genauso nach.

Nach jeder Änderung: `VERSION` in `suite/build.py` erhöhen, `python3 suite/build.py .` und `node test/smoke.js` ausführen. GitHub prüft bei jedem Push, ob die JSON zum Code passt und der Test durchläuft.
