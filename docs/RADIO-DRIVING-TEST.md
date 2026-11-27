# Rádio a evidence jízd – TEST

Tato změna patří pouze do místní testovací větve. Veřejná verze 0.7.0 se tímto nevydává ani nepřepisuje.

## Rádio

V Palubním počítači vedle „Otevřít na mobilu“ otevři **Rádio**. Přehrávání spustíš ručně. První předvolba je Rádio Kiss, stream odkazuje na zdroj oficiálního přehrávače https://www.kiss.cz/online/.

- Hlasitost měníš tažením, kolečkem nad knoflíkem nebo šipkami po jeho označení klávesou Tab. Tlačítko Ztlumit zachová nastavenou úroveň.
- Ve Správě stanic lze přidat další přímé HTTPS audio streamy MP3/AAC. Odkaz na stránku stanice nestačí. Kiss zůstává první předvolbou, celkem lze uložit 12 stanic.
- Při hlášení zvol plynulé ztišení, úplné umlčení nebo ponechání hlasitosti. Přednost hlášení zahrnuje úvodní i závěrečný gong a dispečera. Potom se vrátí původní hlasitost.
- Zavření panelu, změna záložky ani minimalizace přehrávání nezastaví. K zastavení slouží Pozastavit nebo Vypnout rádio. Po restartu se samo nespouští; předvolby a hlasitost se uchovají.
- Při výpadku proběhnou nejvýše tři pokusy o opětovné spojení. Nedostupný stream se zobrazí jako chyba. Animované sloupky jsou dekorace, nejde o měření zvuku.

## Řídit

Vyber živý vlak a klikni **Řídit**. Uveď vlastní přezdívku jako na Steamu a místo skutečného převzetí. Odeslání vždy potvrď. Přezdívka je vlastní prohlášení, launcher neověřuje účet Steamu a tímto tlačítkem se vlak ve hře nepřebírá.

Na Discord odchází přezdívka, číslo, server, trasa, místo a čas začátku. Pokud poloha potvrzuje aktuální PH zastávku, místo je tak označeno; jinak zpráva uvede ruční zadání. Při ukončení doplň skutečné místo a případnou poznámku. Zpráva připojí dobu evidence a čerstvý dostupný odhad zpoždění. Neznámé zpoždění se nevymýšlí.

Pouhé sledování, změna záložky ani zavření rádia nezahajují a neukončují evidenci. Přestat sledovat při aktivním řízení nejprve nabídne jeho ukončení. Po restartu lze rozpracovaný záznam obnovit nebo ukončit; začátek se znovu neposílá. Doba evidence není měřením nepřerušené jízdy.

## Směna a doručení

V záložce Směna lze samostatně potvrdit **Oznámit zahájení směny**. Launcher následně oznamuje pozorované cílové PH příjezdy, přestávku a její konec. Neoznamuje zpětně příjezdy z doby před zapnutím sdílení. Konec směny potvrzuješ ručně. Nedokončená směna je v souhrnu označena jako ukončená, nikoli dokončená. Samostatná zpráva o převzetí vlaku vyžaduje tlačítko Řídit.

Události se ukládají před odesláním do místní databáze. Stav doručení ukáže frontu, potvrzené doručení nebo chybu. HTTP 429 má omezené opakování. Při nejasném výsledku po výpadku spojení nebo restartu se neposílá naslepo podruhé; uživatel nejprve ověří Discord a potvrdí opakování. Zmínky uživatelů/rolí jsou ve zprávách vypnuté.

## Místní nastavení webhooku

Webhook se načítá jen v kanálu TEST, z textového souboru `Desktop/simrail-hub/.local-config/driving-webhook.secret`. V ukázkových datech je vypnutý. Hodnota se neposílá do rendereru ani cloudu, není v Git repozitáři, balíčku nebo veřejné aktualizaci. Odesílání nevyžaduje placenou službu. Pro veřejné sdílení této funkce bude potřeba samostatně navrhnout příjem událostí, aby společný webhook nebyl distribuován všem klientům.

## Ověření

- 219 automatických testů v 35 souborech; TypeScript a produkční build.
- Skutečné přehrávání oficiálního AAC streamu Kiss a pokračování při minimalizaci (neslyšitelný test).
- Průchod rádiem: hlasitost klávesnicí/kolečkem, druhá stanice, přepnutí, změna záložky, minimalizace, ztišení při gongu a návrat hlasitosti, restart bez automatického spuštění.
- Průchod explicitním zahájením/ukončením řízení a směny s izolovaným transportem. Žádné smyšlené převzetí nebylo odesláno na skutečný Discord.
- Jedna samostatná zpráva „TEST připojení · SimRail Hub“ byla doručena na zadaný webhook. Není záznamem jízdy.
- Doklady jsou v `docs/verification/radio-*.json`. Soukromé potvrzení Discord zprávy zůstává v ignorované `.deployment/`.

Výsledný přenosný TEST byl navíc skutečně spuštěn s odděleným profilem: přítomna obě tlačítka, webhook nakonfigurovaný pouze v hlavním procesu, zavření dialogu Escape i kliknutím mimo, rádio bez autoplay. Kontrola 141 souborů balíčku přesně odpovídá aktuálnímu buildu. SHA-256: `8d0221c335b9b55116bdf0b3859ac601d568b8dc0cf4b399e612c1f446d0ad93`.
