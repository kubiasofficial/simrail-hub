# SimRail Hub

Komunitní desktopový launcher pro **SimRail: The Railway Simulator** (Windows 10/11).
Electron · React · TypeScript · Vite · Tailwind CSS · Zustand · SQLite (`node:sqlite`) · Leaflet · Piper TTS.
Celé rozhraní je v češtině. Projekt je **neoficiální** a není spojen s vývojářem hry.

> Tato první verze vznikla bez přístupu k Windows a bez přístupu ke skutečnému SimRail API.
> Níže je přesně uvedeno, co je ověřeno, co ne a na čem staví předpoklady. Nic z toho nebylo vydáváno za hotové, pokud to hotové není.

## Rychlý start (vývoj)

```bash
npm install
npm run dev        # Vite + Electron
npm test           # 81 automatických testů
npm run typecheck
```

Požadavky: Node.js 22+, Windows 10/11 (na jiných systémech běží UI a demo, ne Steam ani Piper).

## Sestavení instalátoru pro Windows

Instalátor se **musí sestavit na Windows** (lokálně nebo přes GitHub Actions):

```bash
npm run dist       # release/SimRail-Hub-Setup-<verze>.exe + release/SimRail-Hub-Portable-<verze>.exe
```

Nebo nahrajte projekt na GitHub a spusťte workflow **„Sestavení pro Windows“** (`.github/workflows/build-windows.yml`;
spouští se i na tagu `v*`). Workflow provede typecheck, testy a build a nahraje `.exe` jako artefakt.

* Instalátor: NSIS, volba instalační složky, zástupce na ploše a v nabídce Start, odinstalace přes „Aplikace a funkce“.
* Odinstalace **ponechá** uživatelská data v `%APPDATA%\simrail-hub` (nastavení, mody, hlasy). Smažte ji ručně, pokud ji nechcete.
* Konfigurace, SQLite databáze, logy, mody a hlasy se ukládají do `%APPDATA%\simrail-hub`. Portable verze používá stejnou složku.
* **Aplikace není podepsána** certifikátem. Windows SmartScreen proto při prvním spuštění zobrazí varování.

### Hotové portable EXE (bez instalace)

Spolu se zdrojáky je přiložen `SimRail-Hub-Portable-0.1.0.exe` – samostatný soubor, stačí ho spustit.
Vznikl na Linuxu bez Windows, proto: **není podepsaný**, **nemá vložené ikony do hlavičky EXE** (okno ikonu má) a **nikdy jsem ho na Windows nespustil**.
Zabalená aplikace (asar) byla ověřena spuštěním linuxové varianty téhož balíčku. Plnohodnotný NSIS instalátor (ikona, zástupce, odinstalace)
se musí sestavit na Windows: `npm run dist` nebo workflow na GitHubu.

### Český server jako výchozí

Mapa a palubní počítač automaticky vybírají první aktivní **český** server (kód začíná `cz` nebo název obsahuje „Czech/Česk…“);
v seznamu serverů jsou čeští první se štítkem ČESKÝ. Kód `cz1` je odhad z komunitní wiki – ověřte v seznamu serverů.
Na Domů je průvodce „Nastavit automaticky“, který jedním kliknutím stáhne Piper a český hlas (potřebuje internet).

### Fotodokumentace a ukázková data

`docs/SimRail-Hub-fotodokumentace.pdf` a `docs/screenshots/`. Snímky vznikly s přepínačem `--docs-fixtures` (jen nebalená aplikace, výrazný fialový štítek):
obsah serverů a vlaků je z vestavěné ukázky, ne ze SimRail API.

## Co funguje a co je omezené

| Funkce | Stav |
|---|---|
| Okno bez rámu, navigace, hlavní obrazovka, motivy | ✅ Ověřeno spuštěním v Electronu (Linux / Xvfb), snímky obrazovky |
| Detekce hry (registry, `libraryfolders.vdf`, `appmanifest_1422130.acf`, více knihoven), ruční výběr s ověřením | ✅ Logika pokryta testy · ⚠️ **Čtení registrů a skutečné instalace jsem na Windows nezkoušel** |
| Spuštění přes `steam://rungameid/1422130` | ⚠️ Testy ověřují jen volání správného URI; reálné spuštění neověřeno |
| Online servery (hledání, filtry, auto/ruční obnovení, výpadky) | ⚠️ Napsáno podle komunitní dokumentace API, **živá odpověď neověřena** (viz Zdroje dat) |
| Živá mapa (Leaflet, bez blikání značek, panel vlaku, podklady) | ⚠️ Vykresluje se; dlaždice map a živá data neověřena (sandbox bez internetu) |
| Palubní počítač (zastávky/průjezdy, zvýraznění stanice, animovaná šipka, barvy zpoždění) | ✅ Ověřeno na DEMO datech · ⚠️ nad živými daty neověřeno |
| Samostatné okno palubního počítače (OBS / 2. monitor) | ⚠️ Zobrazení ověřeno, otevření z tlačítka v reálném provozu ne |
| Hlášení: šablony cs/pl/cs+pl, exonyma, stavový automat bez duplicit, fronta | ✅ Pokryto testy |
| Piper TTS (stažení, výběr hlasu, rychlost, hlasitost, cache, editor výslovnosti) | ⚠️ Logika testována s falešným Piperem; **skutečná syntéza na Windows neověřena** |
| Systémový hlas jako záloha | ⚠️ Funguje jen, pokud má Windows český/polský hlas |
| Správce modifikací (import, aktivace, verze, kompatibilita, zálohy, obnovení) | ✅ Pokryto testy včetně útoků (zip-slip, spustitelné soubory) |
| Nastavení + SQLite, logy, export logů, diagnostika | ✅ Pokryto testy a ověřeno spuštěním |
| Kontrola aktualizací | ⚠️ Vyžaduje zadat GitHub repozitář v Nastavení; jinak „Nedostupné“ |
| Demo režim (mapa, palubní počítač, hlášení, zpoždění, zastávky) | ✅ Vždy zřetelně označeno **DEMO** |

## Zdroje dat a jejich omezení

Aplikace používá výhradně **veřejné, neoficiální** endpointy, které jsem našel v komunitních projektech
(`@simrail-sdk/api-core-node`, repozitáře SimRail-SDK a další):

* `https://panel.simrail.eu:8084/servers-open`, `trains-open?serverCode=`, `stations-open?serverCode=`
* `https://api1.aws.simrail.eu:8082/api/getAllTimetables?serverCode=`, `getTime?serverCode=`

Důležité:

* Nejde o oficiálně dokumentované API a může se změnit nebo zmizet. Parser je tolerantní (velikost písmen, překlepy
  v názvech souřadnic) a při nesouladu ukáže chybu v diagnostice místo vymyšlených hodnot.
* **Skutečné odpovědi jsem neviděl** – testy používají vzorová data podle dokumentace SDK.
* „Hráči online“ jsou ve skutečnosti **vlaky řízené hráči** (typ `user`); celkový počet hráčů API neposkytuje.
* Jazyk serveru se bere jen z názvu (např. „EN1 (English)“), jinak „Nedostupné“.
* Směr jízdy na mapě je **odvozen z posunu polohy**; API směr neposkytuje.
* Aplikace se k API chová šetrně (mezipaměť 3–10 s, jízdní řády 5 min) a nepřipojuje se nikam mimo povolené domény.

### Předpoklady v palubním počítači (ověřte na živých datech)

1. `VDDelayedTimetableIndex` = index bodu jízdního řádu, ke kterému vlak právě míří / u kterého stojí.
2. `stopType = NoStopOver` znamená průjezd; ostatní hodnoty znamenají zastavení.
3. Čas serveru z getTime se čte z UTC polí epochy, která představují herní čas jízdního řádu. Další převod do Europe/Warsaw by přidal falešných 60/120 minut (oprava ověřena na živém CZ1 dne 25. 11. 2026).
4. Skutečné příjezdy API neposkytuje – **zpoždění se odvozuje z pozorovaného průjezdu bodů** a před prvním pozorováním je jen odhadem (označeno „odhad“).
5. Stanice mají souřadnice jen pokud jsou v `stations-open` (a názvem odpovídají bodu jízdního řádu). Bez souřadnic se hlášení „blížíme se“ a „příjezd“ **automaticky nespouštějí** a aplikace nabídne ruční režim.

Pokud některý předpoklad neplatí, zobrazí se „Nedostupné“ / upozornění, nikoli vymyšlená hodnota.

## České hlášení (Piper TTS)

* Výchozí řešení: **Piper** (offline, zdarma, bez API a předplatného). Binárka `piper_windows_amd64.zip` (vydání 2023.11.14-2, MIT)
  se stahuje z GitHubu a **ověřuje se kontrolním součtem SHA-256** (`f3c58906…efcea`), jinak se instalace přeruší.
* Hlas: `cs_CZ-jirka` (medium/low) z repozitáře `rhasspy/piper-voices`. Model card uvádí dataset `NabuCasa/voice-datasets`
  s licencí **CC0**. Model je ale **dolaďován z anglického hlasu „lessac“** – před komerčním použitím nebo redistribucí ověřte licenci základního modelu.
  Aplikace hlasy **nebalí**, stahuje je uživatel z Hugging Face (součet pro model neověřujeme, kontroluje se jen velikost a platnost konfigurace).
* Piper byl přesunut do nového repozitáře (`OHF-Voice/piper1-gpl`, GPL). Aplikace používá starší MIT vydání z `rhasspy/piper`.
* Polské texty se při Piperu čtou českým hlasem (špatná výslovnost). Pro polštinu použijte systémový hlas s polským jazykovým balíčkem; polský Piper model jsem neověřoval, proto není v katalogu.
* Správná výslovnost: zabudovaná česká exonyma (Katowice → Katovice, Kraków Główny → Krakov hlavní, …) + editor výslovnosti + mody se slovníky.
* Cache vygenerovaných hlášení (SQLite + WAV, limit 200 MB), fronta s prioritou a zahazováním zastaralých hlášení, ochrana proti duplicitám.

## Modifikace

U SimRailu jsem **nenašel ověřený a zdokumentovaný mechanismus modifikací**, proto správce modů **nikdy nezapisuje do složky hry**
a nespouští žádný kód. Spravuje rozšíření launcheru:

* `announcement-templates` – vlastní texty hlášení (`templates.json`)
* `pronunciation-dictionary` – slovník výslovnosti (`pronunciations.json`)

ZIP smí obsahovat jen `simrail-hub-mod.json` a jeden datový soubor (max. 1 MB). Kontroluje se manifest, typ, verze, kompatibilita
(`hubMin`/`hubMax`), bezpečnost cest (zip-slip), velikost a obsah. Typy určené pro složku hry jsou odmítnuty s vysvětlením.
Příklad manifestu je na stránce Modifikace.

## Struktura projektu

```
src/
  main/        hlavní proces Electronu (okna, IPC, kontext služeb)
  preload/     bezpečné API pro renderer (contextBridge, povolené kanály)
  renderer/    vstup aplikace (index.html, main.tsx, App.tsx)
  components/  TitleBar, Sidebar
  pages/       Home, Servers, Map, Dashboard, Mods, Settings
  stores/      Zustand (navigace, hra, servery, nastavení, demo, hlášení)
  hooks/       useAutoRefresh, useTrainFeed
  services/    SteamService, GameDetectionService, ServerService, TrainTrackingService (TelemetryService),
               StationDetection/onboard, AnnouncementEngine (announcements, queue), TextToSpeechService,
               ModManager, SettingsService, UpdateService, LogService, DemoSim
  adapters/    simrailApi, trainsApi (jediné místo, které zná tvar odpovědí API)
  types/       sdílené typy a IPC kontrakt
  styles/      Tailwind, motivy, Leaflet
tests/         81 testů (Vitest)
docs/          fotodokumentace (PDF + snímky obrazovky)
```

## Bezpečnost

`contextIsolation`, `sandbox`, vypnutý `nodeIntegration`, CSP, preload pouští jen výčet IPC kanálů, každý kanál kontroluje odesílatele a argumenty,
navigace a nová okna jsou blokována (externí odkazy jen `https` v systémovém prohlížeči), síť jen na povolené domény,
žádná oprávnění (kamera, mikrofon…). Data z API se do DOM vkládají přes `textContent`.

## Licence a atribuce

Projekt: MIT. Mapové podklady: © přispěvatelé OpenStreetMap (ODbL), © CARTO (tmavý podklad – ověřte podmínky použití pro vaše nasazení),
© OpenRailwayMap (CC-BY-SA). Dodržujte pravidla používání dlaždicových serverů (tile usage policy) a při větším provozu použijte vlastní/licencovaný zdroj.
Leaflet (BSD-2), Piper (MIT), fflate (MIT). Název „SimRail“ patří jeho vlastníkům.

## Dál

Nejbližší kroky po ověření na Windows: porovnat odpovědi živého API s parserem, ověřit předpoklady výše, ověřit Piper end-to-end,
zvážit podpis kódu a automatické aktualizace (electron-updater), polský hlasový model a překlad rozhraní.
