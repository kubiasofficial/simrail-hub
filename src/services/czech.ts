const ONES = ['nula', 'jedna', 'dvě', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět', 'deset', 'jedenáct', 'dvanáct', 'třináct', 'čtrnáct', 'patnáct', 'šestnáct', 'sedmnáct', 'osmnáct', 'devatenáct'];
const TENS = ['', '', 'dvacet', 'třicet', 'čtyřicet', 'padesát', 'šedesát', 'sedmdesát', 'osmdesát', 'devadesát'];

/** Čísla 1–99 slovy (ženský rod pro „minuta“, 4. pád: „jednu minutu“). */
export function czechMinutes(n: number): string {
  const m = Math.max(1, Math.min(99, Math.round(n)));
  const unit = m % 10, tens = Math.floor(m / 10);
  let words: string;
  if (m < 20) words = ONES[m];
  else words = unit === 0 ? TENS[tens] : `${TENS[tens]} ${ONES[unit]}`;
  words = words.replace(/jedna$/, 'jednu');
  const noun = unit === 1 ? 'minutu' : unit >= 2 && unit <= 4 && (m < 10 || m > 20) ? 'minuty' : 'minut';
  return `${words} ${noun}`;
}

export function polishMinutes(n: number): string {
  const m = Math.max(1, Math.round(n));
  const u = m % 10, t = m % 100;
  const noun = m === 1 ? 'minutę' : u >= 2 && u <= 4 && !(t >= 12 && t <= 14) ? 'minuty' : 'minut';
  return `${m} ${noun}`;
}
