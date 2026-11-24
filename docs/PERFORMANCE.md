# Reprodukovatelné měření Electronu

Měřicí skript spouští izolovaný profil .test-user-audit-LABEL, vypíná automatická hlášení a nemění běžný uživatelský profil.
Neprovádí instalaci aktualizace. Vyžaduje závislosti projektu včetně Playwrightu a existující Windows EXE.

Z kořene projektu v PowerShellu:
    node scripts/benchmark-electron.mjs baseline "C:/cesta/k/baseline/SimRail Hub.exe" 1800
    node scripts/benchmark-electron.mjs candidate "C:/cesta/k/candidate/SimRail Hub.exe" 1800

Spouštět přímo v terminálu Windows, ideálně postupně, se stejným serverem a vlakem. Počkat na dokončení obou procesů. Během měření nezavírat měřicí okno, neměnit nastavení a neprovádět jiné náročné úlohy.
Skript měří start, 30s domovské stránky, 60s mapy, 30s palubního počítače, 30s minimalizace a závěrečný odečet po uplynutí nejméně 1800s. Průběžné minutové vzorky a případné ukončení se ukládají i při neúspěchu.
Výsledek je v docs/verification/audit-perf-LABEL.json. Za dokončený dlouhý běh považovat jen completed=true a závěrečný vzorek s elapsedSec >= 1800.

RAM = součet workingSetSize procesů z app.getAppMetrics v MiB. CPU = součet percentCPUUsage podle Electronu, nikoli podíl celé vytíženosti počítače. Sdílené stránky mohou být započtené vícekrát; nejde o velikost JS heapu.
API/min zahrnuje pouze dokončené požadavky na oba oficiální SimRail endpointy. První fáze obsahuje startovní špičku a přepočet z 30s na minutu, nejde o ustálený dlouhodobý počet.
Časy palubního počítače závisí i na síti a dostupnosti konkrétního vlaku.

V auditní relaci 24. 11. 2026 se dlouhé běhy ukončily před závěrečným odečtem. Jejich completed není true a hodnotu RAM po 30 minutách z nich nelze dovozovat. Příčina ukončení nebyla potvrzena. Krátké fáze jsou pozorování, nikoli kontrolovaný důkaz celkového snížení CPU/RAM. Před veřejným vydáním zopakovat měření mimo nástrojovou relaci.
