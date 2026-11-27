# SimRail Hub 0.8.3 · Tvůj hlas na každé cestě

Hotová hlasová hlášení se nyní nainstalují spolu s launcherem. Po aktualizaci nemusíš kopírovat složku se zvuky.

- **61 nahrávek přímo v aktualizaci:** 44 názvů stanic, tři spojovací fráze a 14 obecných nebo vánočních hlášení.
- **Pro všechny osobní linky:** názvy stanic se sdílejí podle skutečných zastávek PH, bez omezení číslem vlaku. Nákladní vlaky nehlásí cestujícím.
- **Funguje i na čistém počítači:** vlastní složka má přednost po jednotlivých souborech; co v ní chybí, doplní vestavěná sada.
- **Klidnější cesta:** ohleduplnost nejdříve deset minut po dokončení uvítání a informace o pomoci nejdříve po 25 minutách. Mezi informačními hlášeními nejméně 15 minut po dokončení a pouze mimo blízkost zastávek. Kontrola jízdenek zůstává ruční.
- **Štědrý den na palubě:** vánoční uvítání a rozloučení automaticky jen 24. prosince podle skutečného českého data. Vážou se na první a poslední doloženou PH zastávku řiditelného úseku; konec mapy není vydáván za konečnou stanici vlaku.
- **Nový zvuk vysílačky:** krátké dvoutónové pípnutí a jemný šum před zprávou dispečera i po ní. Hlas a vysílačka mají nadále vlastní nastavení hlasitosti.
- **Vše ke stažení na GitHubu:** veřejný Firebase web byl na žádost vlastníka vypnut. Mobilní QR displej dál běží na místní síti a oznámení na Discordu obsluhuje stávající služba Cloudflare.

## Jak aktualizovat
V nainstalovaném launcheru zvol **Vyhledat aktualizace**. Po stažení potvrď instalaci a restart. Přenosná varianta je dostupná samostatně na GitHub Releases.

## Ověření a soukromí
Prošlo 247 automatických testů, typová kontrola a sestavení. Každý zveřejněný WAV má ověřený SHA-256, velikost a formát PCM mono 48 kHz / 16 bit. Zveřejněné jsou jen hotové nahrávky schválené autorem; původní M4A ani další soukromé soubory se nepublikují. Vlastní zvuky uživatelů se nikam neodesílají. Instalace zachovává místní nastavení. MQTT ani větev NEXT nejsou potřeba a nepřidává se placená služba.

Volitelné vánoční přání během cesty zatím nahrané není, proto se tento bod přeskočí. Chybějící názvy stanic dál využijí syntetický hlas.

Obrázek vydání používá existující skutečný herní snímek EN57-1000 z knihovny SimRail Wiki, kterou launcher již obsahuje.
