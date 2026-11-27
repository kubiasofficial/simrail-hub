# Veřejné převzetí vlaku a komunitní Discord

Electron se připojuje k `https://simrail-hub-community.suslik-kuba.workers.dev`. Sdílený webhook je pouze serverový secret. V balíčku není webhook, Turnstile secret ani podpisový klíč. Přístupový token zařízení se nevrací do rendereru. TEST může nadále používat místní soukromou konfiguraci.

## Propojení a doručování

První použití otevře ověřovací stránku. Cloudflare Turnstile se ověřuje na serveru včetně hostname, action a kódu registrace. Registrace platí deset minut; oddělený náhodný polling secret zůstává v hlavním procesu. Po potvrzení se vydá přístup na 30 dnů, šifrovaný přes Electron safeStorage / Windows DPAPI. Server ukládá jen otisk tokenu.

Server přijímá jen vyjmenované typy událostí jízdy a směny, omezené názvy a délky údajů; nepřijímá libovolné obrázky, URL, přílohy ani oznámení. Zmínky jsou vypnuté. Steam identita se neověřuje a zprávy to uvádějí.

D1 atomicky zaznamená identifikátor události před požadavkem na Discord. Stejný identifikátor vrací původní potvrzení. HTTP 429 čeká na další povolený pokus. Nejasná odpověď není opakována naslepo. Explicitní ruční opakování vytvoří novou revizi; u nejasného výsledku UI nejprve vyžaduje kontrolu Discordu a potvrzení rizika duplicity.

## Provoz

Cloudflare Workers + D1 + Turnstile. Placený tarif ani billing změny nebyly aktivovány. [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) a [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) mají denní limity; po jejich vyčerpání může služba dočasně přestat přijímat zprávy.

Aplikační omezení: 12 událostí za minutu z jedné IP, 30 za hodinu ze zařízení, 60 za minutu a 1 000 za den celkem. Registrace má samostatné limity. Tyto limity lze snížit bez změny launcheru. Nejde o garanci dostupnosti ani neomezený Discord relay.

Denní úklid maže staré čítače, registrace, prošlé tokeny a události starší než 14 dnů. Text zpráv se v D1 neukládá; jsou zde jen ID, kontrolní otisky a výsledky doručení. Observability request logy jsou vypnuté.

Nasazení: `npx wrangler@4.168.0 d1 execute simrail-hub-community --remote --file schema.sql --config wrangler.jsonc --yes`, poté `deploy --config wrangler.jsonc` ze složky `community-relay`. Secrets nastavuj pomocí `wrangler secret`, nikdy ne do configu. Povinné secrets: `DISCORD_WEBHOOK`, `TURNSTILE_SECRET`, `SIGNING_SECRET`. Veřejný sitekey je v configu. Podpisový klíč bez důvodu neobnovuj: změna zneplatní přístupy zařízení.

## Kontroly

Testy používají skutečný SQLite engine pro D1 dotazy a simulovaný Discord / Siteverify. Prověřují ověření hostu a challenge, autentizaci, potvrzení bez duplicit, rate limits, 429, nejasné odpovědi, šifrované místní uložení a všechny události skutečného DrivingJournalu. UI test ověřuje blokování před propojením, potvrzení, obnovení po reloadu a ukončení. Živý endpoint byl ověřen registrací, stavem pending a odmítnutím anonymního POSTu. Při těchto kontrolách nebyla na Discord odeslána žádná smyšlená jízda.

Živá zkouška byla doručena a následně přečtena z Discordu. Má pevný technický text, nikoli tvrzení o převzetí vlaku. Ověření QA zařízení bylo administrátorem připraveno v samostatném záznamu a přístup byl po zkoušce odvolán. Produkční aplikace Turnstile vyžaduje. Při prvním testu se zachytil nepodporovaný `redirect: error` ve Workers; server nyní používá `manual` a test tuto odlišnost runtime pokrývá. [Dokumentace runtime](https://developers.cloudflare.com/workers/runtime-apis/request/).
