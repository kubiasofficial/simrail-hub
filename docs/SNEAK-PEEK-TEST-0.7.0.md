# Sneak peek – TEST 0.7.0

Soukromá testovací vrstva mapy. Veřejný launcher ani veřejné vydání se tímto úkolem nemění.

## Ovládání

Živá mapa → Vrstvy a vzhled → Sneak peek – připravované tratě → Lublin Region / Zobrazit trať. Vrstva je výchozí vypnutá, předvolba se ukládá v místním profilu. Zobrazení náhledu nepřepne vlak sledovaný v palubním počítači.

První náhled: Dęblin → Lublin → Chełm, přibližně 145,2 km. Fialová přerušovaná čára a decentní pohyb čárkování se liší od živých tras. Dvanáct orientačních bodů OSM se objeví při přiblížení od zoomu 10; jejich duté kosočtvercové symboly se liší od budov aktivních stanic i kruhových značek vlaků. Kliknutí na čáru nebo bod otevře kartu DLC. Alternativně je dostupné stejné otevření z nabídky vrstvy, včetně ovládání klávesnicí.

Karta obsahuje oficiální obrázek DLC, rozsah, plán vydání, seznam bodů, odkaz na Steam a zdroje s datem kontroly. Vypnutí animací i systémové omezení pohybu se respektují. Při minimalizaci nebo opuštění mapy se náhled nevykresluje; otevřený náhled se po návratu obnoví. Ruční zobrazení se nenechá přepsat prvním načtením živých vlaků a počká na dokončení případného probíhajícího zoomu Leafletu.

## Co údaje znamenají

Oficiální Steam stránka app 5548340 dne 26. 11. 2026 potvrzuje připravovanou trasu Dęblin–Lublin–Chełm a plán prosinec 2026. Není publikován konkrétní den; po uplynutí uvedeného měsíce aplikace označí potřebu ověření termínu, nezačne trať sama vydávat za hratelnou.

Aktuální kontrola CZ1 našla v jízdních řádech názvy Nałęczów, Lublin Zachodni a Lublin Główny, ale žádné souřadnice stanic náhledu v seznamu stanic. Záznam názvu v API nepotvrzuje připravenost DLC ani konkrétní zastávky PH. Body náhledu nejsou seznamem zastávek žádného vlaku.

Geometrie pochází ze skutečné železniční relace OSM 318953, nikoliv z herního modelu. Vytvořena je souvislá cesta po existujících kolejích mezi Dęblinem a Chełmem, která prochází Lublin Główny. Mezery se nevymýšlejí. Zjednodušení má toleranci 7 metrů; výsledek má 256 bodů. Přesná kolej a herní provedení se mohou lišit.

## Technické oddělení a výkon

Dataset `src/data/sneak-peek.json` má přibližně 7,6 kB, načítá se jednou až po zapnutí samostatným rendererovým chunkem (~7,45 kB / ~2,97 kB gzip). Nezavádí nové síťové dotazy při používání ani placené služby. Neslučuje se s `rail-network.json`, seznamem živých stanic, jízdními řády ani dispečerem a neovlivňuje hlášení cestujícím. Stávající mapové podklady nadále používají svou obvyklou síťovou komunikaci.

Pro obnovu dat: stáhnout OSM JSON z https://api.openstreetmap.org/api/0.6/relation/318953/full.json, znovu ověřit oficiální Steam informaci a API, potom spustit `python -X utf8 scripts/prepare-sneak-peek.py <osm-json> <api-evidence-json> src/data/sneak-peek.json`. Podklady tohoto ověření jsou místně v ignorované složce `.deployment/sneak-peek`. Surová OSM data ani soukromé zvukové nahrávky se do aplikace nepřidávají.

OSM odvozená data: © OpenStreetMap contributors, ODbL 1.0. Licenční informace jsou v `public/data/sneak-peek.LICENSE.txt`, atribuci poskytuje také mapa a detail úseku. Steam obrázek a oznámení jsou zdroje SimRail S.A. / PlayWay S.A.

## Ověření

188 automatických testů, kontrola typů a sestavení. `verification/sneak-peek-ui.json` zaznamenává skutečné Electron UI (nejprve vývojové okno s označenými řízenými daty, následně zabalený TEST se skutečným API; režim je uveden v reportu): výchozí vypnutí, lazy načítání, skutečnou čáru, 12 bodů, kartu a zdroje, nulové volání provozních/audio kanálů při otevření náhledu, vypnutí/zapnutí, uloženou předvolbu, minimalizaci a absenci vzdálených dotazů na geometrii.

Zabalený TEST byl navíc ověřen proti aktuálnímu CZ1: 161 vlaků, živé trasy vzorků EIP, R a TLK bez mezer, budovy stanic a fotografie vozidla (`verification/approved-a-live.json`).
