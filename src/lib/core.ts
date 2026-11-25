// Kiểu dữ liệu và phép tính dinh dưỡng (giữ nguyên định dạng của bản HTML để sao lưu dùng chung được).
import { byId, type Food } from './foods';

export type Per100 = { kcal: number; p: number; c: number; f: number };
/** Món trong bữa khi đang sửa (có per100 để đổi gram). */
export type EditItem = { id: string | null; name: string; grams: number; per100: Per100; kcal: number; p: number; c: number; f: number; conf: number | null; note?: string };
/** Món đã lưu. */
export type Item = { id: string | null; name: string; grams: number; kcal: number; p: number; c: number; f: number };
export type Meal = {
  id: string; meal: number | string; time: string; source?: string; servings: number; photo: string | null; items: Item[]; upd?: number; example?: boolean;
};
export type Data = {
  v: number; target: number; targets?: Record<string, number> | null; days: Record<string, Meal[]>; started: boolean;
  deleted?: Record<string, number>; lastBackup?: string; nagDay?: string;
};
export type Totals = { k: number; p: number; c: number; f: number };

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const todayIso = () => iso(new Date());
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

export const per100 = (d: Food): Per100 => ({ kcal: (d.kcal / d.g) * 100, p: (d.p / d.g) * 100, c: (d.c / d.g) * 100, f: (d.f / d.g) * 100 });
export function scaleItem(it: EditItem): EditItem {
  const r = it.grams / 100;
  return { ...it, kcal: it.per100.kcal * r, p: it.per100.p * r, c: it.per100.c * r, f: it.per100.f * r };
}
export function mk(id: string, grams?: number): EditItem {
  const d = byId[id];
  return scaleItem({ id, name: d.vi, grams: grams ?? d.g, per100: per100(d), conf: null, kcal: 0, p: 0, c: 0, f: 0 });
}
export function cloneItem(it: Item | EditItem): EditItem {
  const g = Number(it.grams) || 1;
  const base = 'per100' in it && it.per100 ? { ...it.per100 } : { kcal: (it.kcal / g) * 100, p: (it.p / g) * 100, c: (it.c / g) * 100, f: (it.f / g) * 100 };
  return scaleItem({ id: it.id || null, name: it.name, grams: g, per100: base, conf: ('conf' in it ? it.conf : null) ?? null, note: ('note' in it && it.note) || '', kcal: 0, p: 0, c: 0, f: 0 });
}

export const sum = <T,>(a: T[], k: keyof T) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
export function mealTot(m: { servings?: number; items: Item[] }): Totals {
  const s = Number(m.servings) || 1;
  return { k: sum(m.items, 'kcal') * s, p: sum(m.items, 'p') * s, c: sum(m.items, 'c') * s, f: sum(m.items, 'f') * s };
}

export const EXAMPLE: Meal[] = [
  { id: 'ex1', meal: 0, time: '07:15', example: true, servings: 1, photo: null, items: [mk('pho-bo'), mk('ca-phe-sua')] },
  { id: 'ex2', meal: 1, time: '12:05', example: true, servings: 1, photo: null, items: [mk('com-tam')] },
];
export const showExample = (data: Data, viewDate: string) => !data.started && viewDate === todayIso();
export const dayMeals = (data: Data, d: string, viewDate: string): Meal[] =>
  showExample(data, viewDate) && d === todayIso() ? EXAMPLE : data.days[d] || [];
/** real=true bỏ qua bữa ví dụ (dùng cho biểu đồ). */
export function dayTotals(data: Data, d: string, viewDate: string, real?: boolean): Totals {
  const ms = (real ? data.days[d] || [] : dayMeals(data, d, viewDate)).map(mealTot);
  return { k: sum(ms, 'k'), p: sum(ms, 'p'), c: sum(ms, 'c'), f: sum(ms, 'f') };
}
export function findMeal(data: Data, id: string | null | undefined) {
  if (id == null) return null;
  for (const d of Object.keys(data.days)) {
    const arr = data.days[d], i = arr.findIndex((x) => x.id === id);
    if (i >= 0) return { d, arr, i, m: arr[i] };
  }
  return null;
}
/** Lịch sử mục tiêu: data.targets = {"YYYY-MM-DD": kcal} áp dụng từ ngày đó trở đi. */
export function targetOn(data: Data, d: string) {
  const tg = data.targets;
  if (!tg) return data.target;
  let best: string | null = null;
  for (const k in tg) if (k <= d && (best === null || k > best)) best = k;
  return best === null ? data.target : tg[best];
}
export function setTarget(data: Data, v: number) {
  const td = todayIso();
  if (!data.targets || !Object.keys(data.targets).length) data.targets = { '0000-00-00': data.target };
  data.targets[td] = v;
  data.target = v;
}
export function streak(data: Data) {
  let n = 0;
  let d = todayIso();
  if (!(data.days[d] || []).length) d = addDays(d, -1);
  while ((data.days[d] || []).length) { n++; d = addDays(d, -1); }
  return n;
}
export function guessMeal() {
  const h = new Date().getHours();
  return h < 4 ? 3 : h < 10 ? 0 : h < 14 ? 1 : h < 17 ? 3 : h < 21 ? 2 : 3;
}
export const toSaved = (it: EditItem): Item => ({
  id: it.id, name: it.name, grams: Math.round(it.grams), kcal: +it.kcal.toFixed(1), p: +it.p.toFixed(1), c: +it.c.toFixed(1), f: +it.f.toFixed(1),
});
export const newData = (): Data => ({ v: 1, target: 2000, days: {}, started: false });
