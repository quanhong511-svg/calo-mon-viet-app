// So sánh ngày đang xem với 2 ngày liền trước: ngày nào năng lượng sát mục tiêu nhất và đủ bữa nhất.
import { addDays, isSnack, macroSplit, mealTot, sum, targetOn, type Data, type Totals } from '@/lib/core';

const MAIN = [0, 1, 2] as const; // sáng, trưa, tối

export type DayScore = {
  d: string;
  tot: Totals;
  tgt: number;
  /** bữa chính đã ghi: [sáng, trưa, tối] */
  main: [boolean, boolean, boolean];
  snack: boolean;
  logged: boolean;
  /** 0–100; 50 điểm năng lượng, 30 điểm đủ bữa chính, 20 điểm cân đối đạm/tinh bột/béo */
  score: number;
  parts: { energy: number; meals: number; macro: number };
};

export function scoreDay(data: Data, d: string): DayScore {
  const meals = (data.days[d] || []).filter((m) => !m.example && mealTot(m).k > 0);
  const ts = meals.map(mealTot);
  const tot = { k: sum(ts, 'k'), p: sum(ts, 'p'), c: sum(ts, 'c'), f: sum(ts, 'f') };
  const tgt = targetOn(data, d);
  const main = MAIN.map((i) => meals.some((m) => m.meal === i)) as [boolean, boolean, boolean];
  const snack = meals.some((m) => isSnack(m.meal));
  const logged = meals.length > 0;
  if (!logged) return { d, tot, tgt, main, snack, logged, score: 0, parts: { energy: 0, meals: 0, macro: 0 } };

  // năng lượng: đúng mục tiêu = 50, lệch 50% trở lên = 0
  const energy = 50 * Math.max(0, 1 - Math.abs(tot.k / tgt - 1) / 0.5);
  const mealsPts = main.filter(Boolean).length * 10;
  // cân đối: tổng độ lệch tỉ lệ năng lượng so với mục tiêu (mặc định 20/50/30); lệch 0.6 trở lên = 0
  const SPLIT = macroSplit(data, d);
  const e = tot.p * 4 + tot.c * 4 + tot.f * 9;
  const dev = e > 0 ? Math.abs((tot.p * 4) / e - SPLIT.p) + Math.abs((tot.c * 4) / e - SPLIT.c) + Math.abs((tot.f * 9) / e - SPLIT.f) : 0.6;
  const macro = 20 * Math.max(0, 1 - dev / 0.6);
  return { d, tot, tgt, main, snack, logged, score: Math.round(energy + mealsPts + macro), parts: { energy, meals: mealsPts, macro } };
}

export type Compare = {
  days: DayScore[]; // [d-2, d-1, d]
  /** null khi chỉ 1 ngày có ghi */
  best: DayScore | null;
};

/** Trả null khi cả 3 ngày đều chưa ghi gì. */
export function compareDays(data: Data, viewDate: string): Compare | null {
  const days = [-2, -1, 0].map((n) => scoreDay(data, addDays(viewDate, n)));
  const logged = days.filter((x) => x.logged);
  if (!logged.length) return null;
  // cần ít nhất 2 ngày có ghi mới so được; điểm bằng nhau thì chọn ngày gần nhất
  const best = logged.length < 2 ? null : logged.reduce((a, b) => (b.score >= a.score ? b : a));
  return { days, best };
}
