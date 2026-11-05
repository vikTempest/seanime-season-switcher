"""Builds viktempest-ui.json: Season Switcher + AniList Custom Ratings + Netflix theme in one extension.

Usage (from the repository root):  python3 suite/build.py .

Sources:
  src/plugin.js               Season Switcher (unchanged, still builds its own JSON with build.py)
  suite/ratings/plugin.js     AniList Custom Ratings (copy of the plugin from custom-ratings-.5-options)
  suite/theme/*.css           Netflix theme (desktop and mobile)
  suite/settings.js           settings page, theme loader, module loader

Each module keeps its own code. The script only renames its init(), routes $ui.register() to the
module loader and swaps $getUserPreference for a reader of the settings page values.
"""
import json
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
VERSION = "1.0.0"
ID = "viktempest-ui"
JSON_NAME = "viktempest-ui.json"


def read(path):
    with open(ROOT + "/" + path, encoding="utf8") as f:
        return f.read()


# Replaces $getUserPreference. Must be self-contained: hooks are compiled from their source text.
# Reads the settings page values ($store first, it is shared with the hooks, then $storage).
PREF = (
    '(function(k){var s;try{s=$store.get("vsuite:settings")}catch(e){}'
    'if(!s){try{s=$storage.get("vsuite:settings")}catch(e){}}'
    'if(!s)return undefined;'
    'if(k==="mergeLibrary"&&s.mod_switcher==="off")return "no";'
    'var v=s[k];return v===undefined||v===null||v===""?undefined:String(v)})'
)


def module(path, name, patches=()):
    src = read(path)
    src = "\n".join(l for l in src.split("\n") if not l.startswith("/// <reference"))
    fn = "vsInit_" + name

    def once(old, new):
        nonlocal src
        n = src.count(old)
        if n != 1:
            sys.exit("%s: expected exactly one %r, found %d" % (path, old, n))
        src = src.replace(old, new)

    once("function init() {", "function %s() {" % fn)
    once("$ui.register((ctx) => {", 'vsRegister("%s", (ctx) => {' % name)
    for old, new in patches:
        once(old, new)
    src = src.replace("$getUserPreference", PREF)
    return fn, "// " + "=" * 97 + "\n// Module: " + name + "\n\n" + src.strip() + "\n"


switcher_fn, switcher = module("src/plugin.js", "switcher", [
    # The episodes tab is named after the extension id
    ('"ext:viktempest-season-switcher"', '"ext:%s"' % ID),
    # Languages it doesn't have (es, pt, ja) use English
    ('const lang = I18N[pref("language", "de")] ? pref("language", "de") : "de"',
     'const lang = I18N[pref("language", "de")] ? pref("language", "de") : "en"'),
])
ratings_fn, ratings = module("suite/ratings/plugin.js", "ratings")

desktop = read("suite/theme/netflix-theme.css")
mobile = read("suite/theme/netflix-theme-mobile.css")
# Seanime uses "Custom CSS" from 1024px and "Mobile custom CSS" below, the same split here
theme_css = "@media (min-width: 1024px) {\n" + desktop + "\n}\n@media (max-width: 1023.98px) {\n" + mobile + "\n}\n"

payload = "\n".join([
    "/// <reference path=\"./plugin.d.ts\" />",
    "/// <reference path=\"./app.d.ts\" />",
    "",
    "// VikTempest's UI for Seanime " + VERSION + ": Season Switcher, AniList Custom Ratings and the Netflix theme",
    "// in one extension, with a settings page in the sidebar. Built by suite/build.py, edit the sources there.",
    "",
    "const VS_THEME_CSS = " + json.dumps(theme_css, ensure_ascii=False),
    "",
    read("suite/settings.js").strip(),
    "",
    switcher,
    ratings,
    "// " + "=" * 97,
    "",
    "function init() {",
    "    " + switcher_fn + "()",
    "    " + ratings_fn + "()",
    "    $ui.register((ctx) => vsSetupUI(ctx))",
    "}",
    "",
])

m = {
    "id": ID,
    "name": "VikTempest's UI",
    "version": VERSION,
    "manifestURI": "https://raw.githubusercontent.com/vikTempest/seanime-season-switcher/main/" + JSON_NAME,
    "website": "https://github.com/vikTempest/seanime-season-switcher",
    "language": "javascript",
    "type": "plugin",
    "description": "Season Switcher, AniList Custom Ratings and a Netflix theme in one extension. "
                   "All settings are on the \"VikTempest's UI\" page in the sidebar. Languages: Deutsch, English, Español, Português, 日本語.",
    "author": "Vik",
    "icon": "https://raw.githubusercontent.com/vikTempest/custom-ratings-.5-options/main/icon.png",
    "lang": "multi",
    "plugin": {"version": "1", "permissions": {"scopes": ["anilist", "anilist-token", "database", "settings", "storage"]}},
    "payload": payload,
}
with open(ROOT + "/" + JSON_NAME, "w", encoding="utf8") as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
print("wrote", JSON_NAME, VERSION, len(payload), "chars")
