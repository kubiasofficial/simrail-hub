export const CURRENT_RELEASE={
 version:'0.8.2',date:'27. 11. 2026',banner:'./assets/releases/0.8.2.png',
 title:'Začátek jízdy určí launcher.',subtitle:'Převzetí vlaku bez ručního psaní stanice.',
 url:'https://github.com/kubiasofficial/simrail-hub/releases/tag/v0.8.2',
 features:[
  {id:'display',title:'Začátek řízení automaticky',tag:'OPRAVA',text:'Při převzetí zadáš přezdívku. Stanici nebo úsek launcher určí z aktuálních dat vybraného vlaku.'},
  {id:'preview',title:'Čerstvá poloha při potvrzení',text:'Místo znovu vyhodnotíme až při potvrzení, i když se vlak během otevřeného okna posunul.'},
  {id:'dispatcher',title:'Poctivé určení místa',text:'Rozlišujeme stanici, její blízkost, úsek i souřadnice vlaku. Chybějící nebo stará data nejsou vydávána za potvrzenou stanici.'}
 ],
 soundNote:'Oznámení na společný Discord dál odešleš až vlastním potvrzením. Skutečné převzetí vlaku ve hře provádíš ručně.'
} as const;
