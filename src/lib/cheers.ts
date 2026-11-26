// Thành tích trong ngày để hiện lời chúc khi chạm vào tên ứng dụng.
import { coffeeDay } from './coffee';
import { scoreDay } from './compare';
import { addDays, type Data } from './core';

export type CheerId = 'bigEater' | 'eatWell' | 'water' | 'coffee' | 'control';
export type Cheer = { id: CheerId; emoji: string; vals: Record<string, number> };

/** Ngày "đúng chuẩn": năng lượng trong ±10% mục tiêu và đủ 3 bữa chính. */
const onPlan = (data: Data, d: string) => {
  const s = scoreDay(data, d);
  return s.logged && Math.abs(s.tot.k / s.tgt - 1) <= 0.1 && s.main.every(Boolean);
};

export function cheersFor(data: Data, d: string): Cheer[] {
  const out: Cheer[] = [];
  const s = scoreDay(data, d);
  if (s.logged) {
    const ratio = s.tot.k / s.tgt;
    // ăn nhiều: vượt mục tiêu hơn 10%
    if (ratio > 1.1) out.push({ id: 'bigEater', emoji: '🍜', vals: { k: s.tot.k, over: s.tot.k - s.tgt } });
    // ăn khoẻ: đủ bữa, sát mục tiêu, điểm từ 80
    else if (s.score >= 80 && Math.abs(ratio - 1) <= 0.1 && s.main.every(Boolean)) out.push({ id: 'eatWell', emoji: '🥗', vals: { score: s.score } });
  }
  const goal = data.waterCfg?.goal || 2000, ml = data.water?.[d] || 0; // 2000 = WATER_DEFAULT.goal (water.ts kéo theo expo-notifications)
  if (ml >= goal) out.push({ id: 'water', emoji: '💧', vals: { ml, goal } });
  const cf = coffeeDay(data, d);
  if (cf.cups >= 3) out.push({ id: 'coffee', emoji: '☕', vals: { cups: cf.cups, mg: cf.mg } });
  // kiểm soát cực tốt: từ 3 ngày liền đúng chuẩn, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa xong)
  let streak = 0;
  for (let k = onPlan(data, d) ? 0 : 1; k < 60 && onPlan(data, addDays(d, -k)); k++) streak++;
  if (streak >= 3) out.push({ id: 'control', emoji: '🏆', vals: { days: streak } });
  return out;
}
