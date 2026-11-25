// Sao lưu / nhập / xuất văn bản & CSV (cùng định dạng với bản HTML để chuyển dữ liệu qua lại được).
import { dayMeals, dayTotals, findMeal, mealTot, targetOn, todayIso, uid, type Data, type Meal } from './core';
import { byId } from './foods';
import type { Lang, Strings } from './i18n';

const fmtR = (lang: Lang) => (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
export const fmtDate = (lang: Lang, s: string) => { const [y, m, d] = s.split('-'); return lang === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`; };
export const itemName = (lang: Lang, it: { id: string | null; name: string }) => (it.id && byId[it.id] ? (lang === 'en' ? byId[it.id].en : byId[it.id].vi) : it.name);
export const mealName = (t: Strings, m: number | string) => (typeof m === 'number' ? t.meals[m] : String(m));

function scopeDays(data: Data, scope: 'day' | 'all', viewDate: string): [string, Meal[]][] {
  if (scope === 'day') return [[viewDate, dayMeals(data, viewDate, viewDate).filter((m) => !m.example)]];
  return Object.keys(data.days).sort().map((d) => [d, data.days[d]] as [string, Meal[]]).filter(([, m]) => m.length);
}

export function toText(data: Data, t: Strings, lang: Lang, scope: 'day' | 'all', viewDate: string) {
  const r0 = fmtR(lang);
  const L = [t.appName + ' — ' + (scope === 'day' ? fmtDate(lang, viewDate) : t.scopeAll), t.authorLbl + ': Tran Hong Quan'];
  for (const [d, meals] of scopeDays(data, scope, viewDate)) {
    L.push('');
    if (scope !== 'day') L.push('== ' + fmtDate(lang, d) + ' ==');
    for (const m of meals) {
      const s = mealTot(m), sv = Number(m.servings) || 1;
      L.push(`${mealName(t, m.meal)} ${m.time} — ${r0(s.k)} kcal${sv !== 1 ? ` (×${sv})` : ''}`);
      for (const it of m.items) L.push(`  • ${itemName(lang, it)} ${r0(it.grams * sv)} g: ${r0(it.kcal * sv)} kcal`);
    }
    const tt = dayTotals(data, d, viewDate, true);
    L.push(`${t.total}: ${r0(tt.k)} / ${r0(targetOn(data, d))} kcal · ${t.protein} ${r0(tt.p)} g · ${t.carb} ${r0(tt.c)} g · ${t.fat} ${r0(tt.f)} g`);
  }
  return L.join('\n');
}

export function toCsv(data: Data, t: Strings, lang: Lang) {
  const head = lang === 'en' ? ['date', 'meal', 'time', 'food', 'grams', 'kcal', 'protein_g', 'carb_g', 'fat_g', 'source'] : ['ngay', 'bua', 'gio', 'mon', 'gram', 'kcal', 'dam_g', 'tinh_bot_g', 'beo_g', 'nguon'];
  const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [head.join(',')];
  for (const [d, meals] of scopeDays(data, 'all', todayIso())) for (const m of meals) {
    const sv = Number(m.servings) || 1;
    for (const it of m.items) rows.push([d, mealName(t, m.meal), m.time, itemName(lang, it), Math.round(it.grams * sv), Math.round(it.kcal * sv), (it.p * sv).toFixed(1), (it.c * sv).toFixed(1), (it.f * sv).toFixed(1), m.source || 'manual'].map(q).join(','));
  }
  return '﻿' + rows.join('\r\n');
}

export const backup = (data: Data, lang: Lang) => ({
  app: 'calo-mon-viet', v: 5, exported: new Date().toISOString(), target: data.target, targets: data.targets || null, lang, days: data.days, deleted: data.deleted || {},
  water: data.water || {},
});

export const validTarget = (v: unknown) => { const n = Number(v); return n >= 800 && n <= 5000 ? Math.round(n) : null; };
const PHOTO_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
function cleanMeal(m: any, id: string): Meal {
  const sv = Number(m.servings);
  return {
    id, meal: Number.isInteger(m.meal) && m.meal >= 0 && m.meal <= 3 ? m.meal : String(m.meal ?? '').slice(0, 30) || 3, time: String(m.time || '').slice(0, 8),
    source: String(m.source || 'manual').slice(0, 20), servings: sv > 0 && sv <= 10 ? sv : 1, photo: typeof m.photo === 'string' && PHOTO_RE.test(m.photo) ? m.photo : null, upd: Number(m.upd) || 0,
    items: m.items.filter((it: any) => it && typeof it === 'object').map((it: any) => ({
      id: it.id && byId[it.id] ? it.id : null, name: String(it.name || '?').slice(0, 60), grams: Math.max(0, Number(it.grams) || 0),
      kcal: Math.max(0, Number(it.kcal) || 0), p: Math.max(0, Number(it.p) || 0), c: Math.max(0, Number(it.c) || 0), f: Math.max(0, Number(it.f) || 0),
    })),
  };
}

/** Gộp bản sao lưu vào data (sửa tại chỗ): thêm bữa mới, bản sửa mới hơn thắng, áp dụng bữa đã xoá cả hai chiều. Trả về [số ngày, số bữa]. */
export function mergeBackup(data: Data, j: any): [number, number] {
  if (j?.app !== 'calo-mon-viet' || !j.days || typeof j.days !== 'object') throw new Error('bad');
  const del = data.deleted || (data.deleted = {}), touched = new Set<string>();
  let nm = 0;
  if (j.deleted && typeof j.deleted === 'object') for (const [id, ts0] of Object.entries(j.deleted)) {
    const ts = Number(ts0) || 0;
    if (!(del[id] >= ts)) del[id] = ts;
    const loc = findMeal(data, id);
    if (loc && (Number(loc.m.upd) || 0) <= ts) { loc.arr.splice(loc.i, 1); if (!loc.arr.length) delete data.days[loc.d]; touched.add(loc.d); nm++; }
  }
  for (const [d, meals] of Object.entries(j.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(meals)) continue;
    for (const m of meals as any[]) {
      if (!m || typeof m !== 'object' || !Array.isArray(m.items)) continue;
      const id = m.id ? String(m.id).slice(0, 40) : uid(), cm = cleanMeal(m, id);
      if (del[id] != null && del[id] >= (cm.upd || 0)) continue;
      const loc = findMeal(data, id);
      if (loc) { if ((cm.upd || 0) > (Number(loc.m.upd) || 0)) { loc.arr[loc.i] = cm; touched.add(loc.d); nm++; } continue; }
      (data.days[d] ||= []).push(cm); touched.add(d); nm++;
    }
  }
  if (j.targets && typeof j.targets === 'object') for (const [k, v] of Object.entries(j.targets)) {
    const tv = validTarget(v);
    if (tv && /^\d{4}-\d{2}-\d{2}$/.test(k) && !(data.targets ||= {})[k]) data.targets[k] = tv;
  }
  // nước: mỗi ngày giữ số lớn hơn giữa hai bản
  if (j.water && typeof j.water === 'object') for (const [d, v] of Object.entries(j.water)) {
    const ml = Math.round(Number(v));
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && ml > 0 && ml < 20000 && ml > ((data.water ||= {})[d] || 0)) data.water[d] = ml;
  }
  if (nm) data.started = true;
  return [touched.size, nm];
}
