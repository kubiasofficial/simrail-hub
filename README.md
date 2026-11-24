# SimRail Hub 0.3.1

Český komunitní launcher pro SimRail na Windows 10/11. Electron, React, TypeScript, Leaflet, SQLite a Piper. Neoficiální aplikace.

## Veřejný projekt

[Web a stažení](https://simrail-hub-kubias.web.app) · [GitHub](https://github.com/kubiasofficial/simrail-hub) · [Vydání](https://github.com/kubiasofficial/simrail-hub/releases)

## Spuštění

V `release` je portable EXE bez instalace a instalátor Setup. Uživatelská data zůstávají v `%APPDATA%/simrail-hub`. Aplikace není digitálně podepsaná.

## Novinky

- Nová hlavní obrazovka, sjednocené karty, čitelnější palubní počítač a přehlednější nastavení.
- Mapa: klasický OpenStreetMap, tmavý a světlý vzhled. Vzhledy používají podklad OSM bez dalšího API klíče. Železniční vrstva je samostatná.
- Vlaky jako ikony se šipkou před ikonou. Směr se odvozuje ze změny souřadnic; dokud nejsou vhodná data, šipka se nezobrazuje. Při oddálení se vlaky seskupují.
- Stanice jako čtverce, hledání vlaků i stanic, fotografie a plánované příjezdy/odjezdy v detailu stanice.
- Steam avatary hráčů ve vlacích a na obsluhovaných stanicích, pokud je veřejný profil zpřístupní. Bez Steam API klíče; nedostupný avatar má náhradní ikonu.
- Skutečné snímky ze hry z oficiální SimRail Wiki: 119 variant ve 12 rodinách vozidel a fotografie pro 67 stanic. Přesná varianta se vybírá podle označení z API, včetně EP08 ve skupině 4E. Každá karta má odkaz na zdroj. Neznámá varianta dostane označenou ukázku stejného typu; neznámý typ náhradní ikonu.
- Oblíbené servery a obnovení posledního vybraného vlaku.
- Mobilní palubní displej přes QR: jízdní řád, rychlost, zpoždění a mapa.
- Oprava pádu Piperu kvůli nekompatibilním fonémům: kompatibilní model a konfigurace v1.0.0. Dříve nainstalovaný nekompatibilní hlas se opraví při prvním použití (vyžaduje internet).

## Mobil přes QR

1. V palubním počítači vyber server a vlak a klikni na **Otevřít na mobilu**.
2. Připoj telefon na stejnou Wi-Fi a načti QR kód fotoaparátem. Pokud má PC více síťových adres, vyber adresu společné sítě.
3. Launcher nech spuštěný. Pokud Windows požádá, povol přístup v soukromé síti.

Displej je pouze pro čtení; hlášení přehrává počítač. Přístup platí 12 hodin, opakované otevření QR pro stejný vlak zachová připojení; změna vlaku zneplatní předchozí připojení. Tlačítko ukončení připojení vypne server. Funguje v místní síti; nejde o veřejnou internetovou službu ani nativní mobilní aplikaci. Odkaz s přístupovým tokenem se po spárování odstraní z adresního řádku a nahradí relací.

## API a přesnost údajů

Použity a živě ověřeny oficiálně dokumentované endpointy SimRail. Pole `Vehicles`, `TrainData.ControlledBySteamID`, `MainImageURL` a `DispatchedBy` se zachovávají v datovém modelu.

- [Úvod do API](https://wiki.simrail.eu/en/API/API-Introduction)
- [Vlaky](https://wiki.simrail.eu/en/API/Trains)
- [Stanice](https://wiki.simrail.eu/en/API/Stations)

Stanice vycházejí z dostupných souřadnic API; aplikace nevymýšlí polohy chybějících zastávek. Tabule stanice ukazuje plán podle dostupných jízdních řádů, nikoliv skutečné průjezdy nebo zaručeně úplný seznam. Zpoždění a vzdálenost jsou označené odhady; vzdálenost je vzdušná. Šipka ukazuje směr zjištěného pohybu.

## Vývoj a sestavení

Node.js 22+ a Windows:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run dist
```

`build:main` také sbalí preload pro sandbox Electronu. `prebuild:renderer` připraví místní Leaflet pro mobil. Sestavení používá Electron v `node_modules/electron/dist`.

## Ověření 24. 11. 2026

- TypeScript a 101 automatických testů.
- Windows Electron: Domů, mapa, vlak, palubní počítač, nastavení a QR. Při kontrole 69 stanic a 169 vlaků na CZ1, žádné zachycené chyby rozhraní.
- Spuštění zabalené aplikace 0.2.0: servery, 69 stanic, 12 řádků staniční tabule a živé avatary (2 hráči na stanicích CZ1 a 9 ve vlacích PL3 v okamžiku kontroly).
- Finální portable EXE bylo samostatně spuštěno; ověřena verze 0.2.0, načtení hlavní obrazovky a komunikačního můstku.
- Verze 0.2.1: skutečné načtení snímku EU07-193 a stanice Katowice v Electronu, nové pozadí hlavní obrazovky, žádné zachycené chyby rozhraní. Snímky mají prefix `wiki-` v `docs/verification`.
- Portable 0.2.1: ověřen start výsledného EXE a načtení přibaleného originálu EU07 i pozadí z balíčku aplikace.
- Mobil v Chrome při velikosti 390 × 844: párování, živá data, mapa, bez vodorovného přetékání. Fyzický telefon nebyl testován.
- Skutečný Windows Piper vytvořil český WAV s kompatibilním hlasem. Přehrávání přes reproduktory nebylo součástí automatické kontroly.
- Snímky a výsledky: `docs/verification`. Starší dokumentace: `docs/README-0.1.md`; její omezení a snímky popisují původní stav.

Detekce hry a spuštění samotného SimRailu nebyly v této relaci prakticky zkoušeny. Instalátor byl sestaven, systémová instalace a odinstalace nebyla provedena.

## Obrázky a licence

Aktuální snímky vozidel a stanic pocházejí z oficiální SimRail Wiki, podrobnosti a seznam zdrojů jsou v `docs/ASSETS.md` a `docs/wiki-media-sources.json`. Obrázky nebyly generovány ani obsahově upraveny. Základních 12 obrázků a hlavní pozadí jsou součástí balíčku; ostatní varianty a stanice se načítají přímo z wiki. Při nedostupnosti je náhradou místní snímek typu vozidla nebo obrázek stanice z API. Mapová atribuce je přímo v mapě, avatary dodává Steam. Licence aplikace je v `LICENSE`; média si ponechávají práva původních autorů. Piper a hlas se stahují samostatně.


## Opravy 0.2.2

- Hlášení: pravidla CSP nyní povolují přehrávání interních WAV přes blob URL; Electron umožňuje automatické přehrávání hlášení. Ověřeno skutečné přehrání českého WAV až do události `ended` (4,46 s), nikoliv jen jeho vygenerování.
- QR: přihlašovací stránka se doručuje přímo, bez přesměrování, s cookie SameSite=Lax. Tím se odstraňuje falešné hlášení o vypršení po přechodu ze čtečky QR. Opětovné otevření QR pro stejný vlak nezneplatňuje relaci. QR má větší bílý okraj.
- Nákladní a služební vlaky: podle vozů soupravy nebo kategorie z API vypínají všechna hlášení pro cestující, včetně ručních tlačítek. Při přepnutí se zruší i čekající hlášení a právě přehrávaný WAV. Nastavení osobních vlaků se zachová.
- Ověření: 98 testů, skutečné audio v Electronu, přechod z cizí stránky simulující čtečku QR do Chrome s mobilní velikostí, načtení živých dat a přepnutí nákladního/osobního vlaku. Výsledky v `docs/verification/fixes-results.json`. Fyzický telefon nebyl dostupný k ověření.


## Účet a synchronizace 0.3.0

V Nastavení je volitelný účet přes e-mail/heslo. Uložení a načtení nastavení je ruční: na prvním PC přihlásit a „Uložit do cloudu“, na druhém PC přihlásit stejný účet a „Načíst z cloudu“. Cesta ke hře a místní soubory zůstávají na každém počítači zvlášť. Relace trvá do zavření aplikace. Cloudová nastavení a účet lze smazat přímo v launcheru.

Ověřena skutečná registrace, druhá relace, přenos preferencí, oddělení soukromých dat a smazání testovacích účtů. Výsledek: `docs/verification/cloud-results.json`.

Provoz je na Spark bez fakturace: viz [bezplatný provoz](docs/FREE-HOSTING.md) a [soukromí](docs/PRIVACY.md). Při vyčerpání bezplatných limitů může být cloud nedostupný, lokální funkce zůstávají dostupné.

