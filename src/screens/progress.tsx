import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fmtDate } from '@/lib/backup';
import { buildTrend, chartScale, topRounded, type Bar } from '@/lib/trend';
import { exportTrendPdf, openDay, setRange, tr, useApp } from '@/state/store';
import { Btn, Card, Row, Seg, T } from '@/ui/kit';
import { useColors } from '@/ui/theme';

export default function Progress() {
  const { data, range, viewDate, lang, busy } = useApp();
  const t = tr(), c = useColors();
  const [W, setW] = useState(320);
  const [tip, setTip] = useState(-1);
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const shortDate = (s: string) => { const [, m, d] = s.split('-'); return lang === 'en' ? `${+m}/${+d}` : `${+d}/${+m}`; };

  const { bars, logged, avg, over } = buildTrend(data, range, viewDate);
  const N = bars.length, H = 220, isSel = (x: Bar) => viewDate >= x.d && viewDate <= x.d2;
  const ml = 40, mr = 8, mt = 14, mb = 24, pw = W - ml - mr, ph = H - mt - mb;
  const { step, top } = chartScale(bars);
  const y = (v: number) => mt + ph - (v / top) * ph, bw = pw / N, barW = Math.max(5, Math.min(30, bw * 0.62)), every = N <= 7 ? 1 : N <= 14 ? 2 : 5;
  const grid = []; for (let v = 0; v <= top; v += step) grid.push(v);
  let goalPath = ''; bars.forEach((x, i) => { goalPath += `${i ? 'L' : 'M'}${ml + bw * i},${y(x.tg)}H${ml + bw * (i + 1)}`; });
  const tl = bars[N - 1].tg;

  const tap = (i: number) => { if (tip !== i) { setTip(i); return; } setTip(-1); openDay(bars[i].d2); };
  const tb = tip >= 0 ? bars[tip] : null;
  const legend: [string, string, boolean?][] = [[c.carb, t.carb], [c.fat, t.fat], [c.protein, t.protein], [c.fg, t.legendTarget, true]];

  return (
    <Card style={{ gap: 12 }}>
      <Row between><T h={2}>{t.trendTitle}</T>
        <Seg small items={[7, 14, 30, 90].map((v) => ({ v, label: `${v} ${t.days}` }))} value={range} onChange={(v) => { setTip(-1); setRange(v); }} />
      </Row>
      <Row style={{ gap: 14 }}>
        {legend.map(([col, lbl, dash]) => (
          <Row key={lbl} style={{ gap: 6 }}>
            <View style={dash ? { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: col } : { width: 10, height: 10, borderRadius: 3, backgroundColor: col }} />
            <T muted style={{ fontSize: 13 }}>{lbl}</T>
          </Row>
        ))}
      </Row>
      <View onLayout={(e) => setW(Math.max(280, Math.round(e.nativeEvent.layout.width)))}>
        <Svg width={W} height={H}>
          {grid.map((v) => (
            <Line key={'g' + v} x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} stroke={c.line} />
          ))}
          {grid.map((v) => (
            <SvgText key={'l' + v} x={ml - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill={c.muted}>{r0(v)}</SvgText>
          ))}
          {bars.map((x, i) => {
            const cx = ml + bw * i + bw / 2, x0 = cx - barW / 2, els = [];
            if (isSel(x) || tip === i) els.push(<Rect key="s" x={ml + bw * i + 1} y={mt} width={bw - 2} height={ph} rx={6} fill={c.accentSoft} />);
            if (x.k > 0) {
              const mk = x.c * 4 + x.f * 9 + x.p * 4 || 1;
              const segs = ([[x.c * 4, c.carb], [x.f * 9, c.fat], [x.p * 4, c.protein]] as [number, string][]).filter((s) => s[0] > 0);
              let base = 0;
              segs.forEach((s, j) => {
                const v = (s[0] / mk) * x.k, yT = y(base + v), yB = y(base) - (j > 0 ? 2 : 0), h = Math.max(0, yB - yT);
                if (h > 0) els.push(j === segs.length - 1
                  ? <Path key={'b' + j} d={topRounded(x0, yT, barW, h, 4)} fill={s[1]} />
                  : <Rect key={'b' + j} x={x0} y={yT} width={barW} height={h} fill={s[1]} />);
                base += v;
              });
              if (isSel(x)) els.push(<SvgText key="v" x={Math.min(Math.max(cx, ml + 18), W - mr - 18)} y={Math.max(11, y(x.k) - 5)} textAnchor="middle" fontSize={11} fontWeight="600" fill={c.fg}>{r0(x.k)}</SvgText>);
            }
            if ((N - 1 - i) % every === 0) els.push(<SvgText key="d" x={Math.min(Math.max(cx, ml + 14), W - mr - 14)} y={H - 6} textAnchor="middle" fontSize={11} fill={isSel(x) ? c.fg : c.muted}>{shortDate(x.d)}</SvgText>);
            return <G key={x.d}>{els}</G>;
          })}
          <Path d={goalPath} fill="none" stroke={c.fg} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.75} />
          <SvgText x={W - mr} y={Math.max(11, y(tl) - 5)} textAnchor="end" fontSize={11} fill={c.fg}>{`${t.legendTarget} ${r0(tl)}`}</SvgText>
          {!logged.length && <SvgText x={ml + pw / 2} y={mt + ph / 2} textAnchor="middle" fontSize={13} fill={c.muted}>{t.noTrend}</SvgText>}
        </Svg>
        {bars.map((x, i) => (
          <Pressable key={'h' + x.d} accessibilityRole="button" accessibilityLabel={x.d} onPress={() => tap(i)}
            style={{ position: 'absolute', left: ml + bw * i, top: mt, width: bw, height: ph + mb }} />
        ))}
        {tb && (
          <View pointerEvents="none" style={{
            position: 'absolute', top: 4, left: Math.max(0, Math.min(ml + bw * tip + bw / 2 + 12 > W - 170 ? ml + bw * tip + bw / 2 - 170 - 12 : ml + bw * tip + bw / 2 + 12, W - 170)),
            width: 170, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 8, gap: 2,
            shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, elevation: 4,
          }}>
            <T bold style={{ fontSize: 13 }}>{tb.week ? `${t.week} ${shortDate(tb.d)}–${shortDate(tb.d2)}` : fmtDate(lang, tb.d)}</T>
            {([
              [tb.week ? t.weekAvg : 'kcal', r0(tb.k)],
              ...(tb.week ? [[t.loggedLbl, `${tb.n}/7`]] : []),
              [t.legendTarget, r0(tb.tg)], [t.carb, `${r0(tb.c)} g`], [t.fat, `${r0(tb.f)} g`], [t.protein, `${r0(tb.p)} g`],
            ] as [string, string][]).map(([a, b]) => (
              <Row key={a} between style={{ flexWrap: 'nowrap' }}><T muted style={{ fontSize: 12, flexShrink: 1 }}>{a}</T><T style={{ fontSize: 12 }}>{b}</T></Row>
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([[r0(avg), t.avgLbl], [`${logged.length}/${range}`, t.loggedLbl], [String(over), t.overLbl]] as const).map(([v, l]) => (
          <Card key={l} style={{ flex: 1, padding: 10 }}><T style={{ fontSize: 19, fontWeight: '700' }}>{v}</T><T muted style={{ fontSize: 12 }}>{l}</T></Card>
        ))}
      </View>
      <T small muted>{t.tapHint}</T>
      <Btn full label={busy ? '…' : t.exportPdf} disabled={busy || !logged.length} onPress={exportTrendPdf} />
    </Card>
  );
}
