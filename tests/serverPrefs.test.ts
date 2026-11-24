import { describe, it, expect } from 'vitest';
import { isCzechServer, pickDefaultServer, sortServers } from '../src/services/serverPrefs';

const S = [
  { code: 'en1', name: 'EN1 (English)', active: true },
  { code: 'pl1', name: 'PL1 (Polish)', active: true },
  { code: 'cz2', name: 'CZ2 (Czech)', active: false },
  { code: 'cz1', name: 'CZ1 (Czech)', active: true }
];
describe('český server jako výchozí', () => {
  it('pozná český server podle kódu i názvu', () => {
    expect(isCzechServer({ code: 'cz1', name: 'x' })).toBe(true);
    expect(isCzechServer({ code: 'zz9', name: 'Česká trať' })).toBe(true);
    expect(isCzechServer({ code: 'en1', name: 'EN1 (English)' })).toBe(false);
  });
  it('řadí aktivní české první a neaktivní nakonec', () => {
    expect(sortServers(S).map((s) => s.code)).toEqual(['cz1', 'en1', 'pl1', 'cz2']);
  });
  it('vybere první aktivní český; respektuje uloženou volbu jen když je server aktivní', () => {
    expect(pickDefaultServer(S, null)).toBe('cz1');
    expect(pickDefaultServer(S, 'en1')).toBe('en1');
    expect(pickDefaultServer(S, 'cz2')).toBe('cz1');
    expect(pickDefaultServer([], null)).toBeNull();
  });
});
