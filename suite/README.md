# VikTempest Seanime UI – alles in einer Erweiterung

Eine einzige Erweiterung für Seanime mit allem drin:

- **Season Switcher** (Staffeln zusammenfassen, Staffel-Dropdown, Folgenliste)
- **AniList Custom Ratings** (Bewertungskategorien, Custom Lists)
- **Netflix-Theme** (schwarz-roter Look, per Schalter, ohne CSS einzufügen)

## Einstellungen

Alle Einstellungen stehen auf einer eigenen Seite: in der linken Seitenleiste von Seanime auf **„VikTempest Seanime UI“** klicken. Dort gibt es:

- **Sprache** für alle Teile zusammen (Deutsch, English, Español, Português, 日本語). Der Season Switcher kann nur Deutsch und Englisch, bei den anderen Sprachen nimmt er Englisch.
- **Jeden Teil einzeln an/aus** (Season Switcher, Custom Ratings, Netflix-Theme)
- alle bisherigen Einstellungen der beiden Plugins

Unten auf **Speichern** klicken. Das Theme ändert sich sofort. Einstellungen mit dem Hinweis „nach Neustart“ (Sprache, Teile an/aus, Titel, Filme/OVAs, Folgenliste) gelten erst, wenn du Seanime neu startest, weil sich ein Plugin nicht selbst neu laden kann.

Die Einstellungen werden im Plugin gespeichert, nicht mehr unter Extensions → Preferences.

## Installation

**Wichtig:** Deinstalliere vorher unter **Extensions** die einzelnen Plugins **Season Switcher** und **AniList Custom Ratings**, sonst läuft alles doppelt. Hast du das Netflix-Theme unter Einstellungen → User Interface → CSS eingefügt, leere dort die Felder und schalte das Theme stattdessen auf der Seite „VikTempest Seanime UI“ ein.

In Seanime unter **Extensions** auf „Add extensions“ klicken und unter „Install from URL“ diesen Link einfügen:

```
https://raw.githubusercontent.com/vikTempest/vikTempest-Seanime-UI/main/viktempest-ui.json
```

Danach die Erweiterung aktivieren und die Berechtigungen bestätigen (AniList, AniList-Token, Datenbank, Einstellungen, Speicher). Das sind einfach die Berechtigungen beider Plugins zusammen.

Beim ersten Start fragt Seanime wie beim Season Switcher einmal, ob die Folgenliste die „Default episode source“ werden darf.

Deine Bewertungen und Listen liegen auf AniList und bleiben erhalten.

## Für Entwickler

- `viktempest-ui.json`: die installierbare Erweiterung (im Hauptordner des Repos)
- `suite/settings.js`: Einstellungsseite, Theme, Laden der Teile
- `src/plugin.js`: Season Switcher (wird wie bisher weiterentwickelt)
- `suite/ratings/plugin.js`: AniList Custom Ratings (Kopie aus dem Repo custom-ratings-.5-options)
- `suite/theme/`: Netflix-Theme (Desktop und Handy)

Nach jeder Änderung an einem der Teile: `VERSION` in `suite/build.py` erhöhen und `python3 suite/build.py .` ausführen. Das Skript übernimmt den Code der Teile unverändert und tauscht nur die Stellen aus, an denen sie ihre Einstellungen lesen.
