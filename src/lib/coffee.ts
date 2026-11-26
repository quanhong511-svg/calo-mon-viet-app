// Số ly cà phê theo loại và lượng caffeine (thuần dữ liệu; lịch nhắc ở coffee-remind.ts).
import type { Data } from './core';

export type CoffeeKind = 'po' | 'es' | 'la' | 'jc';
export const COFFEE_KINDS: CoffeeKind[] = ['po', 'es', 'la', 'jc'];
export const COFFEE_ICON = { po: 'pourover', es: 'espresso', la: 'latte', jc: 'mug' } as const;
/** caffeine ước tính mỗi ly (mg) */
export const CAFFEINE: Record<CoffeeKind, number> = { po: 150, es: 65, la: 75, jc: 95 };
export const CAFFEINE_MAX = 400;

export type CoffeeCfg = { on: boolean; mode: 'morning' | 'idle'; at: number };
export const COFFEE_DEFAULT: CoffeeCfg = { on: false, mode: 'morning', at: 8 * 60 };
export const coffeeCfgOf = (d: Data): CoffeeCfg => ({ ...COFFEE_DEFAULT, ...(d.coffeeCfg || {}) });

export function coffeeDay(data: Data, d: string) {
  const c = data.coffee?.[d] || {};
  let cups = 0, mg = 0;
  for (const k of COFFEE_KINDS) { const n = c[k] || 0; cups += n; mg += n * CAFFEINE[k]; }
  return { counts: c, cups, mg };
}
