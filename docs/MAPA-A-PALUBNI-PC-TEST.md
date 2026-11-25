# Mapa A a palubní počítač — soukromý TEST
25. 11. 2026. Implementace schváleného návrhu, bez veřejného vydání a bez změny základní verze 0.5.0.

## Funkce
- Varianta A: kruhový vlak s čelním piktogramem, stavební piktogram stanice na světlém čtverci. Obsazená stanice je zlatá; hráčský stav a avatar zůstávají samostatné.
- EC tyrkysová, EIC indigo, EIP fialová, IC modrá, TLK zlatá, osobní/regionální zelená, nákladní a nerozpoznané šedé. Používá se označení kategorie z API a doložené kódy; značka IC/TLK/EIP má přednost před obecným kódem. Neodhadujeme kategorii z čísla nebo modelu lokomotivy.
- Značka stanice při souběhu s vlakem dostane boční odkaz s linkou ke skutečné poloze. Nejde o změnu souřadnice stanice.
- Výběr vlaku zobrazí trasu po kolejích, projeté úseky tlumeně, zbývající v barvě kategorie. Ostatní vlaky, skupiny a nesouvisející stanice se utlumí; zastávky pro cestující se zvýrazní.
- Celý úsek, skrýt/zobrazit trasu, opakovat načtení po chybě, samostatné přepnutí mapového sledování.
- Číslo vlaku lze napsat a potvrdit Enterem nebo tlačítkem Sledovat. Neplatné či nedostupné číslo nezruší dosavadní výběr. Pozdní odpověď po změně zadání/serveru se nepoužije.
- Přestat sledovat okamžitě odstraní vlak z palubního počítače, zastaví rozpracovaná hlášení a detailní odběr a odpojí mobil. Již otevřené OBS okno zůstane otevřené, ale zobrazí prázdný výběr. Zvolený server se zachová. Opraveno rovněž přepínání vlaku v opakovaně používaném OBS okně.
- Výraznější následující zastávka, klidnější předchozí, vzdálenost, velká rychlost, animované změny stanice a zpoždění. Červený výrazný efekt nad 20 minut pouze u pozorované hodnoty; předběžný odhad je neutrální. Omezený pohyb systému a minimalizace se respektují.
- Jízdní řád zvýrazňuje aktuální bod a další PH zastávku a zřetelněji odděluje plán → odhad.

## Traťová data a omezení
SimRail API poskytuje jízdní řád a vybrané souřadnice stanic, nikoli úplnou kolejovou geometrii každé jízdy. Proto je přiložen lokální odvozený graf OSM pro dostupnou oblast. Mapa výslovně uvádí dostupný úsek a zdroj; není to oficiální kolejový routing SimRailu. Přesná kolej a průběh mezi řídce známými body jsou orientační. Mimo pokrytí nebo při nenavazující síti nevzniká přímá spojnice.

Soubor public/data/rail-network.json: 2 286 738 bajtů; 19 270 uzlů, 25 564 hran, 68 349 geometrických bodů. Snapshot OSM 2026-11-25T14:27:21Z, zjednodušení 7 m. Data mají vlastní licenci ODbL-1.0 a přiložené označení autora/licence; licence aplikace se tím nemění. Zdroj a pravidla: [OpenStreetMap](https://www.openstreetmap.org/copyright), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API). Obnovovací skript scripts/prepare-rail-network.py čte surový Overpass JSON a vytváří stejný formát.

Kódy vlaků ověřeny podle [PKP PLK, příloha 6.3](https://en.plk-sa.pl/files/public/user_upload/pdf/Reg_przydzielania_tras/Regulamin_sieci_2024_2025/v.15/zal_6.3_Reg24_25_v15_ANG.pdf). Například ROJ je osobní kategorie; při chybějícím obchodním označení samotný MPE nerozlišuje IC a TLK, proto zůstává nerozpoznaný.

Graf se načítá až při první trase. Výpočet probíhá lokálně v main procesu, sdílí souběžné požadavky, má omezené cache a mezi segmenty předá řízení ostatním činnostem. Při kliknutí uživatele se Overpass nedotazuje. Na minimalizované nebo neaktivní mapě se vizuální průběh nepřepočítává. Netvrdíme plošné snížení CPU/RAM bez dlouhodobého měření.

## Ověření
- 162 testů ve 24 souborech; typecheck a build prošly.
- [UI tok](verification/approved-a-ui.json): neplatné zadání zachovalo sledovaný vlak; ukončení vyčistilo hlavní i OBS pohled a odpojilo mobil; testovaná čtyřstanicová mapa měla 0 překryvů těl značek stanic a vlaků; skrytí trasy přežilo minimalizaci.
- [Živá zabalená aplikace](verification/approved-a-live.json): EIP 1411, regionální 11511, TLK 16113, 69 stanic s budovami, fialová EIP, načtený snímek vozidla a mapové dlaždice.
- [Skutečný portable](verification/approved-a-portable.json): stejné funkce ověřeny ve finálním souboru na trvalém místě, žádné vydání ani instalace.
- [Pozadí](verification/approved-a-background.json): při minimalizaci 0 změn markerového DOM, aktualizované údaje, dokončené přehrávání zvuku.
- Ruční ověření dlouhé jízdy s fyzickým mobilem a OBS zůstává samostatné.

Opakování: npm run test; npm run typecheck; npm run dist:test; node scripts/verify-map-dashboard.mjs; node scripts/verify-map-live.mjs.
Trvalý testovací soubor: ../SimRail Hub TEST.exe; veřejný launcher a jeho zástupce zůstaly zachované.

SHA-256 TEST exe: 1416DD80E7E32BB74564E7070508F77D732AD903A654DF21DF276A7D3C4BEE72.
SHA-256 traťové databáze: 5EB2A2AC963A6CC4E712DB64A2E01EC33657F7DB7FA13D41D5AFA9841D79CFB6.
