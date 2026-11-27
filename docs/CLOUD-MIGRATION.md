# Kontrolovaný přechod na místní nastavení

## Ověřený stav
Kontrola produkčního projektu simrail-hub-kubias dne 24. 11. 2026 v 18:21:32 Europe/Prague našla 0 účtů Authentication a 0 dokumentů v collection group settings. Proběhlo pouze čtení agregovaného počtu dokumentů a identifikátorů potřebných ke spočítání účtů; hesla, e-maily ani dokumenty nebyly exportovány. Žádná vzdálená data se nezměnila.

Tento stav platí k uvedenému času. Veřejná starší verze ještě může nabízet založení účtu; inventuru je potřeba před skutečným vydáním zopakovat.

## Co zachovává aplikace
Dosavadní synchronizace byla ruční: Save používalo aktuální místní SettingsService, Load zapsalo načtené hodnoty do stejného místního úložiště. Na počítači, kde se nastavení používalo, se proto nic nepřesouvá ani nemaže.
Před přechodem zavřít launcher a zálohovat celou jeho uživatelskou složku, včetně SQLite a případných WAL/SHM souborů, doplňků a hlasů. Nepoužívat mazání AppData ani čistou instalaci jako migrační postup. Oblíbené servery a poslední výběr zůstávají v dosavadním Local Storage.

## Pokud vzniknou nová data pouze v cloudu
1. Pozastavit plán vypnutí vzdálených služeb a zjistit, kterých UID se dokumenty týkají. Obsah nikam veřejně nekopírovat.
2. Vlastník s oprávněním k projektu může otevřít ve Firebase Console dokument users/UID/settings/current a bezpečně uložit hodnotu payload.stringValue do soukromého JSON souboru. Neexportovat passwordHash ani hesla; pro předvolby nejsou potřeba.
3. Uživatel může dočasně použít dosud dostupnou veřejnou 0.5.0, přihlásit se a ručně načíst své předvolby na cílovém PC. Potom aplikaci zavřít a zálohovat její místní složku. Tak se využije již existující normalizace a zápis do SQLite.
4. Při ruční obnově z exportu načítat pouze známé předvolby přes normalizaci SettingsService; nepřepsat místní cestu ke hře, adresář nahrávek, doplňky ani autentizační údaje. Neupravovat otevřenou SQLite přímo a nevkládat neověřený payload do jiných aplikací.
5. Ověřit jazyk, motiv, mapu a hlas offline. Export je soukromý; nesmí se dostat do repozitáře nebo vydání.

## Samostatné rozhodnutí vlastníka
Až po záloze a kontrole případných nových účtů vlastník výslovně schválí rozsah odstranění: projekt, seznam UID/dokumentů, dobu uchování exportu a termín.
Teprve další samostatný úkol může vypnout registrace a odstranit konkrétní Auth účty nebo dokumenty. Nepoužít smazání Firebase projektu; Hosting a veřejné stahování musí zůstat zachované.
Veškeré takové zásahy jsou mimo tuto pracovní větev. Kořenová Firebase konfigurace obsahuje pouze Hosting, takže běžná práce s webem již necílí Firestore pravidla.

## Rozhodnuti vlastnika 27. 11. 2026
Vlastnik nasledne vyslovne schvalil vypnuti samotneho Firebase Hostingu a odstraneni deseti webovych souboru. Hosting je vypnut, zdroje a verejne aktualizace jsou na GitHubu. Projekt, Auth ani databaze se nemazou. Toto rozhodnuti nahrazuje drivejsi pozadavek ponechat Hosting; neudeluje souhlas s mazanim vzdalenych osobnich dat.
