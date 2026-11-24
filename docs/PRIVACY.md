# Soukromí a místní data – pracovní větev 0.5.0

Launcher nenabízí registraci, přihlášení ani synchronizaci osobního účtu.
Nastavení a slovník výslovnosti ukládá existující SQLite v uživatelské složce aplikace. Oblíbené servery a poslední výběr používají dosavadní lokální úložiště rendereru. Doplňky, stažené hlasy a soukromé nahrávky zůstávají na počítači. Odinstalace zachovává místní aplikační data.

Živá data získává hlavní proces ze SimRail API. Veřejné avatary se načítají ze Steamu, mapové dlaždice z OpenStreetMap a případně OpenRailwayMap, snímky z oficiálních zdrojů hry a informace o DLC ze Steamu. Aktualizace pocházejí z GitHub Releases. Tito poskytovatelé dostávají běžné síťové požadavky. Mapová ani herní data se nekopírují do Firebase.

Hlas Piper běží místně. Hlasový model a program je potřeba nejprve stáhnout; kontrolují se připnuté SHA-256. České a polské segmenty vybírají model příslušného jazyka. Soukromé nahrávky nejsou v instalačním balíčku.

Mobilní displej otevře dočasný HTTP server na privátní síti počítače. QR obsahuje náhodný přístupový token platný nejvýše 12 hodin. Token nesdílejte; kdo ho získá na stejné síti, může displej otevřít. Cookie je HttpOnly a SameSite=Lax. Lokální HTTP není šifrované a nemůže použít Secure cookie. Používejte důvěryhodnou soukromou síť, nepřesměrovávejte port z internetu. Ukončení sdílení, změna párování a uspání počítače relaci zneplatní.

Dřívější účty a vzdálená nastavení aplikace automaticky nemaže. Postup pro jejich kontrolovaný export či odstranění je v [migračním plánu](CLOUD-MIGRATION.md). V této pracovní větvi není nástroj pro mazání vzdálených dat.

Launcher nepřidává reklamní sledování ani analytiku. Diagnostický export logu je ruční; log rediguje QR parametry, bearer tokeny a párovací cookie. Před sdílením log zkontrolujte – chyby místních souborů mohou obsahovat cestu ve vašem počítači.
