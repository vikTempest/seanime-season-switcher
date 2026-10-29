# Season Switcher – Plugin für Seanime

**Startseite:** Jede Serie erscheint nur noch einmal. Liegen z. B. Staffel 1 und Staffel 2 im selben Bereich (etwa „Currently watching“ oder „Completed“), bleibt nur eine Karte stehen. Bei „Continue watching“ bleibt die früheste Staffel, also die, bei der du gerade bist. Stehen die Staffeln in verschiedenen Bereichen (Staffel 1 bei „Completed“, Staffel 2 bei „Watching“), bleiben beide sichtbar, weil sie dort ja etwas anderes bedeuten.

**Anime-Seite:** Fügt unter dem Titel ein Dropdown **„Staffel“** ein. Darin stehen alle Staffeln des Franchise, z. B. bei *The Apothecary Diaries* Staffel 1, 2 und 3. Wählst du eine aus, springt Seanime direkt auf die Seite dieser Staffel.

Deine Listen bleiben unverändert: Jede Staffel bleibt auf AniList ein eigener Eintrag, das Plugin ändert nichts an deinem Konto.

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
