# TEST rádia, dispečera a automatických hlášení

Rádio, dispečer a automatická hlášení – TEST 28. 11. 2026

Spouštěj SimRail Hub TEST.exe v této složce. Veřejná verze 0.8.4 se tímto nemění.

Rádio Kiss: v displeji je interpret a název skladby z oficiálního přehrávače. Při reklamě, chybě nebo chybějících metadatech se ukáže Živé vysílání. Vlastní stanice bez podporovaného zdroje metadat mají jen název rádia. Zavřením panelu ani minimalizací se hudba nevypíná.

Omluva za zpoždění: automaticky až od 5 minut potvrzeného zpoždění; opakování nejdříve po 15 minutách. Při poklesu pod 5 minut se čekající omluva zahodí. Ruční tlačítko zůstává pro ruční spuštění.

Dispečer: tvůj nový zvuk vysílačky před zprávou i po ní, samostatná hlasitost. Volba Stručný / Běžný / Podrobný. Zprávy o přiblížení, zhoršení, přetrvávání a ověřeném uklidnění. Stručný připomíná po 10 minutách, ostatní nejdříve po 5 minutách. Přiblížení jen z doložené vzdálenosti po trase. Pulz na mapě zůstává do ověřeného uklidnění; výpadek dat jej označí jako neověřený.

Nastavení → Hlášení: zapni Automatická hlášení a Vlastní nahrávky. Lze samostatně ovládat uvítání, zavazadla a uličky, informace během cesty, vystupování/dveře, čekání a Vánoce.
Po uvítání jsou zavazadla, uličky, ohleduplnost/sluchátka a pomoc rozložené do jízdy s odstupem alespoň 10 minut od konce předchozí doplňkové zprávy. Vystupování je obecné upozornění u PH, nikoli detekce skutečného zavření dveří. Hlášení stanice dostává přednost před doplňkovým hlášením. Připojení k rozjetému vlaku nespustí zpětně uvítání ani balík zpráv; první informace nejdříve po 10 minutách sledování.
Čekání a Nevystupujte: po 5 minutách souvisle doloženého stání před návěstí Stůj, mimo plánovaný pobyt. Nevystupujte pouze mimo potvrzené nástupiště. Kontrola jízdenek zůstává ruční. Nákladní vlaky nemají hlášení pro cestující.

Stanice-k-namluveni.txt: seznam podle aktuálního API, pouze PH se skutečným pointId a tratí. 44 stanic je pokrytých; 160 zatím chybí. Namluvit jen název stanice. Jedna nahrávka platí pro všechny osobní spoje, které tam zastavují.

Ověřeno: 259 testů, typecheck, build; skutečné EXE v izolovaném profilu, 62 WAV kontrolovaných SHA256; přehrání nového zvuku před/po; skutečné skladby Kiss; přepínání stanic bez starého názvu; rádio při minimalizaci; QR a mobilní payload. Dlouhou jízdu ve hře a skutečný telefon je ještě potřeba vyzkoušet.
