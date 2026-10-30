# Season Switcher – Plugin für Seanime

**Startseite:** Jede Serie erscheint nur noch einmal. Liegen z. B. Staffel 1 und Staffel 2 im selben Bereich (etwa „Currently watching“ oder „Completed“), bleibt nur eine Karte stehen. Bei „Continue watching“ bleibt die früheste Staffel, also die, bei der du gerade bist. Stehen die Staffeln in verschiedenen Bereichen (Staffel 1 bei „Completed“, Staffel 2 bei „Watching“), bleiben beide sichtbar, weil sie dort ja etwas anderes bedeuten.

Das gilt auch für die anderen Zeilen der Startseite, z. B. Genre-Zeilen wie „Romance“: Stehen dort Re:ZERO Staffel 3 und 4 nebeneinander, bleibt nur eine Karte. Die Karte zeigt immer die erste Staffel (Titel, Jahr, Bild), auch wenn dort eigentlich Staffel 2 stand, und ein Klick öffnet Staffel 1. Bei solchen Karten blendet das Plugin Vorschau-Popup und Fortschritts-Abzeichen aus, weil Seanime die noch von der anderen Staffel füllt. Bei Reihen wie JoJo's Bizarre Adventure steht so eine Karte für die ganze Reihe, die einzelnen Teile wählst du dann im Dropdown.

**Anime-Seite:** Fügt unter dem Titel ein Dropdown **„Staffel“** ein. Darin stehen alle Staffeln des Franchise, z. B. bei *The Apothecary Diaries* Staffel 1, 2 und 3. Wählst du eine aus, springt Seanime direkt auf die Seite dieser Staffel.

Deine Listen bleiben unverändert: Jede Staffel bleibt auf AniList ein eigener Eintrag, das Plugin ändert nichts an deinem Konto.

**Infoseite:** Klickst du auf eine Serie, öffnet sich die Seite mit Infos und allen Folgen (Bild, Titel, Beschreibung), statt sofort einen Stream zu laden. Die Quellen-Umschaltung (Local library, Online streaming usw.) blendet das Plugin aus. Erst ein Klick auf eine Folge startet den Online-Stream genau dieser Folge. Dafür springt die Seite einmal kurz über die Startseite, weil Seanime die Ansicht nur beim Öffnen einer Seite wählt. Mit „Zurück“ landest du danach auf der Startseite. Eine Einstellung in Seanime musst du dafür nicht ändern.

## Auf dem Handy

Das Plugin läuft auf dem Seanime-Server, also funktioniert es automatisch auch, wenn du Seanime im Handy-Browser öffnest. Du musst auf dem Handy nichts extra installieren oder einstellen. Das Staffel-Dropdown steht dort mittig unter dem Titel, nutzt die ganze Breite und ist groß genug zum Tippen (iPhones zoomen beim Antippen nicht mehr rein). Auf die Folgenbilder und -titel kannst du tippen, um den Stream zu starten.

Das Plugin hat einen gemeinsamen Zustand für alle Geräte. Springt eine Seite unerwartet, während Seanime gleichzeitig auf PC und Handy offen ist, schließ Seanime auf dem Gerät, das du gerade nicht nutzt.

## Wie die Staffeln gefunden werden

Das Plugin folgt auf AniList den Verknüpfungen „Prequel“ und „Sequel“ und sortiert alles nach Startdatum. Als Staffel zählen TV-Serien, Kurzserien und ONAs. Filme, OVAs und Specials werden mit durchlaufen (damit z. B. ein Film zwischen zwei Staffeln die Kette nicht unterbricht), aber nur angezeigt, wenn du das in den Einstellungen einschaltest.

Gibt es nur eine Staffel, erscheint kein Dropdown.

Die Daten werden 6 Stunden zwischengespeichert, damit das Plugin AniLists Anfrage-Limit nicht belastet.

## Einstellungen

In Seanime unter **Extensions → Season Switcher → Preferences**:

- **Language / Sprache:** Deutsch (Standard) oder English
- **Titles / Titel:** Englisch (Standard), Romaji oder Japanisch
- **Filme, OVAs und Specials anzeigen:** Nein (Standard) oder Ja
- **Staffeln auf der Startseite zusammenfassen:** Ja (Standard) oder Nein
- **Welche Karte pro Serie:** erste Staffel (Standard) oder neueste Staffel
- **Anime-Seiten mit Folgenliste öffnen:** Ja (Standard) oder Nein
- **Folge anklicken startet Online-Stream:** Ja (Standard) oder Nein (für Folgen in der „Local library“-Ansicht)

## Installation

**Per Link (empfohlen):** In Seanime unter **Extensions** auf „Add extensions“ klicken und unter „Install from URL“ diesen Link einfügen:

```
https://raw.githubusercontent.com/vikTempest/seanime-season-switcher/main/season-switcher.json
```

Danach das Plugin aktivieren und die Berechtigung (AniList-Zugriff) bestätigen. Neue Versionen kann Seanime dann selbst aktualisieren.

**Per Datei:**

1. Seanime schließen.
2. `season-switcher.json` in den Ordner `%APPDATA%\Seanime\extensions` kopieren.
3. Seanime starten, unter **Extensions** das Plugin aktivieren und die Berechtigung (AniList-Zugriff) bestätigen.

Hast du die Datei vorher schon manuell installiert, lösch sie aus dem Ordner, bevor du per Link installierst, sonst meldet Seanime „extension ID is already in use“.

Die Plugin-ID ist `viktempest-season-switcher`, sie kollidiert also nicht mit anderen Erweiterungen.

## Dateien

- `season-switcher.json`: das installierbare Plugin (Manifest mit eingebettetem Code)
- `src/plugin.js`: derselbe Code lesbar

Nach einer Änderung an `src/plugin.js`: `version` in `build.py` erhöhen und `python3 build.py .` ausführen, das schreibt den Code in die JSON-Datei.
