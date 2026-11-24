# Skutečné snímky ze hry – verze 0.2.1

Na výslovné přání uživatele byly původní generované ilustrace nahrazeny neupravenými snímky ze hry z oficiální SimRail Wiki. Import proběhl 24. 11. 2026.

- [Přehled polských vozidel](https://wiki.simrail.eu/en/Vehicles/Poland/Overview)
- [Přehled polských stanic](https://wiki.simrail.eu/en/Stations/Poland/Overview)

## Vozidla

Katalog obsahuje 119 snímků variant ve 12 skupinách: EU07/EP07, EP08, ČD 163, ET22, Dragon 2, E186/TRAXX, BR285, Pendolino, EN57/EN71, ELF, Impuls 2 a Ty2. Přiřazení používá skutečné označení vozidla z API; odstraňuje přípony brzdy, otočení a `Variant`. EP08 se rozpozná i uvnitř API skupiny 4E.

Jedna základní fotografie každé skupiny je přiložena v `public/assets/wiki/vehicles`. Další varianty se načítají přímo z wiki. Pokud snímek konkrétní varianty selže, zobrazí se místní snímek stejného typu s popiskem „UKÁZKA TYPU“. Neznámý typ má neutrální ikonu vlaku. Každá zobrazená fotografie má odkaz na stránku zdroje.

## Stanice a hlavní obrazovka

Katalog obsahuje 67 exteriérových snímků stanic/stanovišť ze hry (budovy, nástupiště nebo kolejiště). Přiřazení je podle názvu, bez odhadování podobných stanic. Snímky se načítají přímo z wiki; náhradou je `MainImageURL` z oficiálního API. Pro LCS Jackowice a Stara Wieś zdrojová stránka při importu vracela 404, takže se použije API.

Hlavní obrazovka používá přiložený skutečný snímek EU07 ze [stránky EU07/EP07](https://wiki.simrail.eu/en/Vehicles/Poland/Trains/Electric-locomotive/4E), soubor `public/assets/wiki/hero.jpg`.

## Původ a práva

`docs/wiki-media-sources.json` obsahuje přímou adresu každého originálu, zdrojovou stránku, SHA-256, velikost a informaci, zda je soubor součástí aplikace. Nastavení wiki uvádí `contentLicense=alr` (všechna práva vyhrazena); žádná otevřená licence k těmto snímkům se tímto projektem neuděluje. Práva zůstávají autorům snímků a SimRail. Licence MIT aplikace se na externí herní média nevztahuje.

Originály nejsou obsahově upravené. CSS pouze přizpůsobuje jejich zobrazení kartám a pozadí. Zdrojový manifest a viditelné odkazy umožňují dohledat původ obrázků. Ikony rozhraní zůstávají z Lucide a značky na mapě jsou kódové SVG. Steam avatary pocházejí z veřejných profilů.

Import lze zopakovat pomocí `python scripts/import-wiki-media.py`. Stažené plné originály se ukládají do ignorované místní složky `.wiki-originals`; do distribučního balíčku vstupuje pouze 12 základních snímků a pozadí.
