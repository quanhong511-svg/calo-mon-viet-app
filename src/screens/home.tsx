import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { itemName, fmtDate, mealName } from '@/lib/backup';
import { CAFFEINE_MAX, COFFEE_ICON, COFFEE_KINDS, coffeeDay } from '@/lib/coffee';
import { cheersFor } from '@/lib/cheers';
import { compareDays, type DayScore } from '@/lib/compare';
import { addDays, cloneItem, dayMeals, dayTotals, guessMeal, macroSplit, macroTargets, mealTot, showExample, streak, targetOn } from '@/lib/core';
import { remindersSupported } from '@/lib/water';
import { addCoffee, addWater, toggleCompare, cancelPhotoAI, mealRemindOf, openReview, openSheet, setMealRemind, shiftDay, useApp, useT, waterCfgOf } from '@/state/store';
import { Btn, Card, GeminiBadge, Icon, Ring, Row, T, XBtn } from '@/ui/kit';
import { useColors } from '@/ui/theme';

export function Header() {
  const { data, today } = useApp();
  const t = useT(), c = useColors(), n = streak(data), cheers = cheersFor(data, today).length;
  return (
    <Row between>
      <Pressable accessibilityRole="button" accessibilityHint={t.chTap} onPress={() => openSheet('cheers')} hitSlop={6}>
        <Row style={{ gap: 6 }}>
          <T h={1}>{t.appName}</T>
          {cheers > 0 && (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: c.accentSoft }}>
              <T style={{ fontSize: 12, fontWeight: '700', color: c.accent }}>{`🎉 ${cheers}`}</T>
            </View>
          )}
        </Row>
        <T small muted>{t.authorLbl}: Tran Hong Quan</T>
      </Pressable>
      <View accessibilityLabel={t.streakT(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.warnSoft }}>
        <Icon name="flame" size={16} color={c.warn} />
        <T bold style={{ color: c.warn, fontSize: 14 }}>{n}</T>
      </View>
    </Row>
  );
}

/** kích thước biểu đồ vòng gộp và [chỉ số, bán kính, độ dày] của từng vòng, từ ngoài vào trong */
const RING = 150;
const RINGS = [['k', 68, 12], ['p', 54, 9], ['c', 42, 9], ['f', 30, 9]] as const;

export default function Home() {
  const { data, viewDate, pending, lang, today: td } = useApp();
  const t = useT(), c = useColors();
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const tgt = targetOn(data, viewDate), tt = dayTotals(data, viewDate, viewDate), left = tgt - tt.k;
  const dateLbl = viewDate === td ? t.today : viewDate === addDays(td, -1) ? t.yesterday : fmtDate(lang, viewDate);
  const meals = dayMeals(data, viewDate, viewDate);
  const mt = macroTargets(data, viewDate);
  const M: [keyof typeof tt, number, string, string][] = [
    ['p', mt.p, c.protein, t.protein], ['c', mt.c, c.carb, t.carb], ['f', mt.f, c.fat, t.fat],
  ];
  const thumbBox = { width: 64, height: 64, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ gap: 14 }}>
      <Row between>
        <Pressable accessibilityLabel="Previous day" onPress={() => shiftDay(-1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 24 }}>‹</T></Pressable>
        <T bold>{dateLbl}</T>
        <Pressable accessibilityLabel="Next day" disabled={viewDate >= td} onPress={() => shiftDay(1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center', opacity: viewDate >= td ? 0.25 : 1 }}><T style={{ fontSize: 24 }}>›</T></Pressable>
      </Row>

      <Pressable accessibilityRole="button" accessibilityHint={t.mcTap} onPress={() => openSheet('macros')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 }}>
          {/* vòng ngoài: calo; trong: đạm, tinh bột, chất béo */}
          <View style={{ width: RING, height: RING }}>
            {RINGS.map(([key, r, w], i) => {
              const goal = key === 'k' ? tgt : M[i - 1][1], col = key === 'k' ? (left >= 0 ? c.accent : c.warn) : M[i - 1][2];
              return (
                <View key={key} style={{ position: 'absolute', inset: 0 }}>
                  <Ring size={RING} r={r} width={w} frac={goal ? tt[key] / goal : 0} color={col} track={col} trackOpacity={0.16} />
                </View>
              );
            })}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontSize: 15, fontWeight: '700', color: left >= 0 ? c.fg : c.warn }}>{`${Math.round((tt.k / tgt) * 100)}%`}</T>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <View>
              <Row style={{ gap: 6, alignItems: 'baseline' }}>
                <T style={{ fontSize: 30, fontWeight: '700', color: left >= 0 ? c.fg : c.warn }}>{r0(Math.abs(left))}</T>
                <T small muted>{left >= 0 ? t.left : t.over}</T>
              </Row>
              <T muted style={{ fontSize: 12 }}>{`${t.eaten} ${r0(tt.k)} / ${r0(tgt)} kcal`}</T>
            </View>
            {M.map(([k, g, col, lbl]) => {
              const over = g > 0 && tt[k] > g * 1.1;
              return (
                <View key={k} style={{ gap: 3 }}>
                  <Row between style={{ flexWrap: 'nowrap' }}>
                    <Row style={{ gap: 6, flexShrink: 1, flexWrap: 'nowrap' }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: col }} />
                      <T numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>{lbl}</T>
                    </Row>
                    <T style={{ fontSize: 13, fontWeight: '700', color: over ? c.warn : c.fg }}>{`${r0(tt[k])}/${r0(g)}g`}</T>
                  </Row>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(100, g ? (tt[k] / g) * 100 : 0)}%`, height: '100%', backgroundColor: col }} />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </Pressable>

      <WaterCard />

      <CoffeeCard />

      <CompareCard />

      <Pressable accessibilityRole="button" onPress={() => openSheet('advice')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="sparkle" size={22} color={c.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <T bold>{t.adEntry}</T>
            <T muted style={{ fontSize: 12 }}>{t.adEntryD}</T>
          </View>
          <T muted style={{ fontSize: 22 }}>›</T>
        </Card>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => openSheet('friend')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T style={{ fontSize: 22 }}>👥</T>
          <View style={{ flex: 1, gap: 2 }}>
            <T bold>{t.frEntry.replace(/^👥 /, '')}</T>
            <T muted style={{ fontSize: 12 }}>{t.frEntryD}</T>
          </View>
          <T muted style={{ fontSize: 22 }}>›</T>
        </Card>
      </Pressable>

      <Row between><T h={2}>{t.mealsTitle}</T>{showExample(data, viewDate) && <T small muted style={{ flexShrink: 1 }}>{t.exNote}</T>}</Row>

      <View style={{ gap: 10 }}>
        {pending && viewDate === td && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
            <Image source={{ uri: pending.photo }} style={thumbBox} />
            <View style={{ flex: 1 }}><T bold>{t.analyzing}</T><T small muted>{t.meals[guessMeal()]}</T></View>
            <ActivityIndicator color={c.accent} />
            <XBtn onPress={() => cancelPhotoAI()} label={t.cancelAi} />
          </Card>
        )}
        {meals.map((m) => {
          const s = mealTot(m);
          const sv = Number(m.servings) || 1;
          return (
            <Pressable key={m.id} accessibilityRole="button"
              onPress={() => m.example
                ? openReview({ items: m.items.map(cloneItem), meal: m.meal as number })
                : openReview({ mealId: m.id, items: m.items.map(cloneItem), servings: sv, meal: typeof m.meal === 'number' ? m.meal : 3, photo: m.photo || null, source: m.source })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                {m.photo ? <Image source={{ uri: m.photo }} style={thumbBox} /> : <View style={thumbBox}><Icon name="bowl" size={28} color={c.accent} /></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T bold numberOfLines={1}>{m.items.map((it) => itemName(lang, it)).join(', ')}</T>
                  <Row style={{ gap: 5 }}>
                    {m.source === 'Gemini' && <GeminiBadge compact label={t.fromGemini} />}
                    <T muted style={{ fontSize: 12, flexShrink: 1 }}>{`${mealName(t, m.meal)} · ${m.time}${m.example ? ` · ${t.example.toUpperCase()}` : ''}${sv !== 1 ? ` · ×${sv}` : ''}`}</T>
                  </Row>
                  <Row style={{ gap: 10, marginTop: 2 }}>
                    {([['p', c.protein], ['c', c.carb], ['f', c.fat]] as const).map(([k, col]) => (
                      <Row key={k} style={{ gap: 3 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} /><T muted style={{ fontSize: 12 }}>{r0(s[k])}g</T></Row>
                    ))}
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end' }}><T style={{ fontWeight: '700' }}>{r0(s.k)}</T><T muted style={{ fontSize: 11 }}>kcal</T></View>
              </Card>
            </Pressable>
          );
        })}
        {!meals.length && !pending && (
          <View style={{ padding: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, borderRadius: 16 }}><T muted style={{ textAlign: 'center' }}>{t.emptyMeals}</T></View>
        )}
      </View>
    </View>
  );
}

function WaterCard() {
  const { data, viewDate, lang } = useApp();
  const t = useT(), c = useColors();
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const ml = data.water?.[viewDate] || 0, goal = waterCfgOf(data).goal, cups = 8, per = goal / cups;
  const done = ml >= goal;
  return (
    <Card style={{ gap: 10 }}>
      <Row between>
        <Row style={{ gap: 6 }}><Icon name="drop" size={20} color={c.water} /><T h={3}>{t.water}</T></Row>
        <T small style={{ color: done ? c.accent : c.muted }}>{done ? t.waterDone : `${r0(ml)} / ${r0(goal)} ml · ${t.waterLeft(r0(goal - ml))}`}</T>
      </Row>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${r0(ml)} / ${r0(goal)} ml`}>
        {Array.from({ length: cups }, (_, i) => {
          const fill = Math.min(1, Math.max(0, (ml - i * per) / per));
          return (
            <View key={i} style={{ flex: 1, height: 26, borderRadius: 6, backgroundColor: c.waterSoft, overflow: 'hidden', justifyContent: 'flex-end' }}>
              <View style={{ height: `${fill * 100}%`, backgroundColor: c.water }} />
            </View>
          );
        })}
      </View>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Btn small label="+250 ml" onPress={() => addWater(250)} style={{ flex: 1 }} />
        <Btn small label="+500 ml" onPress={() => addWater(500)} style={{ flex: 1 }} />
        <Btn small label="−" onPress={() => addWater(-250)} disabled={!ml} style={{ width: 52 }} />
      </Row>
    </Card>
  );
}

function CompareCard() {
  const { data, viewDate, lang, today: td, cmpHidden, hour: hr } = useApp();
  const t = useT(), c = useColors();
  const cmp = compareDays(data, viewDate);
  if (!cmp) return null;
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const lbl = (d: string) => (d === td ? t.today : d === addDays(td, -1) ? t.yesterday : fmtDate(lang, d).slice(0, 5));
  const { days, best } = cmp;
  const cur = days[2];
  const scoreCol = (s: number) => (s >= 80 ? c.accent : s >= 50 ? c.fg : c.warn);

  // gợi ý: tối đa 3 dòng
  const tips: string[] = [];
  if (best) {
    const why = [best.parts.energy >= 40 && t.cmpWhyEnergy, best.main.every(Boolean) && t.cmpWhyMeals, best.parts.macro >= 15 && t.cmpWhyMacro].filter(Boolean).join(', ');
    tips.push(t.cmpBest(lbl(best.d), best.score) + (why ? ` · ${why}` : ''));
  }
  // bữa chính còn thiếu của ngày đang xem; với hôm nay chỉ nhắc bữa đã qua giờ (sáng 10h, trưa 14h, tối 20h)
  const missing = cur.main.map((ok, i) => (!ok && (viewDate !== td || hr >= [10, 14, 20][i]) ? t.meals[i] : null)).filter(Boolean) as string[];
  if (missing.length) tips.push(t.cmpMissing(lbl(viewDate), missing.join(', ').toLowerCase()));
  if (cur.logged) {
    const diff = cur.tot.k - cur.tgt;
    if (diff > cur.tgt * 0.1) tips.push(t.cmpOver(lbl(viewDate), r0(diff)));
    else if (viewDate === td && diff < -cur.tgt * 0.1) tips.push(t.cmpLeft(r0(-diff)));
    else if (viewDate !== td && diff < -cur.tgt * 0.1) tips.push(t.cmpUnder(lbl(viewDate), r0(-diff)));
    else if (best && best.d !== viewDate && Math.abs(cur.tot.k - best.tot.k) >= 100) tips.push(t.cmpVsBest(cur.tot.k > best.tot.k, r0(Math.abs(cur.tot.k - best.tot.k)), lbl(best.d)));
    const e = cur.tot.p * 4 + cur.tot.c * 4 + cur.tot.f * 9;
    if (e > 0 && tips.length < 3) {
      const sp = macroSplit(data, viewDate);
      const dev = (['p', 'c', 'f'] as const).map((k) => [k, (cur.tot[k] * (k === 'f' ? 9 : 4)) / e - sp[k]] as const)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      if (Math.abs(dev[1]) > 0.08) tips.push(t.cmpMacro({ p: t.protein, c: t.carb, f: t.fat }[dev[0]], dev[1] < 0));
    }
  }
  if (tips.length === 1 && best?.d === viewDate && best.score >= 80) tips.push(t.cmpGood);

  return (
    <Card style={{ gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: !cmpHidden }} accessibilityLabel={`${t.cmpTitle}, ${cmpHidden ? t.cmpShow : t.cmpHide}`}
        onPress={toggleCompare} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="chart" size={20} color={c.accent} /><T h={3} style={{ flex: 1 }}>{t.cmpTitle}</T>
        <T small muted>{cmpHidden ? t.cmpShow : t.cmpHide}</T>
        <T muted style={{ fontSize: 16, transform: [{ rotate: cmpHidden ? '0deg' : '180deg' }] }}>⌄</T>
      </Pressable>
      {cmpHidden ? (
        <T small muted numberOfLines={1}>{`${lbl(viewDate)}: ${cur.logged ? `${cur.score} ${t.cmpPts}` : t.cmpNone}${best && best.d !== viewDate ? ` · ★ ${lbl(best.d)} ${best.score} ${t.cmpPts}` : ''}`}</T>
      ) : (<>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {days.map((x) => <DayCol key={x.d} x={x} label={lbl(x.d)} best={best?.d === x.d} col={scoreCol(x.score)} r0={r0} />)}
      </View>
      <View style={{ gap: 6 }}>
        {tips.slice(0, 3).map((s, i) => (
          <Row key={i} style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <T style={{ color: i === 0 && best ? c.accent : c.warn, fontSize: 14, lineHeight: 20 }}>{i === 0 && best ? '★' : '•'}</T>
            <T small style={{ flex: 1, lineHeight: 20 }}>{s}</T>
          </Row>
        ))}
      </View>
      <T muted style={{ fontSize: 11 }}>{t.cmpHint}</T>
      {remindersSupported && !mealRemindOf(data).on && (
        <Btn small label={t.mrEnable} onPress={() => setMealRemind({ on: true })} />
      )}
      </>)}
    </Card>
  );
}

function DayCol({ x, label, best, col, r0 }: { x: DayScore; label: string; best: boolean; col: string; r0: (n: number) => string }) {
  const t = useT(), c = useColors();
  return (
    <View accessibilityLabel={`${label}: ${x.logged ? `${x.score} ${t.cmpPts}, ${r0(x.tot.k)} / ${r0(x.tgt)} kcal` : t.cmpNone}`}
      style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, borderWidth: best ? 1.5 : 1, borderColor: best ? c.accent : c.line, backgroundColor: best ? c.accentSoft : c.bg }}>
      <T small bold numberOfLines={1}>{best ? `★ ${label}` : label}</T>
      {x.logged ? (
        <>
          <T style={{ fontSize: 24, fontWeight: '700', color: col }}>{x.score}<T muted style={{ fontSize: 11, fontWeight: '400' }}>{' ' + t.cmpPts}</T></T>
          <T muted style={{ fontSize: 11 }}>{`${r0(x.tot.k)}/${r0(x.tgt)}`}</T>
          <View style={{ width: '80%', height: 5, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (x.tot.k / x.tgt) * 100)}%`, height: '100%', backgroundColor: x.tot.k > x.tgt * 1.1 ? c.warn : c.accent }} />
          </View>
          <Row style={{ gap: 4, marginTop: 2 }}>
            {x.main.map((ok, i) => (
              <View key={i} style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? c.accent : 'transparent', borderWidth: 1, borderColor: ok ? c.accent : c.line }}>
                <T style={{ fontSize: 10, fontWeight: '700', color: ok ? c.onAccent : c.muted }}>{t.cmpAbbr[i]}</T>
              </View>
            ))}
          </Row>
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', minHeight: 70 }}><T muted small>{t.cmpNone}</T></View>
      )}
    </View>
  );
}

function CoffeeCard() {
  const { data, viewDate, lang } = useApp();
  const t = useT(), c = useColors();
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const day = coffeeDay(data, viewDate), high = day.mg > CAFFEINE_MAX;
  return (
    <Card style={{ gap: 10 }}>
      <Row between>
        <Row style={{ gap: 6 }}><Icon name="coffee" size={20} color={c.coffee} /><T h={3}>{t.coffee}</T></Row>
        <T small style={{ color: high ? c.warn : c.muted }}>{day.cups ? t.coffeeSum(day.cups, r0(day.mg)) : t.coffeeNone}</T>
      </Row>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {COFFEE_KINDS.map((k) => {
          const n = day.counts[k] || 0;
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${t.coffeeTypes[k]}: ${n}`} accessibilityHint={t.coffeeHint}
              onPress={() => addCoffee(k, 1)} onLongPress={() => addCoffee(k, -1)} delayLongPress={350}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 2, borderRadius: 12, borderWidth: 1,
                borderColor: n ? c.coffee : c.line, backgroundColor: n ? c.coffeeSoft : c.bg, opacity: pressed ? 0.75 : 1 })}>
              <Icon name={COFFEE_ICON[k]} size={28} color={c.coffee} strokeWidth={1.8} />
              <T numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: c.fg }}>{t.coffeeTypes[k]}</T>
              <T style={{ fontSize: 15, fontWeight: '700', color: n ? c.coffee : c.muted }}>{n}</T>
            </Pressable>
          );
        })}
      </View>
      <T muted style={{ fontSize: 11 }}>{high ? t.coffeeHigh : t.coffeeHint}</T>
    </Card>
  );
}
