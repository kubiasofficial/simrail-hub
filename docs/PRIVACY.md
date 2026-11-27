# Soukromí a místní data – verze 0.8.3

Launcher nenabízí registraci, přihlášení ani synchronizaci osobního účtu.
Nastavení a slovník výslovnosti ukládá existující SQLite v uživatelské složce aplikace. Oblíbené servery, vlaky, poslední výběr a historie sledování používají lokální úložiště rendereru. Historie uchovává nejvýše 100 sledování a 256 pozorovaných PH průjezdů na sledování; neukládá Steam identitu ani přesnou historii polohy. Lze ji vymazat na stránce Historie a oblíbené. Doplňky, stažené hlasy a soukromé nahrávky zůstávají na počítači. Odinstalace zachovává místní aplikační data.

Živá data získává hlavní proces ze SimRail API. Veřejné avatary se načítají ze Steamu, mapové dlaždice z OpenStreetMap a případně OpenRailwayMap, snímky z oficiálních zdrojů hry a informace o DLC ze Steamu. Aktualizace pocházejí z GitHub Releases. Tito poskytovatelé dostávají běžné síťové požadavky. Mapová ani herní data se nekopírují do Firebase.

Internetové rádio se připojí k poskytovateli audio streamu po ručním spuštění. Poskytovatel dostává běžný síťový požadavek včetně IP adresy. Předvolby, vlastní adresy streamů a hlasitost se ukládají místně. Plán směny a jeho průběh se uchovávají lokálně. Veřejná verze umožňuje po výslovném potvrzení oznámit převzetí/ukončení vlaku a sdílenou směnu na společný Discord. Zveřejňuje zadanou přezdívku, číslo a trasu vlaku, automaticky určenou stanici nebo úsek (případně souřadnice vlaku ze hry), časy evidence a dostupný odhad zpoždění. Přezdívka není ověřeným účtem Steamu. Samotné sledování vlaku nic neodesílá. Společný webhook je uložen pouze na serveru Cloudflare Workers.

Před prvním odesláním proběhne jednorázové ověření přes Cloudflare Turnstile. Náhodné ID zařízení a časově omezené přístupové údaje slouží k omezení spamu; přístupový token je na počítači šifrován prostředky Windows. Na serveru se uchovává otisk tokenu a token platí 30 dnů. Odesílací služba uchovává ID a otisky událostí, stav doručení a časy nejvýše přibližně 15 dnů; vlastní text oznámení se do serverové databáze neukládá. IP adresa slouží k omezení četnosti; databáze uchovává jen její HMAC otisk a omezené čítače. Cloudflare a Discord dostávají běžné síťové požadavky. Veřejně odeslané zprávy zůstávají na Discordu podle pravidel daného serveru.

Hlas Piper běží místně. Hlasový model a program je potřeba nejprve stáhnout; kontrolují se připnuté SHA-256. České a polské segmenty vybírají model příslušného jazyka. Se souhlasem autora je součástí instalačního balíčku a veřejného repozitáře 61 hotových WAV hlášení. Původní záznamy M4A ani další soukromé nahrávky se nezveřejňují. Vlastní složka uživatele se nikam neodesílá.

Mobilní displej otevře dočasný HTTP server na privátní síti počítače. QR obsahuje náhodný přístupový token platný nejvýše 12 hodin. Token nesdílejte; kdo ho získá na stejné síti, může displej otevřít. Cookie je HttpOnly a SameSite=Lax. Lokální HTTP není šifrované a nemůže použít Secure cookie. Používejte důvěryhodnou soukromou síť, nepřesměrovávejte port z internetu. Ukončení sdílení, změna párování a uspání počítače relaci zneplatní.

Dřívější účty a vzdálená nastavení aplikace automaticky nemaže. Postup pro jejich kontrolovaný export či odstranění je v [migračním plánu](CLOUD-MIGRATION.md). V této verzi není nástroj pro mazání vzdálených dat.

Launcher nepřidává reklamní sledování ani analytiku. Diagnostický export logu je ruční; log rediguje QR parametry, bearer tokeny a párovací cookie. Před sdílením log zkontrolujte – chyby místních souborů mohou obsahovat cestu ve vašem počítači.
