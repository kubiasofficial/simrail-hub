# Ověření vydání 0.6.0

- Kontrola typů a 167 automatických testů v 26 souborech: úspěšné.
- `verify-release060.mjs`: perzistence oblíbených/historie po obnovení, filtry mapy, rozložení nabídky filtrů, mobil 390 × 844 a 844 × 390 bez vodorovného přetékání, výchozí PH zastávky, volitelné technické body, odložený Leaflet, odlišené značky, stáří dat i při HTTP 200 a stav vypršeného QR. Výsledek `release060-ui.json`.
- Živá veřejná aplikace: skutečné jízdní řády, 69 stanic, EIP/regionální/TLK trasy po kolejích, načtené snímky a mapové podklady. `approved-a-live.json`.
- Veřejné a TEST sestavení mají odlišnou identitu, oddělené SQLite/profily a v TESTu vypnuté veřejné aktualizace. `test-channel-isolation.json`.
- Distribuční kontrola: nepřibalené soukromé zvuky a odstraněný cloudový kód; platný SHA-512 instalačního souboru v latest.yml; skutečný start portable a místní skládání nahrávek pro 35104 a 53103. `release060-distribution.json`.
- Delší kontrola: `audit-perf-release060-final.json` má `completed:true`, bez chyb a přes deset minut celkového běhu; obsahuje minimalizovanou část i závěrečný vzorek. První běh z terminálu skončil předčasně bez záznamu pádu; samostatně spuštěný opakovaný test doběhl. Netvrdíme 30minutový test ani prokázané snížení spotřeby proti staré verzi. Tento běh předcházel poslední čistě vizuální opravě rozbalení filtrů; ta byla následně ověřena v testu rozhraní.

Telefon byl simulován v prohlížeči. Fyzický mobil, skutečná instalace/odinstalace Windows a kompletní přechod již nainstalované uživatelské 0.5.0 na 0.6.0 nebyly automaticky provedeny. U aktualizací ověřujeme zdroj, dostupnost souborů a kontrolní součty; samovolnou instalaci při zavření nepovolujeme.
