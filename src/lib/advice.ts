// Tư vấn dinh dưỡng bằng AI: tóm tắt 3 ngày ăn uống gần nhất thành câu hỏi gửi cho dịch vụ AI.
import { itemName, mealName } from './backup';
import { coffeeDay } from './coffee';
import { addDays, macroTargets, MEAL_ORDER, mealTot, sum, targetOn, type Data } from './core';
import type { Lang, Strings } from './i18n';

const DAYS = 3;

/** Số ngày có ghi bữa trong 3 ngày tính đến `today`. */
export const adviceDays = (data: Data, today: string) =>
  Array.from({ length: DAYS }, (_, k) => addDays(today, -k)).filter((d) => (data.days[d] || []).some((m) => !m.example));

export function advicePrompt(data: Data, today: string, t: Strings, lang: Lang): string {
  const r = (n: number) => Math.round(n);
  const waterGoal = data.waterCfg?.goal || 2000;
  const lines: string[] = [];
  for (let k = DAYS - 1; k >= 0; k--) {
    const d = addDays(today, -k);
    const meals = (data.days[d] || []).filter((m) => !m.example);
    const cf = coffeeDay(data, d), ml = data.water?.[d] || 0;
    if (!meals.length && !ml && !cf.cups) { lines.push(`${d}: (no log)`); continue; }
    const ts = meals.map(mealTot), mt = macroTargets(data, d);
    lines.push(`${d}${d === today ? ' (today, may be incomplete)' : ''}: ${r(sum(ts, 'k'))}/${r(targetOn(data, d))} kcal; protein ${r(sum(ts, 'p'))}/${r(mt.p)} g, carbs ${r(sum(ts, 'c'))}/${r(mt.c)} g, fat ${r(sum(ts, 'f'))}/${r(mt.f)} g; water ${ml}/${waterGoal} ml; coffee ${cf.cups} cups (~${cf.mg} mg caffeine)`);
    const order = (m: number | string) => (typeof m === 'number' ? MEAL_ORDER.indexOf(m as (typeof MEAL_ORDER)[number]) : 9);
    for (const m of [...meals].sort((a, b) => order(a.meal) - order(b.meal) || a.time.localeCompare(b.time))) {
      const sv = Number(m.servings) || 1;
      lines.push(`  - ${mealName(t, m.meal)} ${m.time}: ${m.items.map((it) => `${itemName(lang, it)} ${r(it.grams * sv)} g`).join(', ')} (${r(mealTot(m).k)} kcal)`);
    }
  }
  const language = lang === 'en' ? 'English' : 'Vietnamese';
  return `You are a friendly nutrition coach who knows Vietnamese food well. Below is the user's food diary for the last ${DAYS} days, logged in a calorie-counting app (targets are the user's own settings).

${lines.join('\n')}

Review the diary and answer in ${language}, in plain text (no Markdown, no tables), at most about 250 words, with these short sections, each starting with the emoji shown:
⚡ Energy: is calorie intake adequate vs the target (too low, about right, too high), and how steady it is from day to day.
🥗 Nutrients: protein / carbs / fat balance vs the targets; likely gaps (vegetables, fibre, fruit, protein quality, fried or salty food, sugary drinks) judged from the dishes.
🍽️ Meals: regularity, skipped meals, late or heavy meals.
💧 Water & coffee: hydration vs the goal; caffeine if relevant.
✅ Suggestions: 3–4 concrete, practical changes using familiar Vietnamese dishes, starting with "• ".
Be encouraging and specific to this data. Do not diagnose medical conditions or prescribe supplements or medication. If days are missing, base the review on the logged days and mention that briefly.`;
}
