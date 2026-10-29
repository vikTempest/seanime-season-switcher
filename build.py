import json,sys
d=sys.argv[1]
m={
 "id":"viktempest-season-switcher",
 "name":"Season Switcher",
 "version":"1.1.0",
 "manifestURI":"https://raw.githubusercontent.com/vikTempest/seanime-season-switcher/main/season-switcher.json",
 "website":"https://github.com/vikTempest/seanime-season-switcher",
 "language":"javascript",
 "type":"plugin",
 "description":"Shows each series only once on the home page and adds a dropdown on anime pages to switch between its seasons (AniList prequel/sequel relations). Your AniList lists stay unchanged. Languages: Deutsch, English.",
 "author":"Vik",
 "lang":"multi",
 "userConfig":{"version":1,"requiresConfig":False,"fields":[
  {"type":"select","name":"language","label":"Language / Sprache","default":"de","options":[{"value":"de","label":"Deutsch"},{"value":"en","label":"English"}]},
  {"type":"select","name":"titleLanguage","label":"Titles / Titel","default":"english","options":[{"value":"english","label":"English"},{"value":"romaji","label":"Romaji"},{"value":"native","label":"Native / 日本語"}]},
  {"type":"select","name":"includeExtras","label":"Show movies, OVAs and specials / Filme, OVAs und Specials anzeigen","default":"no","options":[{"value":"no","label":"No / Nein"},{"value":"yes","label":"Yes / Ja"}]}
,
  {"type":"select","name":"mergeLibrary","label":"Merge seasons on the home page / Staffeln auf der Startseite zusammenfassen","default":"yes","options":[{"value":"yes","label":"Yes / Ja"},{"value":"no","label":"No / Nein"}]},
  {"type":"select","name":"mergeKeep","label":"Card to show per series / Welche Karte pro Serie","default":"first","options":[{"value":"first","label":"First season / Erste Staffel"},{"value":"latest","label":"Latest season / Neueste Staffel"}]}
 ]},
 "plugin":{"version":"1","permissions":{"scopes":["anilist"]}},
 "payload":open(d+"/src/plugin.js",encoding="utf8").read(),
}
json.dump(m,open(d+"/season-switcher.json","w",encoding="utf8"),indent=2,ensure_ascii=False)
