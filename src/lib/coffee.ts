// Ghi số ly cà phê theo loại và nhắc uống cà phê (mỗi sáng, hoặc sau 4 giờ không mở app).
import * as Notifications from 'expo-notifications';

import { addDays, iso, todayIso, type Data } from './core';
import type { Strings } from './i18n';
import { remindersSupported } from './water';

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

export const COFFEE_CHANNEL = 'coffee';
const PREFIX = 'coffee-';
const IDLE_MS = 4 * 3600_000;
const QUIET_FROM = 22, QUIET_TO = 7;

/** Dựng lại lịch nhắc cà phê. Gọi mỗi khi mở app / rời app / dữ liệu đổi. */
export async function scheduleCoffee(cfg: CoffeeCfg, data: Data, t: Strings): Promise<number> {
  if (!remindersSupported) return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  if (!cfg.on) return 0;
  if (!(await Notifications.getPermissionsAsync()).granted) return 0;

  const now = Date.now(), td = todayIso();
  const add = (id: string, when: Date, title: string, body: string) =>
    Notifications.scheduleNotificationAsync({
      identifier: PREFIX + id,
      content: { title, body, data: { kind: 'coffee' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: COFFEE_CHANNEL },
    }).then(() => 1, () => 0);

  if (cfg.mode === 'morning') {
    let n = 0;
    for (let k = 0; k < 3; k++) {
      const day = addDays(td, k);
      if (k === 0 && coffeeDay(data, day).cups > 0) continue;
      const when = new Date(day + 'T00:00:00');
      when.setHours(Math.floor(cfg.at / 60), cfg.at % 60, 0, 0);
      if (when.getTime() <= now + 60_000) continue;
      n += await add(`m-${day}`, when, t.coffeeTitleMorning, t.coffeeBodyMorning);
    }
    return n;
  }

  // idle: một lời nhắc 4 giờ sau lần mở app gần nhất; rơi vào giờ nghỉ đêm thì dời sang 7:00
  const when = new Date(now + IDLE_MS);
  const h = when.getHours();
  if (h >= QUIET_FROM || h < QUIET_TO) {
    if (h >= QUIET_FROM) when.setDate(when.getDate() + 1);
    when.setHours(QUIET_TO, 0, 0, 0);
  }
  // đã quá 400 mg hôm đó thì thôi
  if (coffeeDay(data, iso(when)).mg >= CAFFEINE_MAX) return 0;
  return add('idle', when, t.coffeeTitleIdle, t.coffeeBodyIdle);
}
