// Nhắc uống nước bằng thông báo cục bộ (chạy được cả trong Expo Go).
// Lên lịch từng lần nhắc cụ thể cho vài ngày tới (không lặp vô hạn), để:
//  - hôm nay uống đủ thì bỏ các lần nhắc còn lại của hôm nay;
//  - nội dung hôm nay cho biết còn thiếu bao nhiêu ml.
// Lịch được dựng lại mỗi khi mở app, ghi nước hoặc đổi cài đặt.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, iso, todayIso } from './core';
import type { Strings } from './i18n';

export type WaterCfg = { goal: number; on: boolean; every: number; from: number; to: number };
export const WATER_DEFAULT: WaterCfg = { goal: 2000, on: false, every: 120, from: 8, to: 21 };
export const GLASS = 250;
export const remindersSupported = Platform.OS !== 'web';

const PREFIX = 'water-';
const DAYS_AHEAD = 5; // iOS giữ tối đa 64 thông báo chờ
export const WATER_MAX_PENDING = 36; // chừa chỗ cho nhắc bữa ăn và cà phê (iOS giữ tối đa 64)
const MAX_PENDING = WATER_MAX_PENDING;
const CHANNEL = 'water';

let ready = false;
export async function setupNotifications() {
  if (!remindersSupported || ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    // AndroidImportance được xuất lại qua `export *`, plugin import của ESLint không lần theo được
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Nhắc uống nước', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync('coffee', { name: 'Nhắc uống cà phê', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync('meals', { name: 'Tổng kết bữa ăn', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
  }
}

/** Xin quyền gửi thông báo; trả về true nếu được phép. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Các mốc giờ nhắc trong ngày, tính bằng phút từ 0:00. */
export function slots(cfg: WaterCfg): number[] {
  const out: number[] = [];
  for (let m = cfg.from * 60; m <= cfg.to * 60; m += Math.max(30, cfg.every)) out.push(m);
  return out;
}

export async function scheduleWater(cfg: WaterCfg, todayMl: number, t: Strings, lang: 'vi' | 'en'): Promise<number> {
  if (!remindersSupported) return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  if (!cfg.on) return 0;
  if (!(await Notifications.getPermissionsAsync()).granted) return 0;

  const fmt = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const now = Date.now(), td = todayIso();
  let count = 0;
  for (let k = 0; k < DAYS_AHEAD && count < MAX_PENDING; k++) {
    const day = addDays(td, k);
    if (k === 0 && todayMl >= cfg.goal) continue; // hôm nay đã đủ
    for (const m of slots(cfg)) {
      if (count >= MAX_PENDING) break;
      const when = new Date(day + 'T00:00:00');
      when.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (when.getTime() <= now + 60_000 || iso(when) !== day) continue;
      const body = k === 0 ? t.waterBodyLeft(fmt(cfg.goal - todayMl), fmt(cfg.goal)) : t.waterBody(fmt(GLASS), fmt(cfg.goal));
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${day}-${m}`,
        content: { title: t.waterTitle, body, data: { kind: 'water' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      }).then(() => count++).catch(() => {});
    }
  }
  return count;
}
