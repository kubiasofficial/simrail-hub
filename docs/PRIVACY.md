# Účet a soukromí

Účet je volitelný; mapa, hlášení, spuštění hry i mobilní QR fungují bez něj. Účet využívá Firebase Authentication (e-mail/heslo). Heslo ověřuje Firebase; aplikace ho nepersistuje ani nezapisuje do logů. Relace zůstává v paměti hlavního procesu do zavření aplikace.

Na výslovné stisknutí „Uložit do cloudu“ se do soukromého dokumentu Firestore uloží motiv, jazyk, interval obnovy, výchozí server, nastavení mapy a hlasu. „Načíst z cloudu“ je přenese do druhého počítače a přepíše zde tyto předvolby. Cesta k instalaci hry, Steam přihlašovací údaje, místní soubory a stažené hlasy se nesynchronizují.

Firestore pravidla zpřístupňují nastavení pouze přihlášenému vlastníkovi. Odhlášení zahodí relaci, nikoliv účet. Účet i cloudové nastavení lze smazat v Nastavení → Účet. Pokud Firebase požaduje nové přihlášení pro smazání, nejprve se odhlaste a přihlaste znovu. Místní nastavení zůstává v počítači.

Poskytovatel cloudu: Google Firebase. [Zpracování dat a soukromí Firebase](https://firebase.google.com/support/privacy). Provozní služby mohou ukládat své standardní provozní záznamy. Launcher nepřidává analytiku ani reklamní sledování. Živá data vlaků pocházejí ze SimRail API; avatary a veřejné snímky se načítají ze Steamu a SimRail Wiki. Jejich provozovatelé při načítání dostávají běžné síťové požadavky.

Dotazy ke komunitnímu projektu a žádosti o pomoc: [GitHub Issues](https://github.com/kubiasofficial/simrail-hub/issues). Do veřejných hlášení nevkládejte hesla, přístupové tokeny ani své soukromé nastavení.
