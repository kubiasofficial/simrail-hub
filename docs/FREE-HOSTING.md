# Provoz bez investic

Desktopová aplikace nepotřebuje Firebase Authentication, Firestore, Cloud Functions, Cloud Run ani placené TTS.
Firebase Hosting zůstává určený pro malý veřejný web. Instalační balíčky se stahují z GitHub Releases; soukromé hlasové nahrávky se nezveřejňují.

Stávající Firebase projekt ponechat na bezplatném nastavení bez aktivace Blaze a fakturace. Odstranění klientské integrace samo o sobě neodstraňuje projekt, databázi ani historická vzdálená data. Jejich případné vypnutí má samostatný schvalovaný postup v CLOUD-MIGRATION.md.

Místní mobilní displej využívá pouze HTTP na stejné privátní síti. Hlášení používají lokální Piper nebo systémový hlas Windows. Žádná nová externí placená služba nebyla přidána.

Vydání vyžaduje samostatný souhlas vlastníka, kontrolu verze a následné vydání na GitHub Releases. Instalační verze dokončí aktualizaci až po uživatelském potvrzení restartu. Portable verze se mění ručně.
Samostatné nasazení webu je možné pouze po schválení vlastníkem. Tato pracovní větev nic nepublikuje.
