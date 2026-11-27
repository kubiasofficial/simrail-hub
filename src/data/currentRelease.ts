export const CURRENT_RELEASE={
 version:'0.8.1',date:'27. 11. 2026',banner:'./assets/releases/0.8.1.png',
 title:'Převzít vlak. Sdílet svoji jízdu.',subtitle:'Komunitní Discord teď i ve veřejném launcheru.',
 url:'https://github.com/kubiasofficial/simrail-hub/releases/tag/v0.8.1',
 features:[
  {id:'display',title:'Převzít vlak pro každého',tag:'OPRAVA',text:'Tlačítko je zpět v palubním počítači. Vyber živý vlak, zadej přezdívku a potvrď skutečné místo převzetí.'},
  {id:'dispatcher',title:'Jízda i směna na Discordu',text:'Oznámení začátku a konce jízdy i potvrzené směny se odesílají na společný komunitní Discord.'},
  {id:'preview',title:'Jednorázové propojení',text:'Při prvním použití ověř zařízení v prohlížeči. Přístup se uloží šifrovaně; společný webhook zůstává na serveru.'}
 ],
 soundNote:'Samotné sledování vlaku nic nezveřejňuje. Převzetí ve hře provádíš ručně; odeslání na Discord vždy potvrzuješ.'
} as const;
