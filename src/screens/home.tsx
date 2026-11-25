import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { itemName, fmtDate, mealName } from '@/lib/backup';
import { addDays, cloneItem, dayMeals, dayTotals, guessMeal, mealTot, showExample, streak, targetOn, todayIso } from '@/lib/core';
import { cancelPhotoAI, openReview, shiftDay, tr, useApp } from '@/state/store';
import { Card, GeminiBadge, Icon, Ring, Row, T, XBtn } from '@/ui/kit';
import { useColors } from '@/ui/theme';

export function Header() {
  const { data } = useApp();
  const t = tr(), c = useColors(), n = streak(data);
  return (
    <Row between>
      <View>
        <T h={1}>{t.appName}</T>
        <T small muted>{t.authorLbl}: Tran Hong Quan</T>
      </View>
      <View accessibilityLabel={t.streakT(n)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: c.warnSoft }}>
        <Icon name="flame" size={16} color={c.warn} />
        <T bold style={{ color: c.warn, fontSize: 14 }}>{n}</T>
      </View>
    </Row>
  );
}

export default function Home() {
  const { data, viewDate, pending, lang } = useApp();
  const t = tr(), c = useColors();
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const tgt = targetOn(data, viewDate), tt = dayTotals(data, viewDate, viewDate), left = tgt - tt.k;
  const td = todayIso();
  const dateLbl = viewDate === td ? t.today : viewDate === addDays(td, -1) ? t.yesterday : fmtDate(lang, viewDate);
  const meals = dayMeals(data, viewDate, viewDate);
  const M: [keyof typeof tt, number, string, string][] = [
    ['p', (tgt * 0.2) / 4, c.protein, t.protein], ['c', (tgt * 0.5) / 4, c.carb, t.carb], ['f', (tgt * 0.3) / 9, c.fat, t.fat],
  ];
  const thumbBox = { width: 64, height: 64, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ gap: 14 }}>
      <Row between>
        <Pressable accessibilityLabel="Previous day" onPress={() => shiftDay(-1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 24 }}>‹</T></Pressable>
        <T bold>{dateLbl}</T>
        <Pressable accessibilityLabel="Next day" disabled={viewDate >= td} onPress={() => shiftDay(1)} style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center', opacity: viewDate >= td ? 0.25 : 1 }}><T style={{ fontSize: 24 }}>›</T></Pressable>
      </Row>

      <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }}>
        <View style={{ width: 196, height: 196 }}>
          <Ring size={196} r={84} width={14} frac={tt.k / tgt} color={left >= 0 ? c.accent : c.warn} track={c.line} />
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: 38, fontWeight: '700', color: left >= 0 ? c.fg : c.warn }}>{r0(Math.abs(left))}</T>
            <T small muted>{left >= 0 ? t.left : t.over}</T>
          </View>
        </View>
        <T small muted>{`${t.eaten} ${r0(tt.k)} · ${t.goal} ${r0(tgt)} kcal`}</T>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {M.map(([k, g, col, lbl]) => (
          <Card key={k} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 6 }}>
            <Ring size={54} r={22} width={6} frac={tt[k] / g} color={col} track={c.line} />
            <T bold style={{ fontSize: 15 }}>{`${r0(tt[k])}/${r0(g)}g`}</T>
            <T muted style={{ fontSize: 12 }}>{lbl}</T>
          </Card>
        ))}
      </View>

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
