# Audit a stabilizace SimRail Hub 0.5.0
24. 11. 2026, pracovní větev audit/local-only-stabilization. Výchozí veřejný commit be75540.
Číslo verze se nezměnilo. Neproběhl push, vydání, instalace této pracovní verze ani deployment. Původní audit zachoval vzhled; následná oprava na žádost vlastníka odlišuje mapové značky vlaků a stanic.

## A. Co bylo odstraněno
- CloudAccount, cloudConfig, CloudAccountPanel, karta Účet, přihlášení/registrace/reset hesla a všechny cloudové IPC kanály z main, typů i preload whitelistu.
- Klientské volání Authentication/Firestore a jejich testy, které již nemají v bezúčtové aplikaci význam. Zůstaly samostatné testy místního ukládání a migrace.
- Nepoužívané soubory Firestore rules/indexes a jejich deployment cíl v kořenové konfiguraci. Konfigurace Firebase Hostingu i veřejné odkazy zůstaly zachované.
- Závislost updateru na cloudové konfiguraci: GitHub repository je nyní samostatná konstanta.
- Nepoužívaná obecná metoda zápisu textu v TTS a nepoužívané importy.
- Zastaralé emitované JS soubory po odstraněných službách: build:main nyní čistí pouze ověřený generovaný adresář dist-electron před kompilací. Kontrola ASAR odhalila jejich zbytkové přibalení při sestavení nad starým výstupem.

Žádný Firebase SDK balíček v závislostech nebyl: integrace používala REST. Proto se z package.json neodstraňovaly vymyšlené závislosti a nepřibyla nová databáze ani placená služba.
Veřejné Steam avatary nejsou launcherové účty a zůstaly zachované.

### Data a migrace
Nastavení zůstává v dosavadním SQLite, oblíbené servery a poslední výběr v dosavadním Local Storage. Nahrávky, cesta ke hře, hlasy a doplňky se nemigrují do nového formátu.
Migrace settings.json již nepřebírá pouze manualGamePath, ale všechny známé předvolby. Souběžné změny se provádějí postupně a neztrácejí nesouvisející hodnoty.
Poškozený JSON nastavení se před opravou uchová v kv klíči settings.corrupt.backup. Poškozenou databázi aplikace nemaže; při chybě startu nabídne srozumitelnou chybu.

Produkční inventura v 18:21:32 Europe/Prague našla 0 účtů a 0 dokumentů nastavení. Kontrola nic nezměnila. Před vydáním se musí zopakovat, protože veřejná starší verze může nadále vytvářet účty.
[Samostatný plán migrace a případného odstranění dat](CLOUD-MIGRATION.md) vyžaduje souhlas vlastníka. Žádný účet, dokument ani Firebase projekt se v tomto úkolu nesmazal.

## B. Co bylo optimalizováno
- SharedApiFetch sdílí stejné souběžné dotazy mezi přehledem serverů, mapou, palubním počítačem a mobilním displejem v rámci jednoho hlavního procesu.
- Krátká cache živých odpovědí zachovává aktuálnost. Jízdní řády nedrží zároveň jako dlouhodobý syrový JSON a jako parsované objekty. Prošlé položky síťové cache se uvolňují.
- Cache má omezený počet položek a rozpočet textových dat; Steam avatary jsou omezené na 500 záznamů. Parsované jízdní řády mají omezený počet serverů místo neomezeného růstu.
- ServerService deduplikuje souběžné obnovy. TrainTrackingService sdílí čekající požadavky stanic a jízdních řádů; stejné dotazy na serverový čas sdílí síťová vrstva.
- Varování o starých stanicích a jízdních řádech se přenášejí ke všem souběžným spotřebitelům. Mapa při nedostupnosti stanic zachová poslední značky a zobrazí chybu; tichý fallback se nevydává za čerstvé údaje.
- Výpadky používají postupné opakování 2–30 sekund na URL. Chybová odpověď se nevydává za čerstvá úspěšná data.
- Timeout hlídá i nedokončené tělo odpovědi. Čerstvost palubního počítače vychází ze skutečného fetchedAt dat, ne z okamžiku pozdního doručení IPC.
- Minimalizovaná mapa neaktualizuje markery ani sledovací kameru; animace jsou pozastavené. Datové dotazy, hlášení, mobil a updater pokračují.
- Odstranily se zbytečné vizuální tiky skrytého palubního počítače a duplicitní listenery okna. Časovač pro vyhodnocení stáří feedu odpovídá jeho pětisekundovému intervalu.
- Opakované otevření samostatného palubního počítače znovu používá stejné okno místo vytváření dalších rendererů. Identita okna pro OBS se zachová.
- Updater neposílá stejný stav do React store každé dvě sekundy.
- Piper syntéza sdílí identické požadavky a další úlohy zpracovává postupně. Čištění cache čeká na aktivní úlohy. Zvukové URL, dekodéry, listenery a vlastní dětské procesy se uvolňují.

Změny nepředstavují kompletní přepis ani nový design. Konkrétní rozsah výkonového zlepšení má omezení uvedená níže.

## C. Bezpečnostní nálezy a opravy

| Nález | Závažnost a příčina | Oprava a soubory |
| --- | --- | --- |
| ZIP zálohy se rozbalovaly před kontrolou skutečného výstupu | Vysoká pro dostupnost při otevření škodlivého místního archivu: paměťové zahlcení hlavního procesu | boundedZip.ts počítá skutečně emitované bajty při streamování; ModManager.ts hlídá velikost před readFile, počet položek, duplicity, cesty i výstup |
| Modifikace se mazala před dopsáním nové verze | Střední, potvrzené riziko ztráty dat při přerušení/zápisové chybě | ModManager.ts připraví staging, provede výměnu rename a ponechá předchozí obsah v .previous-*; změny jsou serializované |
| Windows názvy a ADS/aliasy | Střední, dvojtečka a trailing-dot mohou mít jiný význam než očekávaný název | Zamítnuté dvojtečky v ZIP cestách, trailing-dot a rezervované device názvy v ID; cílové cesty se ověřují vůči modsDir |
| Mobil neměl ověření Host/Origin a explicitní limity spojení | Střední, zpevnění proti DNS rebinding a zatížení v LAN; samostatný průnik autentizací nebyl prokázán | MobileServer.ts ověřuje vlastní IP/Host, privátní adresu, Origin a cross-site požadavky, povoluje jen GET, zavádí rate limit a síťové timeouty |
| Přístup IPC byl vázán jen na webContents | Střední, nedostatečně úzká hranice důvěry; vzdálené RCE nebylo prokázáno | windowSecurity.ts a main/*.ts vyžadují hlavní rámec přesného aplikačního dokumentu; cizí navigace a webview jsou blokované |
| Hlasový model/config se neověřoval hashem | Střední, chyběla kontrola integrity modelu po downloadu | voiceCatalog.ts obsahuje připnuté SHA-256 obou souborů pro každý hlas; TTS odmítne nesoulad před nahrazením starých souborů |
| Řádek audio cache mohl obsahovat cizí cestu | Střední v případě poškozené/manipulované místní DB | Evikce smí odstranit pouze očekávaný hash.wav ve vlastní cache, nikdy libovolný file z DB |
| Log mohl zachytit párovací URL či token v chybě | Nízká, preventivní ochrana diagnostiky | LogService.ts rediguje pair/token/key, Bearer a hub cookie; ověřeno testem |

Další zpevnění: renderer CSP již nemá obecný síťový přístup HTTPS pro connect-src, blokuje objekty, formuláře a rámce. Síťové služby používají main IPC. contextIsolation=true, sandbox=true, nodeIntegration=false a webSecurity=true zůstávají na všech oknech. Kontrola vstupů zpřísňuje čísla vlaků, server a konečné hodnoty rychlosti TTS.
Stahování TTS má časový a velikostní limit a správně zavírá proudy při síťové nebo diskové chybě. Stažený program Piper má nadále ověřený SHA-256.

## D. Výkon
Krátké běhy proběhly na stejném Windows prostředí proti živému API, v izolovaných skrytých testovacích profilech. RAM je součet working set procesů Electronu, může tedy vícenásobně započítávat sdílené stránky. CPU je součet percentCPUUsage procesů z Electronu.

| Fáze | Před: RAM MiB / CPU % | Dílčí auditní build (18:24): RAM MiB / CPU % |
| --- | ---: | ---: |
| Domů, konec 30s vzorku | 388,0 / 0,266 | 392,4 / 0,161 |
| Otevřená mapa, konec 60s vzorku | 428,7 / 0,255 | 429,7 / 0,250 |
| Palubní počítač, konec 30s vzorku | 473,2 / 0,246 | 443,0 / 0,439 |
| Minimalizace, konec 30s vzorku | 468,9 / 0,153 | 442,5 / 0,247 |
| Po 30 minutách | Neověřeno | Neověřeno |

Start byl 482 ms před změnami a 636 ms v měřeném auditním buildu. Otevření palubního počítače včetně sítě bylo 2392 ms a 1451 ms.
Dokončené API požadavky/min podle jednotlivých krátkých fází: Domů 146 → 74, mapa 48 → 47, palubní počítač 26 → 32, minimalizace 26 → 28. První číslo obsahuje startovní špičku přepočtenou z 30 sekund; nejde o ustálený dlouhodobý provoz.

Tato data nejsou kontrolovaný benchmark: živé vlaky a velikost jízdních řádů se změnily, běžely i jiné auditní činnosti a ve výchozím profilu se později našlo zapnuté automatické hlášení. Z výsledků nelze tvrdit obecné zrychlení startu, pokles CPU ani plošné snížení počtu požadavků. Některé naměřené hodnoty se zhoršily. Přínos deduplikace je samostatně doložen deterministickým testem tří spotřebitelů proti jednomu síťovému volání.

Dlouhé měřicí běhy se ukončily uzavřením testovacích oken před závěrečným odečtem. Příčina nebyla potvrzena; nelze ji automaticky označit za chybu prostředí ani aplikace. Poslední drobné opravy proudů, CSP a vizuálních tiků nejsou pokryté novým třicetiminutovým měřením.
[Reprodukovatelný postup](PERFORMANCE.md) ukládá i průběžné minutové vzorky a důvod ukončení. [Strojové krátké výsledky](verification/audit-performance-short.json).

Dodatečně byl ověřen samotný reprodukovatelný skript nad finálním balíčkem krátkým během (167 s, completed=true, požadovaný krátký interval 60 s). Tento výsledek není třicetiminutovým měřením. home-idle: 438.6 MiB / 0.203 % CPU; map: 463.2 MiB / 0.254 % CPU; dashboard: 477.4 MiB / 0.462 % CPU; minimized: 476.1 MiB / 0.243 % CPU; long-run-end: 478.5 MiB / 0.087 % CPU. Rozdílná paměť oproti dřívějším vzorkům dále ukazuje, že obecné snížení RAM nebylo prokázané. [Výsledek krátkého běhu](verification/audit-perf-manual-short.json).

## E. Testování
- Původní auditní běh: 143 úspěšných testů, 0 neúspěšných, 20 testovacích souborů. Po opravě regresí 25. 11. 2026: 151 úspěšných testů ve 21 souborech. Výchozí veřejná verze měla 122 testů; odstranily se 4 cloudově specifické testy a přibylo 25 regresních případů.
- npm run typecheck a npm run build prošly. Vite hlásí hlavní JS chunk přibližně 586 kB; nerozděloval se naslepo bez měření přínosu.
- Electron UI: bez chyb rendereru; chybí karta účtu, cloudové IPC je odmítnuté. Během minimalizace bylo 0 mutací markerové vrstvy při současném pokračování dat. Lokální WAV dohrál i při minimalizaci. Opakované otevření druhého okna zachovalo jeho ID.
- Skutečný Piper: český model vytvořil 3,79 s WAV, polský model 2,86 s WAV. Oba modely i konfigurace prošly SHA-256 kontrolou a čerstvá syntéza vytvořila nenulový výstup. Soukromé uživatelské soubory se nezměnily.
- npm audit --omit=dev: 0 upozornění. Úplný npm audit: 6 středních upozornění v řetězci electron-builder/minimatch, 0 vysokých a 0 kritických. Návrh npm fix by snižoval hlavní verzi builderu; nebyl použit.
- Případy timeoutu těla, souběhu, backoffu, lokální migrace, PH/PT, fronty hlášení, expirace a revokace QR, cizího Host/Origin, ZIP bomb a poškozených dat jsou ověřené automaticky.
- Windows NSIS instalátor a portable EXE byly úspěšně sestavené pouze místně. Zabalená aplikace načetla 19 živých serverů, odmítla cloudové IPC a ASAR neobsahoval odstraněné účty ani soukromé WAV/M4A. Skutečný portable EXE byl spuštěný v izolovaném profilu a potvrdil režim ručních aktualizací; instalátor nebyl spuštěný. [Balíček](verification/audit-packaged.json), [portable](verification/audit-portable.json).

Neověřeno: porovnání odhadu zpoždění s hodinami konkrétního vlaku v běžící hře, fyzický telefon a jeho čtečka QR, různé firewally/routery, skutečné přepnutí Wi-Fi adaptéru, fyzické uspání/probuzení PC, čistý Windows 10, vizuální zachycení v samotném OBS, chování při reálném výpadku napájení uprostřed rename a kompletní třicetiminutový běh. Mobilní HTTP a změny tokenů byly testované lokálními klienty; to nenahrazuje fyzický telefon.
V tomto úkolu se neprováděla skutečná aktualizace/instalace launcheru. Updater byl ověřen bezpečnými stuby: bez restartu při hraní, bez instalace při ukončení a s nutným explicitním potvrzením.

## F. Zbývající problémy
### Potvrzená omezení
- Lokální HTTP není šifrované a cookie není Secure. Nevyžaduje externí server ani ruční certifikát, ale QR je přístupové tajemství pro důvěryhodnou LAN.
- Windows balíček nemá vydavatelský podpis; SHA-512/hash ověřuje shodu dat, nikoli důvěryhodnost vydavatele.
- Šest středních advisory sestavovacího řetězce zůstává; žádný se podle npm audit netýká runtime závislostí.
- Překlady detailů nejsou kompletní; tento úkol je nepřepisoval.
- Obnova velké sady doplňků je postupná po jednotlivých validních doplňcích, nikoli jedna databázová transakce přes celou sadu. Předchozí soubory se ponechávají v .previous-* a mohou zabírat disk. Jejich mazání ani automatická retence nebyly zavedeny.

### Neobjasněné / potenciální problémy
- Ukončení dlouhodobých měření: pro veřejné vydání zopakovat mimo nástrojovou relaci a zjistit příčinu.
- Výkon na jiné velikosti provozu, jiném zařízení a při několika síťových adaptérech je potřeba doměřit.
- Netvrdit, že audit dokazuje absenci všech bezpečnostních chyb; jde o kontrolu uvedených cest a testovaných hrozeb.

## G. Doporučení pro 0.5.1 / 0.6.0
1. Před vydáním dokončit 30min a několikahodinový test na skutečném herním PC; připojit mobil a ověřit OBS.
2. Znovu inventarizovat případné nově vzniklé cloudové účty a teprve po samostatném souhlasu řešit vypnutí vzdálených služeb.
3. Vyřešit build-time advisory bezpečným kompatibilním upgradem, ne automatickým downgrade přes npm audit fix --force.
4. Doměřit CPU palubního počítače a startup na stabilním datasetu. Další lazy loading nebo memoizace provádět až podle profilu.
5. Doplnit neúplné překlady, sjednotit další dokumentaci a navrhnout uživatelsky kontrolovanou retenci starých lokálních záloh.

## H. Připravenost k vydání
Pracovní větev je připravená k vlastníkově kontrole a lokálnímu vyzkoušení. Není doporučeno ji rovnou veřejně vydat před objasněním dlouhodobého běhu a fyzickým testem mobilu/OBS. Zvláště nelze vydávat stejnou verzi 0.5.0 jako náhradu už existujícího veřejného instalačního souboru.

Nové číslo verze, merge do produkční větve, push, publikace GitHub Release, instalace a deployment webu jsou samostatná rozhodnutí vlastníka. V tomto úkolu neproběhla.

Původní .deployment/audit-complete obsahuje později nahlášené regrese. Pro další kontrolu použijte novou portable aplikaci z .deployment/oprava-k-overeni (kopie TEST-SimRail-Hub-opravy.exe v nadřazené projektové složce). Nejde o veřejné vydání a instalátor nebyl spuštěný.

Podklady: [integrita distribuce](verification/audit-distribution.json), [balíčky](verification/audit-packaged.json), [portable](verification/audit-portable.json), [UI](verification/audit-ui.json), [Piper](verification/audit-tts.json), [inventura](verification/audit-cloud-inventory.json), [migrace](CLOUD-MIGRATION.md), [měřicí postup](PERFORMANCE.md).


## I. Oprava nahlášených regresí — 25. 11. 2026
Předchozí ověření serverového seznamu nezachytilo chybu skutečných jízdních řádů ani nativní přetahovací oblasti v jazykovém dialogu. Tato část doplňuje a opravuje původní závěry.

- **Jazykové okno:** dialog byl potomkem titulku Electronu s app-region:drag. Je nyní portálem přímo v body a celý dialog i potomci mají no-drag. Prošly X, Escape, pozadí, změna jazyka i skutečné Win32 kliky.
- **Jízdní řády:** živá odpověď CZ1 měla 21 234 384 znaků, nad chybným limitem 20 MiB. GetAllTimetables má nyní samostatný limit 64 MiB; ostatní odpovědi 20 MiB. Síťový adaptér počítá skutečné bajty během čtení a nadlimitní proud ruší. Velký JSON se neparsuje dvakrát a neukládá se jeho další dlouhodobá kopie.
- **Falešné zpoždění:** getTime vracel epochu s UTC poli odpovídajícími herním časům jízdního řádu. Převod Europe/Warsaw přidával v zimě hodinu (v létě by přidal dvě). Oprava používá UTC pole, nikoli časové pásmo počítače. Porovnání na šesti živých jízdách CZ1 je uložené bez osobních údajů.
- **Jistota zpoždění:** po prvním výběru se ukazuje neznámá hodnota, dokud není pozorován navazující průjezd. Skok více bodů, obrácení indexu, ztráta času, stará data nebo jiná jízda ruší pozorování. API index se nepřisazuje k poslední stanici. Známé runId musí přesně odpovídat jízdnímu řádu; samotné shodné číslo nestačí. Automatická omluva se spouští jen z pozorovaného zpoždění, interval 15 minut zůstává.
- **Skutečný průjezd:** 25. 11. 2026 ve 14:40:38 pražského času prošel vlak 3730 z indexu 9 na 10. Plán průjezdního bodu Łazy Łc 14:41:06, serverový čas 14:40:35, výsledek −1 minuta, nikoli falešných přibližně +59. Nejde o nezávislé měření uvnitř hry.
- **Mapa:** modrá protáhlá silueta vlaku s šipkou před ním, zelený hráčský bod/avatar; slonovinový čtverec stanice, zlatá obsazená stanice s avatarem vedle symbolu, kruhové skupiny. Textové značky sdílí mřížku pro omezení překryvů. Pohyb aktualizuje existující markery.
- **Skutečný portable EXE:** spuštěn v izolovaném profilu bez instalace. Načetl jízdní řád 34 bodů, 69 stanic, mapové dlaždice HTTP 200, nové tvary i směrovou šipku. Zabalená aplikace zvlášť ověřila šest živých jízdních řádů a mobilní párování → cookie → /api/state se skutečným jízdním řádem.
- **Další kontroly:** typy a sestavení prošly, zvuk dohrál při minimalizaci, vizuální mapa při minimalizaci nemutovala DOM a data se přitom aktualizovala. Kontrola ASAR nepotvrdila soukromé WAV/M4A ani odstraněný cloudový kód.
- **Limity ověření:** fyzický telefon na Wi-Fi, dlouhodobý běh s hrou a OBS zůstávají k ověření. Budoucí tratě nejsou domýšlené ani přidané bez ověřené geometrie. Nepřibyly placené služby.

Opakování: npm run test; npm run typecheck; npm run build. UI po sestavení: node scripts/verify-stability-ui.mjs. Pro již připravenou distribuci: node scripts/verify-stability-packaged.mjs .deployment/oprava-k-overeni. Skripty používají oddělené testovací profily, automatická hlášení vypínají a vlastní okna zavírají.

Důkazy: [UI](verification/regression-ui.json), [nativní myš](verification/regression-native-input.json), [živá zabalená aplikace](verification/regression-packaged-live.json), [skutečný portable](verification/regression-portable.json), [pozorovaný průjezd](verification/regression-live-passage.json).
