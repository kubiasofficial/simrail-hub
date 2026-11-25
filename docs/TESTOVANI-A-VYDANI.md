# Testovací a veřejný launcher

Od 25. 11. 2026 používáme dva oddělené launchery.

| | SimRail Hub | SimRail Hub TEST |
| --- | --- | --- |
| Účel | Veřejná stabilní aplikace pro hráče | Soukromé ověřování novinek a oprav |
| Identita | cz.simrailhub.launcher | cz.simrailhub.launcher.test |
| Data | Dosavadní uživatelský profil | Vlastní profil SimRail Hub TEST |
| Aktualizace | Veřejná vydání; instalovaná aplikace stahuje opravy na pozadí | Samostatný lokální testovací soubor; veřejný updater je vypnutý |
| Zástupce | Dosavadní SimRail Hub | SimRail Hub TEST |
| Publikování | Až po ověření konkrétní opravy a rozhodnutí vlastníka vydat | Žádné automatické publikování |

TEST má vlastní SQLite, nastavení, prohlížečovou relaci, mezipaměti i hlasy. Profily se neslučují a aplikace mohou běžet současně. Lokální soukromé nahrávky zůstávají mimo balíčky; obě aplikace je mohou číst ze zvolené složky. Přepínač --user-data-dir pro automatizované kontroly se respektuje.

Vývojové spuštění bez zabalení aplikace je také TEST, aby neotevíralo veřejná uživatelská data. Zabalená veřejná aplikace bez značky hubChannel zachovává původní stabilní identitu a profil.

## Každodenní práce
1. Opravy připravujeme v pracovní větvi a ověřujeme v SimRail Hub TEST.
2. TEST udržujeme na jednom místě: nadřazená projektová složka / SimRail Hub TEST.exe. Na ploše je trvalý zástupce.
3. Před nahrazením testovacího souboru TEST zavřeme. Nevytváříme pro každou drobnost další veřejný instalátor.
4. Po ověření konkrétní sady oprav připravíme stabilní vydání a nové číslo verze. Veřejné vydání nenahrazujeme jiným obsahem pod stejnou verzí.
5. Teprve po schválení vydání zveřejníme stabilní instalační soubor a metadata aktualizace. Hráčům se aktualizace nabídne v jejich stávajícím launcheru; instalaci dokončí explicitní restart. Portable veřejná aplikace zůstává ruční.

## Sestavení
- npm run dist:test: sestaví samostatný portable TEST do .deployment/test-launcher/SimRail-Hub-TEST.exe. Konfigurace build/test.config.cjs obsahuje jiný appId, název, sestavení s datem, výstupní složku a publish=null. CLI navíc používá --publish never.
- npm run dist: připraví stabilní instalační a portable balíčky do release, samo nepublikuje.
- Veřejný GitHub workflow pro vydání se v tomto úkolu nespouštěl a žádný tag ani veřejné vydání nevzniklo.
- TEST se nepřidává do veřejného latest.yml ani na web jako veřejný instalační soubor.

## Ověření oddělení
156 automatických testů, kontrola typů a sestavení. Skutečné souběžné spuštění dvou zabalených aplikací v oddělených ověřovacích profilech; změna jazyka v jednom nezměnila druhý. TEST odmítl veřejnou kontrolu i instalaci aktualizace. Výsledky: [izolace aplikací](verification/test-channel-isolation.json).

Nastavení vychází z rozhraní [Electron app](https://www.electronjs.org/docs/latest/api/app) a [konfigurace electron-builder](https://www.electron.build/configuration/). Nevznikla nová placená služba.


Finální portable byl navíc spuštěn bez přepínače user-data-dir a skutečně vytvořil vlastní výchozí profil SimRail Hub TEST: [ověření portable](verification/test-channel-portable.json). Existující veřejný zástupce nebyl změněn. Dva dřívější testovací kandidáty ověřené SHA-256 byly přesunuté do .deployment/old-test-candidates; dále se používá jen nový trvalý TEST.

SHA-256 finálního souboru: AC8FBBAEB588A15B208E140BA1BA9C1463889EEA7202687B39C434168973752B.
