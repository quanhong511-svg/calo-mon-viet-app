// Thông báo tổng kết bữa ăn mỗi tối: nhắc bữa chính còn thiếu và so sánh điểm với 2 ngày trước.
// Giống nhắc uống nước: lên lịch từng ngày cụ thể và dựng lại mỗi khi dữ liệu đổi,
// để nội dung của hôm nay luôn theo số liệu mới nhất.
import * as Notifications from 'expo-notifications';

import { fmtDate } from './backup';
import { compareDays } from './compare';
import { addDays, MEAL_COUNT, pad, todayIso, type Data } from './core';
import type { Lang, Strings } from './i18n';
import { remindersSupported } from './water';

export type MealRemindCfg = { on: boolean; at: number };
export const MEAL_REMIND_DEFAULT: MealRemindCfg = { on: false, at: 20 };
export const MEAL_CHANNEL = 'meals';
const PREFIX = 'meal-';
// iOS chỉ giữ 64 thông báo chờ (nước tối đa 36): mỗi lần mở app đặt lịch 3 ngày tới
const DAYS_AHEAD = 3;

export type MealTimes = Record<number, { on: boolean; at: number }>;
/** Giờ mặc định (phút từ 0:00) theo số bữa: sáng, trưa, tối, phụ chiều, phụ sáng, phụ tối. */
export const MEAL_TIME_DEFAULT = [7 * 60, 11 * 60 + 30, 18 * 60 + 30, 15 * 60, 9 * 60 + 30, 21 * 60];
export const mealTimesOf = (d: Data): MealTimes => {
  const out: MealTimes = {};
  for (let i = 0; i < MEAL_COUNT; i++) out[i] = { on: false, at: MEAL_TIME_DEFAULT[i], ...(d.mealTimes?.[i] || {}) };
  return out;
};
export const fmtTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Nội dung thông báo cho ngày `d`, tính từ dữ liệu hiện có. */
export function mealRemindBody(data: Data, d: string, t: Strings, lang: Lang): string {
  const cmp = compareDays(data, d);
  const cur = cmp?.days[2];
  if (!cmp || !cur?.logged) return t.mrEmpty;
  const fmt = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const lbl = (x: string) => (x === addDays(d, -1) ? t.yesterday.toLowerCase() : fmtDate(lang, x).slice(0, 5));
  const parts: string[] = [];
  const missing = cur.main.map((ok, i) => (ok ? null : t.meals[i].toLowerCase())).filter(Boolean);
  if (missing.length) parts.push(t.mrMissing(missing.join(', ')));
  let s = t.mrScore(cur.score, fmt(cur.tot.k), fmt(cur.tgt));
  if (cmp.best?.d === d) s += ' ' + t.mrBestToday;
  else if (cmp.best) s += ' ' + t.mrBestOther(lbl(cmp.best.d), cmp.best.score);
  else s += '.';
  parts.push(s);
  return parts.join(' ');
}

export async function scheduleMealRemind(cfg: MealRemindCfg, times: MealTimes, data: Data, t: Strings, lang: Lang): Promise<number> {
  if (!remindersSupported) return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  const anyTime = Object.values(times).some((x) => x.on);
  if (!cfg.on && !anyTime) return 0;
  if (!(await Notifications.getPermissionsAsync()).granted) return 0;

  const now = Date.now(), td = todayIso();
  let count = 0;
  const at = (day: string, min: number) => { const w = new Date(day + 'T00:00:00'); w.setHours(Math.floor(min / 60), min % 60, 0, 0); return w; };
  for (let k = 0; k < DAYS_AHEAD; k++) {
    const day = addDays(td, k);
    // nhắc giờ từng bữa; hôm nay bữa nào đã ghi thì bỏ
    for (let i = 0; i < MEAL_COUNT; i++) {
      const x = times[i];
      if (!x?.on) continue;
      const when = at(day, x.at);
      if (when.getTime() <= now + 60_000) continue;
      if (k === 0 && (data.days[day] || []).some((m) => m.meal === i && !m.example)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}at-${day}-${i}`,
        content: { title: t.mtNotiTitle(t.meals[i]), body: t.mtNotiBody(t.meals[i]), data: { kind: 'meal-time', meal: i } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: MEAL_CHANNEL },
      }).then(() => count++).catch(() => {});
    }
    if (!cfg.on) continue;
    const when = at(day, cfg.at * 60);
    if (when.getTime() <= now + 60_000) continue;
    // ngày sau chưa có dữ liệu: nội dung chung, sẽ được viết lại khi mở app ngày đó
    const body = k === 0 ? mealRemindBody(data, day, t, lang) : t.mrGeneric;
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}sum-${day}`,
      content: { title: t.mrTitle, body, data: { kind: 'meals' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: MEAL_CHANNEL },
    }).then(() => count++).catch(() => {});
  }
  return count;
}
