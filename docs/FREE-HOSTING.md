# Provoz bez investic

Projekt `simrail-hub-kubias` používá Firebase Spark bez propojení s fakturačním účtem. Nepovolovat Blaze, Cloud Functions, Cloud Run, placené SMS ani další databáze. Cloud Storage se nepoužívá. Při vyčerpání bezplatných limitů může být služba dočasně nedostupná; lokální režim launcheru tím nekončí. Bez připojené fakturace se neaktivuje placené pokračování provozu.

- GitHub: veřejný zdrojový kód, Issues, bezplatné standardní Windows Actions a GitHub Releases pro EXE a budoucí zvukové balíčky. Žádné placené velké runnery ani dlouhodobé Actions artefakty.
- Firebase Hosting: pouze malá veřejná stránka. Instalační soubory ani audionahrávky z ní nestahovat; odkazy vedou na GitHub Releases.
- Firestore: jediná databáze Standard, evropský region, jen veřejné novinky a soukromé předvolby účtu. Ruční uložení a načtení předvoleb omezuje počet operací. Polohy vlaků se do ní nekopírují.
- Authentication: základní e-mail/heslo. Účet není nutný pro běžné používání.

## Další verze

Změny projdou kontrolou v GitHub Actions. Zvednout verzi v package.json a package-lock.json, vytvořit tag `vX.Y.Z` a odeslat ho. Workflow `Vydání pro Windows` ověří shodu verze, provede testy, sestaví EXE a nahraje soubory i kontrolní součty do GitHub Releases. Launcher kontroluje vydání v `kubiasofficial/simrail-hub`; instalaci uživatel spustí sám.

Web nasazovat přes `firebase deploy --only hosting`. Pravidla databáze přes `firebase deploy --only firestore:rules,firestore:indexes`. Před každou změnou cloudové infrastruktury ověřit, že projekt stále nemá zapnutou fakturaci. Přihlašovací údaje CLI ani service account klíče nepatří do GitHubu. Automatický deploy Firebase přes tajné klíče není potřeba pro vydávání desktopových aktualizací.

Oficiální podklady: [Firebase Spark](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [GitHub Actions](https://docs.github.com/en/actions/concepts/billing-and-usage).
