import { describe, it, expect } from 'vitest';
import { parseVdf } from '../src/services/vdf';

describe('parseVdf', () => {
  it('parsuje vnořené objekty a escapované zpětné lomítko', () => {
    const r = parseVdf('"a"\n{\n "path" "D:\\\\SteamLibrary"\n "b" { "c" "1" }\n}');
    expect(r).toEqual({ a: { path: 'D:\\SteamLibrary', b: { c: '1' } } });
  });
  it('ignoruje komentáře', () => {
    expect(parseVdf('// x\n"k" "v" // konec')).toEqual({ k: 'v' });
  });
  it('vyhodí srozumitelnou chybu u poškozeného souboru', () => {
    expect(() => parseVdf('"a" { "b" "c"')).toThrow(/uzavírací/);
    expect(() => parseVdf('"a" "neukončený')).toThrow(/neukončený/);
    expect(() => parseVdf('}')).toThrow(/nadbytečná/);
  });
});
