// Nhắc uống cà phê: mỗi sáng, hoặc 4 giờ sau ly gần nhất.
import * as Notifications from 'expo-notifications';

import { CAFFEINE_MAX, coffeeDay, type CoffeeCfg } from './coffee';
import { addDays, iso, todayIso, type Data } from './core';
import type { Strings } from './i18n';
import { remindersSupported } from './water';

export const COFFEE_CHANNEL = 'coffee';
const PREFIX = 'coffee-';
const IDLE_MS = 4 * 3600_000;
const QUIET_FROM = 22, QUIET_TO = 7;

/** Dựng lại lịch nhắc cà phê. Gọi mỗi khi mở app hoặc dữ liệu đổi. */
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

  // 'idle' = 4 giờ sau ly gần nhất. Chưa uống ly nào trong ngày thì nhắc ly đầu lúc cfg.at.
  // Không nhắc từ 22:00 đến 7:00, không nhắc khi ngày đó đã quá 400 mg.
  let n = 0;
  const today = coffeeDay(data, td);
  const last = data.coffeeLast && iso(new Date(data.coffeeLast)) === td ? data.coffeeLast : 0;
  if (today.cups > 0 && last) {
    const when = new Date(last + IDLE_MS), h = when.getHours();
    if (when.getTime() > now + 60_000 && h >= QUIET_TO && h < QUIET_FROM && iso(when) === td && today.mg < CAFFEINE_MAX)
      n += await add('next', when, t.coffeeTitleIdle, t.coffeeBodyIdle);
  }
  for (let k = 0; k < 3; k++) {
    const day = addDays(td, k);
    if (k === 0 && today.cups > 0) continue;
    const when = new Date(day + 'T00:00:00');
    when.setHours(Math.floor(cfg.at / 60), cfg.at % 60, 0, 0);
    if (when.getTime() <= now + 60_000) continue;
    n += await add(`m-${day}`, when, t.coffeeTitleMorning, t.coffeeBodyMorning);
  }
  return n;
}
