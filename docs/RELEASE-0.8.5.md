# SimRail Hub 0.8.5 · Tvůj hlas na 156 stanicích

## Vlastní nahrávky na dalších tratích
- 112 nových názvů stanic: celkem 156 namluvených stanic. Doplněn také Sędziszów a Warszawa Śródmieście.
- Jedna nahrávka se používá na všech osobních spojích, které v dané stanici zastavují podle PH / CommercialStop. Číslo vlaku ji neomezuje; nákladní vlaky zůstávají bez hlášení cestujícím.
- Kompletní nabídka zkoušek v Nastavení → Hlášení používá stejný seznam jako skutečné přehrávání.
- Vestavěná sada obsahuje 174 WAV včetně frází, obecných hlášení a zvuku vysílačky. Funguje i bez osobní složky nahrávek.

## Klidnější automatická hlášení
- Omluva se automaticky spustí až od 5 minut potvrzeného zpoždění; opakování nejdříve po 15 minutách. Při poklesu pod hranici se čekající omluva zruší.
- Zavazadla, volné uličky, ohleduplnost/sluchátka a pomoc se přehrávají postupně s odstupem alespoň 10 minut od konce předchozí doplňkové zprávy. Hlášení stanice mají přednost před doplňkovými zprávami.
- Obecné upozornění na vystupování u PH zastávky lze zapnout samostatně. Nenahrazuje přímou detekci stavu dveří.
- Při připojení k rozjetému vlaku se nepřehraje zpětně balík uvítacích zpráv. Kontrola jízdenek zůstává ruční.
- Zachována ochrana plánovaného pobytu při hlášení čekání na odjezd, včetně situace, kdy API předčasně posune index jízdního řádu.

## Dispečer a rádio
- Dodaný krátký zvuk vysílačky před zprávou i po ní, s vlastní hlasitostí.
- Volba četnosti Stručný / Běžný / Podrobný. Zprávy o přiblížení, zhoršení, přetrvávání a ověřeném uklidnění komplikace.
- Přiblížení se hlásí jen při doložené vzdálenosti po trase. Pulz na mapě zůstává do ověření uklidnění; výpadek dat se nevydává za vyřešenou situaci.
- Rádio Kiss zobrazuje interpreta a název skladby z oficiálního přehrávače. Neplatný nebo nedostupný údaj nahradí Živé vysílání. Po přepnutí stanice se starý název odstraní.
- Zachováno přehrávání rádia po zavření panelu a při minimalizaci launcheru.

## Jak aktualizovat
V nainstalovaném launcheru zvol **Vyhledat aktualizace**, nech balík stáhnout a potvrď **Restartovat a aktualizovat**. Portable verze se aktualizuje stažením nového EXE. Pro automatické hlášení zapni Nastavení → Hlášení → Automatická hlášení a Nahraná česká hlášení.

## Ověření a rozsah
262 automatických testů, typová kontrola a produkční sestavení. TEST portable sestavil přes nativní IPC hlášení všech 156 stanic na dvou různých číslech osobních vlaků (312 sestavení), ověřil hashe 174 WAV, zachování 121 originálů, nabídku zkoušek a QR mobilní displej. Rádio bylo ověřeno se skutečnou skladbou i při minimalizaci. Jde o kontrolu výběru zvuků a balíčku; ne o skutečnou jízdu všemi stanicemi. Přiblížení a příjezd nadále vyžadují platné souřadnice stanice.

Devět nahrávek pro potvrzené připravované DLC Lublin Region zůstává v zásobě mimo aktivní sadu i distribuovaný balík. Veřejný web se neobnovuje, MQTT ani větev NEXT nejsou potřeba a nepřibývá placená služba. Obrázek novinek je skutečný snímek EP08-001 ze SimRail Wiki.
