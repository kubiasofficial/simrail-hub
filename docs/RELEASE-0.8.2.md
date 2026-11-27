# SimRail Hub 0.8.2 — Začátek řízení automaticky

![EP08 ze SimRailu](https://github.com/kubiasofficial/simrail-hub/releases/download/v0.8.2/SimRail-Hub-0.8.2-banner.png)

Při potvrzení **Převzít vlak** už nemusíš ručně psát začátek řízení. Zadáš přezdívku a místo určí launcher z čerstvých dat vybraného vlaku.

- Stojící vlak v blízkosti známé stanice: uvede se stanice.
- Jedoucí vlak poblíž stanice: uvede se její blízkost, ne potvrzené zastavení.
- Na trati: úsek mezi sousedními body jízdního řádu, s označením zdroje určení.
- Bez známého úseku: dostupné souřadnice vlaku ze hry. Při starých nebo chybějících datech se výslovně uvede nedostupná poloha.

Náhled v okně se při potvrzení znovu vyhodnotí v hlavním procesu. Odeslaný začátek tak není závislý na tom, kde vlak stál při otevření okna. Staré ručně odeslané místo klienta se při novém převzetí nepřebírá. Určení funguje také pro nákladní vlak bez osobních PH zastávek. Blízkost stanice se vyhodnocuje orientačně do 300 metrů; nejde o potvrzení konkrétního nástupiště.

Discord nadále vyžaduje tvé potvrzení. Nejde o skutečné převzetí ani ovládání vlaku ve hře. Dříve uložené jízdy a jejich původní začátky se nepřepisují. Pole místa ukončení je zatím zachováno.

Instalační verze nabídne aktualizaci uvnitř launcheru. Portable vyžaduje nový soubor. Nahrávky a nastavení se nemažou. Tato změna využívá stávající API, nikoli MQTT nebo větev NEXT.

Ověřeno 234 testy a skutečným IPC v izolovaném launcheru. Kontrola simulovala posun vlaku během otevřeného okna, ignorování starého ručního pole i správné Discord údaje; požadavky na Discord byly zachycené, žádná smyšlená jízda nebyla skutečně odeslána.

Grafika je existující skutečný snímek EP08-001 ze SimRail Wiki, bez generování nebo úprav obrázku. Neoficiální komunitní projekt.
