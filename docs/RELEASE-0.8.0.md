# SimRail Hub 0.8.0 — Tvoje jízda. Tvoje rádio.

![SimRail Hub 0.8.0](https://github.com/kubiasofficial/simrail-hub/releases/download/v0.8.0/SimRail-Hub-0.8.0-banner.png)

Rádio do kabiny, vlastní plán směny a přepracované rozhraní. Nová verze je připravená na další jízdu.

## Co je nového

- **Internetové rádio v palubním počítači.** První předvolbou je Rádio Kiss. Přidáš si další přímé HTTPS streamy, přepínáš stanice a hlasitost nastavíš otočným ovladačem, kolečkem nebo klávesnicí. Zavření panelu ani minimalizace přehrávání nezastaví. Po novém spuštění se rádio samo nezapíná.
- **Hlášení mají přednost.** Rádio se může během hlášení, gongů a zpráv dispečera plynule ztišit nebo umlčet; po dohrání se hlasitost vrátí. Kdo chce, ponechá hlasitost beze změny.
- **Režim Směna BETA.** Zvol osobní nebo nákladní dopravu, vlastněná DLC, výchozí místo, přestávku a čas konce. Plán vychází z dostupných jízdních řádů a uvádí čísla vlaků i časy převzetí. Návaznost je návrh: launcher nerezervuje vlaky a dostupnost se může během hry změnit.
- **Nové rozhraní.** Přepracovaná hlavní stránka, navigace, serverové dlaždice, palubní počítač a nastavení v jednotném železničním stylu. Výrazná následující zastávka, příjezd/odjezd, mapa kolem vlaku a jízdní řád na vyžádání.
- **Varšava a automatická hlášení.** Doplněné záložní souřadnice Warszawa Wschodnia, Centralna a Zachodnia pomáhají při chybějících API souřadnicích. Uvítání, zavazadla a čekání na odjezd mají samostatná pravidla; oznámení se nepouští hromadně jen kvůli změně sledovaného vlaku. Vyhodnocení závisí na dostupnosti čerstvých dat a PH zastávkách.
- **Vlastní nahrávky.** Podpora staničních klipů pro 16xx / 61xx i 16xxx / 61xxx doplňuje dosavadní skupiny. Soukromé hlasové soubory nejsou součástí veřejného balíčku.
- **Novinky přímo v launcheru.** Po aktualizaci se jednou zobrazí nové obrázkové okno; z Domů ho můžeš otevřít znovu.

## Jak aktualizovat

**Instalační verze:** v launcheru vyhledej aktualizace, nech verzi stáhnout a zvol **Restartovat a aktualizovat**. Nemusíš ručně stahovat nový instalátor z webu.

**Portable:** stáhni nový portable soubor z tohoto vydání. Pro budoucí aktualizace uvnitř launcheru lze přejít na instalační verzi.

Nastavení i soukromé nahrávky zůstávají uložené. Aplikace je zdarma, nevyžaduje novou placenou službu.

Sdílení evidence řízení a směn na společný Discord zůstává v místním TEST kanálu. Soukromý webhook není distribuován ve veřejné aplikaci. MQTT do tohoto vydání nepatří.

## Ověření a grafika

219 automatických testů, TypeScript, sestavení a ověření distribučních souborů. Ověřené skutečné AAC přehrávání Kiss při minimalizaci a chování obrázkového okna aktualizace.

Banner vznikl pomocí vestavěného imagegen s předlohou skutečného herního snímku Dragon 2 E6ACTa-016 ze [SimRail Wiki](https://wiki.simrail.eu/en/Vehicles/Poland/Trains/Electric-locomotive/E6ACTa). Jde o upravenou propagační grafiku, ne nový neupravený snímek ze hry. Zadání grafiky je v `docs/RELEASE-0.8.0-BANNER-PROMPT.txt`.

Neoficiální komunitní projekt, není spojen s vývojářem hry SimRail.
