// Đọc mô tả bữa ăn bằng chữ, chạy offline (chép từ bản HTML).
import { mk, type EditItem } from './core';
import { DB } from './foods';

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9.,½¼ ]/g, ' ').replace(/\s+/g, ' ').trim();

// "nam", "sau", "an", "tu", "a" chỉ tính là số khi có đơn vị theo sau
const NUMW: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
const NUMW_AMBIG = new Set(['nam', 'sau', 'an', 'tu', 'a']);
const FRAC: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const UNITS = /^(to|bat|chen|dia|ly|coc|cai|chiec|qua|trai|mieng|phan|suat|xien|hop|lon|chai|cuon|khoanh|cu|bap|nam|bowl|bowls|plate|plates|cup|cups|glass|glasses|piece|pieces|serving|servings|can|cans|slice|slices|of)\s+/;
// đơn vị đếm từng cái: "3 cái bánh khọt" = 3 trong 6 cái của một khẩu phần
const PIECE = new Set(['cai', 'chiec', 'qua', 'trai', 'mieng', 'cuon', 'khoanh', 'xien', 'cu', 'bap', 'piece', 'pieces', 'slice', 'slices']);
const FILLER = /^(sau do|sau|roi|them|an|uong|toi|minh|em|anh|chi)\s+/;
const SIZE: Record<string, number> = { lon: 1.3, to: 1.3, nho: 0.7, vua: 1 };
const DBN = DB.map((d) => {
  const base = d.vi.replace(/\(.*?\)/g, '');
  return {
    d,
    names: [...base.split('/'), d.en.replace(/\(.*?\)/g, '')].map(norm).filter(Boolean),
    count: Number((d.vi.match(/\((\d+)\s/) || [])[1]) || 0,
  };
});
const hasWord = (hay: string, needle: string) => (' ' + hay + ' ').includes(' ' + needle + ' ');

export function parseText(txt: string): { items: EditItem[]; miss: string[] } {
  const chunks = txt.replace(/(\d),(\d)/g, '$1.$2').split(/[,;\n+]|\s(?:va|và|and|voi|với|kem|kèm)\s/i).map((s) => s.trim()).filter(Boolean);
  const items: EditItem[] = [], miss: string[] = [];
  for (const raw of chunks) {
    let n = norm(raw), qty = 1, hadNum = false, unit: string | null = null, size = 1;
    for (let k = 0; k < 3; k++) { const r = n.replace(FILLER, ''); if (r === n || !r || UNITS.test(r + ' ')) break; n = r; }
    const m = n.match(/^(\d+(?:\.\d+)?)\s*([½¼¾])?\s*/) || n.match(/^([½¼¾])\s*/);
    if (m && m[0].trim()) {
      qty = m[1] in FRAC ? FRAC[m[1]] : parseFloat(m[1]) + (m[2] ? FRAC[m[2]] : 0); hadNum = true; n = n.slice(m[0].length);
    } else if (/^(nua|half)\s/.test(n)) {
      qty = 0.5; hadNum = true; n = n.replace(/^(nua|half)\s/, '');
    } else {
      const w = n.split(' ')[0], rest = n.slice(w.length).trim();
      if (NUMW[w] && rest && (!NUMW_AMBIG.has(w) || UNITS.test(rest + ' '))) { qty = NUMW[w]; hadNum = true; n = rest; }
    }
    for (let k = 0; k < 2; k++) { const u = n.match(UNITS); if (!u) break; if (u[1] !== 'of' && !unit) unit = u[1]; n = n.slice(u[0].length); }
    const sz = n.match(/\s(lon|nho|to|vua)$/);
    if (sz && !DBN.some((e) => e.names.some((nm) => hasWord(nm, n)))) { size = SIZE[sz[1]]; n = n.slice(0, -sz[0].length); }
    const toks = n.split(' ').filter(Boolean);
    if (!toks.length) continue;
    let best: (typeof DBN)[number] | null = null, bs = 0;
    for (const e of DBN) for (const nm of e.names) {
      const nt = nm.split(' ');
      let sc = 0;
      if (nm === n) sc = 3;
      else if (hasWord(n, nm)) sc = 2 + (nm.length / n.length) * 0.5;
      else if (hasWord(nm, n)) sc = 1.5 + (nm.startsWith(n + ' ') ? 0.2 : 0) + (n.length / nm.length) * 0.4;
      else { const common = toks.filter((x) => nt.includes(x)).length; sc = common / Math.max(nt.length, toks.length); }
      if (sc > bs) { bs = sc; best = e; }
    }
    if (!best || bs < 0.6) { miss.push(raw); continue; }
    const perPiece = hadNum && best.count && (!unit || PIECE.has(unit));
    const servings = (perPiece ? qty / best.count : qty) * size;
    items.push(mk(best.d.id, Math.max(1, Math.round(best.d.g * servings))));
  }
  return { items, miss };
}
