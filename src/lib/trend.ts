// Số liệu xu hướng theo ngày / tuần — dùng chung cho màn Tiến độ và báo cáo PDF.
import { addDays, dayTotals, sum, targetOn, todayIso, type Data } from './core';

export type Bar = { d: string; d2: string; week?: boolean; n: number; meals: number; k: number; p: number; c: number; f: number; tg: number };
export type Trend = { daily: Bar[]; bars: Bar[]; logged: Bar[]; avg: number; over: number; avgP: number; avgC: number; avgF: number };

export function buildTrend(data: Data, range: number, viewDate: string, end = todayIso()): Trend {
  const daily: Bar[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const s = addDays(end, -i);
    daily.push({ d: s, d2: s, n: 1, meals: (data.days[s] || []).length, tg: targetOn(data, s), ...dayTotals(data, s, viewDate, true) });
  }
  let bars = daily;
  // trên 30 ngày: mỗi cột là một tuần = trung bình các ngày có ghi
  if (range > 30) {
    bars = [];
    for (let i = daily.length; i > 0; i -= 7) {
      const w = daily.slice(Math.max(0, i - 7), i), lg = w.filter((x) => x.k > 0), n = lg.length || 1;
      bars.unshift({ d: w[0].d, d2: w[w.length - 1].d, week: true, n: lg.length, meals: sum(w, 'meals'),
        k: sum(lg, 'k') / n, p: sum(lg, 'p') / n, c: sum(lg, 'c') / n, f: sum(lg, 'f') / n, tg: sum(w, 'tg') / w.length });
    }
  }
  const logged = daily.filter((x) => x.k > 0), nl = logged.length || 1;
  return {
    daily, bars, logged,
    avg: logged.length ? sum(logged, 'k') / logged.length : 0,
    over: logged.filter((x) => x.k > x.tg).length,
    avgP: sum(logged, 'p') / nl, avgC: sum(logged, 'c') / nl, avgF: sum(logged, 'f') / nl,
  };
}

export function topRounded(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Thang trục dọc dùng chung. */
export function chartScale(bars: Bar[]) {
  const maxV = Math.max(...bars.map((x) => x.tg * 1.12), ...bars.map((x) => x.k * 1.06), 500);
  const step = maxV > 3200 ? 1000 : maxV > 1600 ? 500 : 250;
  return { step, top: Math.ceil(maxV / step) * step };
}
