/** Minimální parser Valve KeyValues (VDF/ACF) – stačí pro libraryfolders.vdf a appmanifest_*.acf. */
export type VdfValue = string | VdfObject;
export interface VdfObject { [key: string]: VdfValue }

export function parseVdf(text: string): VdfObject {
  let i = 0;
  const n = text.length;

  const skipWs = () => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text[i] === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; } else break;
    }
  };

  const readString = (): string => {
    if (text[i] !== '"') throw new Error(`VDF: očekávána uvozovka na pozici ${i}`);
    i++;
    let out = '';
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        const c = text[i + 1];
        out += c === 'n' ? '\n' : c === 't' ? '\t' : c; // \\ → \, \" → "
        i += 2;
      } else out += text[i++];
    }
    if (i >= n) throw new Error('VDF: neukončený řetězec');
    i++;
    return out;
  };

  const readObject = (top: boolean): VdfObject => {
    const obj: VdfObject = {};
    for (;;) {
      skipWs();
      if (i >= n) { if (top) return obj; throw new Error('VDF: chybí uzavírací }'); }
      if (text[i] === '}') { if (top) throw new Error('VDF: nadbytečná }'); i++; return obj; }
      const key = readString();
      skipWs();
      if (text[i] === '{') { i++; obj[key] = readObject(false); }
      else obj[key] = readString();
    }
  };

  return readObject(true);
}

export const isObject = (v: VdfValue | undefined): v is VdfObject => typeof v === 'object' && v !== null;
