# TEST 0.7.0 – dispečer a kompaktní palubní počítač

Tato změna je určena pro soukromý TEST, nikoliv pro automatické veřejné vydání. Veřejná verze 0.6.0 se v tomto úkolu nemění.

## Ovládání

- V palubním počítači je místo trvale rozepsaného jízdního řádu malá mapa. Tlačítko **Otevřít jízdní řád** otevře modal s plánem a odhady. Zavře se křížkem, Escape nebo kliknutím mimo něj; fokus se vrátí na ovládací tlačítko.
- V panelu **Dispečer** zapni **Sledovat provoz před vlakem**. Výchozí dosah je 5 km, volitelně 2 nebo 10 km. Nejdřív lze zkoušet jen text; **Hlasové zprávy** zapnou hlas s vysílačkou před i po zprávě. Funguje také u nákladních vlaků.
- Potvrzená informace se označí malým pulzem na malé i velké mapě. Animace respektuje vypnutí animací a systémové omezení pohybu.
- Hlas dispečera a vysílačka mají vlastní hlasitost a lze vyzkoušet samostatný zvuk vysílačky i celou zkušební zprávu nebo přehrávání zastavit.
- V Nastavení → Hlášení lze zapnout stejný gong na konci celé zprávy a nastavit hlasitost gongu nezávisle na hlasu. Dvojjazyčné hlášení má jen jednu úvodní a jednu závěrečnou znělku. Dřívější vypnutí gongu i úroveň hlasitosti se při migraci respektují.

## Vyhodnocování

Vzdálenost se počítá po dostupných propojených úsecích trasy; mezery se nepřemosťují přímkou. U dalšího vlaku se ověřuje jeho aktuální jízda a stejná dvojice navazujících bodů ve stejném pořadí. Samotná blízkost na mapě nestačí. Započítávají se hráči i AI, vyřazuje se vlastní vlak, vlaky za hráčem, jiný server, opačné pořadí trasy a nedostatečně známé jízdy.

Informace o pomalém vlaku vyžaduje nižší rychlost než u sledovaného vlaku. Zvýšený provoz vyžaduje alespoň tři pomalé vlaky v témže konkrétním úseku; staniční upozornění alespoň tři stojící kompatibilní jízdy u dané stanice. První upozornění vyžaduje 20 sekund a nejméně tři různé aktuální vzorky. Běžné opakování nejdříve po 5 minutách, podstatné zhoršení či nový problém nejdříve po minutě. Uvolnění se hlásí až po minutě potvrzených dat bez problému.

Zprávy vstupují do stejné fronty jako hlášení cestujícím, mají přednost před čekajícími automatickými hlášeními a nepřeruší rozehranou větu. Před hlasem se ověřuje platnost situace. Ztráta dat, změna sledování a vypnutí funkce zneplatní čekající informace. Chybějící data nikdy nevyvolají uklidňující zprávu o uvolnění provozu.

## Přesnost a omezení pilotu

Jde o informačního pomocníka, ne o řízení provozu. OSM a polohy API nezaručují přesnou kolej, obsazení bloků ani budoucí návěst. Souřadnice sousedních kolejí mohou být velmi blízko; ani shodný směrový úsek nezaručuje konflikt. Rozhodující zůstávají návěstidla a skutečný dispečer. Konzervativní filtry mohou skutečné zdržení neohlásit; při chybějící či neověřené trase funkce mlčí. Příliš velký počet neověřených okolních jízd vyhodnocení pozastaví.

Okolní trasy se načítají až při zapnutí dispečera, nejvýše tři současně. Nezavádí se nový placený backend, AI služba ani veřejné odesílání soukromých nahrávek. Zvuky vysílačky jsou původní, syntetizované místně.

## Ověření

- 184 automatických testů, kontrola typů a sestavení.
- `dispatcher-ui.json`: celý tok se zřetelně označenými řízenými daty, ověření pulzu obou map, dialogu, samostatných hlasitostí a pořadí zvuků; test syntézy hlasu je zde nahrazen krátkým PCM signálem.
- `dispatcher-live.json`: zabalený TEST se skutečným API a skutečnou českou syntézou Piper; skutečné WAV přehrání otevření vysílačky, zhruba dvanáctisekundové zprávy a ukončení při minimalizaci (záměrně ztlumené). Nejde o subjektivní poslech reproduktorů ani potvrzení úplnosti detekce zdržení ve hře.
- Nové jednotkové scénáře zahrnují protisměr, souběžnou trať, mezeru v trase, nezmapovanou jízdu, stáří dat, oddělené úseky, potvrzení situace, omezení opakování a neplatné zprávy ve frontě.

## Připravený TEST

Stávající soubor `C:\Users\PC\Desktop\simrail-hub\SimRail Hub TEST.exe` byl nahrazen finálním TESTem 0.7.0. Předchozí kandidát je zachovaný v ignorované složce `.deployment/old-test-candidates`. Ověřený skutečný start portable a shoda SHA-256 jsou v `verification/dispatcher-portable.json`; shoda zabaleného rendereru a IPC s finálním sestavením v `verification/dispatcher-distribution.json`. Vznikla jen místní větev `feature/dispatcher-test`, žádný nový veřejný tag ani vydání.

## Doplnění: trvalý pulz a nahrávky 35/53/45/54

Potvrzený pulz zůstává až do nejméně 60 sekund čerstvých dat potvrzujících uklidnění, poté půl sekundy dohasíná. Zpomalení vlastního vlaku, vypnutí hlasu ani změna dosahu incident neukončí. Výpadek dat či zmizení sledovaného vlaku z dostupných dat ponechá poslední polohu šedě jako neověřenou; nevyvolá hlášení o uvolnění. Přerušení ověřování restartuje minutové potvrzení. Změna sledovaného vlaku/serveru nebo vypnutí dispečera stav vyčistí.

Střed pulzu otevře aktuální popis myší, fokusem klávesnice nebo klepnutím. Escape a kliknutí do mapy popis zavřou. Obsah zahrnuje typ komplikace, popis, počet vlaků, úsek, vzdálenost s rozlišením výpočtu po trase / vzdušnou čarou a stáří posledního ověření. Okolní vlny neblokují ovládání mapy. Ověřuje se jeden potvrzený incident; další se vyhledá po jeho uzavření. Pokud původní jízda zmizí z pokrytí, může zůstat neověřená až do návratu dat nebo změny sledování.

Původní nahrávky fungují také pro čtyřmístné 35xx/53xx a skupiny 45xx/54xx/45xxx/54xxx. Pro 45/54 je připraveno devět volitelných názvů níže. Chybějící soubor dovolí syntetický hlas a neblokuje původních 11 souborů. Používají se jen skutečné zastávky PH; tabulka je sjednocení zastávek na současném řiditelném úseku podle CZ1, ověřené 26. 11. 2026, ne příslib stejných zastávek každého vlaku.

| Soubor | Samostatně namluvit |
| --- | --- |
| katowice.wav | Katowice |
| sosnowiec_glowny.wav | Sosnowiec Główny |
| zawiercie.wav | Zawiercie |
| lask.wav | Łask |
| pabianice.wav | Pabianice |
| lodz_kaliska.wav | Łódź Kaliska |
| lodz_zabieniec.wav | Łódź Żabieniec |
| zgierz.wav | Zgierz |
| lowicz_glowny.wav | Łowicz Główny |

Nahrávat pouze název bez gongu a úvodní věty. Aplikace připojí existující „Příští stanice“, „Přijíždíme do stanice“ nebo „Stanice“. WAV musí být PCM mono 48 kHz / 16 bit; jiné vstupní nahrávky lze převést místně, originály zachovat. Žádné soukromé zvuky se do sestavení nepřidávají.
