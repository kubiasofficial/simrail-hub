# SimRail Hub 0.8.4 · Tvoje jízda. I v telefonu.

## Mobilní palubní displej
- Přehled aktuální a následující stanice, časy příjezdu a odjezdu, výrazné zpoždění a viditelná verze launcheru. Výpočty časů a zpoždění jsou společné s desktopem.
- Rozdílně nastavené hodiny telefonu a počítače už nevytvářejí falešné „Zastaralá data“. Stáří určuje hostitel a telefon ho dál měří monotónně.
- Obnova po odemčení, návratu do prohlížeče a obnovení sítě. Zastaralá odpověď nepřepíše novější data. Nové tlačítko Obnovit připojení.
- Přehledný režim na výšku, naležato i na úzké obrazovce. Stanice na mapě jsou malé čtverce; vlak má barevnou ikonu a směr pohybu.

## Hlášení Katowic a Sosnowiece
- Pro osobní hlášení a trasové zastávky Sosnowiec Główny a Sosnowiec Południowy používáme ověřené body nástupišť OSM. Živé dispečerské značky z API se nemění.
- Stání na PH se rozpozná i tehdy, když API posune index jízdního řádu před odjezdem z nástupiště. Vzdálenost k aktuální zastávce se neplete s následujícím bodem.
- Správný výběr nahrávek Katowice a obou nádraží Sosnowiec, zachování pravidla PH, potlačení duplicit a ticho v nákladní dopravě. Není potřeba nahrávat tyto názvy znovu.

## Jak aktualizovat
V launcheru zvol **Vyhledat aktualizace**, nech aktualizaci stáhnout a potvrď instalaci s restartem. Potom zavři starou mobilní záložku a vytvoř nový QR kód v aktualizovaném launcheru. Telefon i počítač musí být na stejné místní síti.

## Ověření
251 automatických testů, typová kontrola a sestavení. Prohlížečové ověření zahrnuje hodiny telefonu posunuté o 18 hodin, výpadek sítě, simulované zamknutí/odemknutí, opožděné odpovědi a obrazovky 320/390/844 px. Příjezdy všech tří stanic jsou testované v obou směrech. Jde o řízené simulace; fyzický telefon a skutečná jízda mohou odhalit další odlišnosti.

Sada 61 schválených WAV zůstává vestavěná. Nevracíme veřejný web, nevyžadujeme MQTT ani větev NEXT a nepřidáváme placenou službu. Obrázek vydání používá existující skutečný snímek 36WEd-001 ze SimRail Wiki.
