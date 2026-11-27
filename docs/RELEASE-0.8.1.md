# SimRail Hub 0.8.1 — Převzít vlak je zpět

![SimRail Hub 0.8.1](https://github.com/kubiasofficial/simrail-hub/releases/download/v0.8.1/SimRail-Hub-0.8.1-banner.png)

Oprava chybějícího tlačítka **Převzít vlak** ve veřejné verzi. Oznámení jízdy a směny nyní mohou na společný Discord odesílat všichni uživatelé launcheru.

1. V palubním počítači vyber živý vlak a klikni **Převzít vlak**.
2. Při prvním použití zvol **Ověřit připojení** a dokonči jednorázové ověření v prohlížeči. Nepřihlašuješ účet Steamu ani Discordu. Vrať se do launcheru; stav se načte automaticky.
3. Zadej přezdívku jako na Steamu a skutečné místo převzetí. Potvrď odeslání na společný Discord.
4. Po jízdě zvol **Ukončit řízení**, doplň místo a potvrď zprávu o ukončení.

Tlačítko je evidence, nepřebírá ani neovládá vlak ve hře. Převzetí ve hře provádíš ručně. Přezdívka není ověřenou identitou Steamu. Samotné sledování nic nezveřejňuje.

Ve Směně lze samostatně potvrdit její sdílení na komunitním Discordu. Zprávy zahrnují začátek, pozorované dojezdy, přestávky a ručně potvrzený konec. Stav doručení ukazuje potvrzení nebo problém; nejasné zprávy se automaticky neposílají znovu.

Společný webhook zůstává na serveru, není v instalátoru ani zdrojovém kódu. Zařízení se jednorázově ověřuje a přístupové údaje jsou na počítači šifrované. Služba má omezení četnosti a ochranu proti duplicitám; při dosažení limitu může odesílání dočasně počkat. Placený tarif nebyl zapnutý.

**Aktualizace:** instalační verze nabídne stažení a restart v launcheru. Portable vyžaduje nový soubor. Nastavení ani nahrávky se nemažou. MQTT se tato oprava netýká.

Ověření: 228 automatických testů, skutečné SQL testy serveru, ověření veřejného endpointu, kontrola UI převzetí a ukončení. Podrobnosti jsou v `docs/COMMUNITY-RELAY.md` a `docs/verification/`.

Banner je úpravou grafiky 0.8.0 pomocí vestavěného imagegen. Zachovává Dragon 2 ze snímku SimRail Wiki; mění číslo na 0.8.1 a popisky na Převzít vlak / Komunitní Discord / Bezpečné propojení. Neoficiální komunitní projekt.
