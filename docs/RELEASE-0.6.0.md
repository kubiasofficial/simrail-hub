# SimRail Hub 0.6.0

## Novinky

- Mobilní displej se třemi záložkami: Přehled, Jízdní řád a Mapa. Velká další zastávka, rychlost a rozlišení odhadu/pozorovaného zpoždění, rozložení na výšku i na šířku. Ve výchozím jízdním řádu pouze PH zastávky; průjezdy lze zapnout.
- Mobilní mapa se načítá až při otevření, používá opakovaně stejné značky, nabízí sledování a návrat na vlak i dostupnou trasu po kolejích. Při výpadku zůstávají poslední údaje označené stářím. Hlášení dál přehrává počítač.
- Kruhové značky vlaků barevně podle skutečně rozpoznané kategorie a odlišné čtvercové značky stanic s budovou. Směr pohybu, veřejné Steam avatary a vyznačení dostupného herního úseku trasy po kolejích OSM.
- Filtry kategorie, hráč/AI, výchozí a cílové stanice. Oblíbené vlaky podle serveru a čísla, filtr oblíbených serverů.
- Místní historie sledovaných jízd a pozorovaných PH průjezdů. Nejvýše 100 sledování; lze ji vymazat. Nejde o statistiku celé odehrané jízdy.
- Vlastní staniční nahrávky také pro osobní vlaky 35xxx. Pořadí i zastavení bere každý spoj ze svého jízdního řádu; žádný pevně obrácený seznam. Chybějící nahrávku nahradí syntetický hlas. Soukromé zvukové soubory nejsou součástí veřejného balíčku.
- Ruční zadání čísla vlaku a tlačítko Přestat sledovat; ukončí i sdílený mobilní displej a vyčistí samostatné okno.

## Opravy od veřejné 0.5.0

- Opravené zavírání a ovládání výběru jazyka.
- Obnovené načítání velkých jízdních řádů a správné zpracování času API. Odstraněné falešné hodinové zpoždění. Před prvním průjezdem se ukazuje pouze předběžný dolní odhad, pozorovaná hodnota až po průjezdu. Neaktuální data jsou označená.
- Zpoždění vyvolává automatickou omluvu pouze z pozorované hodnoty, další nejdříve za 15 minut. Hlášení se nepřekrývají a mají rozestup. Nákladní vlaky nehlásí; osobní označení TLK se za nákladní nepovažuje.
- Pokračování dat a hlášení při minimalizaci, omezení skrytých vizuálních aktualizací a sdílení síťových požadavků.
- Soukromý TEST má vlastní profil a neinstaluje veřejné aktualizace. Veřejný launcher dál dostává aktualizace přes GitHub Releases; restart s instalací spouští uživatel.
- Bez registrace a cloudové synchronizace: data aplikace zůstávají místní. Existující vzdálené účty tato aktualizace nemaže. Firebase slouží pouze bezplatné veřejné stránce.

## Dostupnost a omezení

Trasy pokrývají známé souřadnice na dostupném herním úseku; jde o orientační odvození po kolejích OSM, nikoli garantovanou konkrétní kolej. Nepropojené části se nedokreslují přímkou. Zpoždění není přímý oficiální údaj API. Mobil a počítač potřebují stejnou důvěryhodnou místní síť a spuštěný launcher. Na telefonu se zvuk nepřehrává. Testy mobilu proběhly v prohlížeči s mobilním rozlišením; nenahrazují kontrolu fyzického telefonu.
