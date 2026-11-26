# Výraznější palubní displej – TEST 0.7.0

Změna je určena pro soukromý TEST. Veřejná verze se nemění, osobní nahrávky se nepřesouvají ani nebalí do instalace.

## Zobrazení

Pravý panel zvýrazňuje následující zastávku větším písmem a vzdáleností s označením „vzdušně“. Vedle stanice jsou příjezd a odjezd; na užší šířce se přesunou pod název. Fotografie vozidla zůstává ve stejné velikosti.

Aktuální stav má krátký nadpis STOJÍ, NA TRATI, VE STANICI nebo ČEKÁM NA DATA a drobné vysvětlení. Svislá spojnice zvýrazní skutečně potvrzenou aktuální stanici nebo následující zastávku, její značka se posouvá plynule mezi řádky. Nejde o procentní průběh ujeté trasy. Při jízdě do vzdálenosti 1 km vzdušně k následující zastávce se decentně rozsvítí okraj panelu.

Rychlost používá větší tabulkové číslice s rezervou pro tři číslice. Změny hodnot a názvu stanice se krátce prolnou. Zpoždění má neutrální stav před potvrzeným průjezdem, zelený pozorovaný odhad včas, jantarovou hodnotu menšího zpoždění a červenou hodnotu nad 20 minut. Při zhoršení pozorovaného zpoždění se krátce zvýrazní okraj, kritický stav má pomalý pulz. Vypnuté animace, systémové omezení pohybu a minimalizace se respektují.

## Význam časů

Časy patří následující PH zastávce, nikoliv nejbližšímu technickému bodu či dřívější stejnojmenné stanici. Při potvrzeném stání se použije až následující PH. Na konečné se budoucí časy odstraní.

Bez pozorovaného průjezdu se zobrazují pouze plánované časy a neutrální „Zatím neurčeno“. Předběžná dolní mez zpoždění, pokud existuje, je jen vysvětlující text bez zelené/červené jistoty. Při aktuálních datech a pozorovaném průjezdu se odhad vypočítá z příslušného plánu a pozorované minutové odchylky; původní plán zůstává pod hodnotou. Nejde o skutečný příjezd, který by dodalo API.

Chybějící příjezd či odjezd je `—`; jeden údaj se nedoplňuje druhým. Časy se správně převádějí přes půlnoc a případný posun dne se označí. U předčasné jízdy lze ukázat dřívější příjezd, odjezd pro cestující se však neodhaduje před plánovaným odjezdem. Při zastaralých nebo ztracených datech se živé odhady a stavové barvy zruší, plán může zůstat viditelný jako plán.

Změna je prezentační: výpočet indexu jízdy, DelayTracker, automatické hlasové události, dispečer a jízdní řád se nepřepisují.

## Ověření

194 automatických testů, kontrola typů a sestavení. Doplněné testy ověřují správnou PH, opakované názvy, chybějící údaje, zastaralá data, půlnoc, předčasný příjezd a nejbližší následující zastávku při stání.

`verification/journey-display-ui.json` používá záměrně řízenou telemetrii pro ověření plánu 09:42/09:43, pozorovaného zpoždění +25 minut a obou odhadovaných časů, skutečné červené barvy, rozložení vpravo, velikosti písma, přiblížení ke stanici, zvýraznění zhoršení, příchodu do konečné, neutrálního stavu při výpadku, úzkého okna, minimalizace a omezení pohybu. Souřadnice a jízdní řád této zkoušky nereprezentují skutečnou jízdu.
