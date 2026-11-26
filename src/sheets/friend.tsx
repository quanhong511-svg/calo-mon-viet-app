// Bảng "So sánh với bạn bè": mã QR của tôi, quét / dán mã của bạn, biểu đồ 3 ngày đặt cạnh nhau.
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Platform, Share, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { fmtDate } from '@/lib/backup';
import { cardStats, encodeCard, myCard, NICK_MAX, type FriendCard } from '@/lib/friend';
import { setFriendCode, setNick, useApp, useT } from '@/state/store';
import { Btn, inputStyle, Note, Row, Seg, T } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Mode = 'mine' | 'scan' | 'result';

export function FriendSheet() {
  const { friend } = useApp();
  const t = useT();
  const [mode, setMode] = useState<Mode>(friend ? 'result' : 'mine');
  return (
    <>
      <Seg items={[{ v: 'mine' as const, label: t.frMine }, { v: 'scan' as const, label: t.frScan }, ...(friend ? [{ v: 'result' as const, label: t.frResult }] : [])]}
        value={mode} onChange={setMode} />
      {mode === 'mine' && <MyCode />}
      {mode === 'scan' && <Scan onDone={() => setMode('result')} />}
      {mode === 'result' && friend && <Result friend={friend} onAgain={() => setMode('scan')} />}
    </>
  );
}

function MyCode() {
  const { data, today, nick } = useApp();
  const t = useT(), c = useColors();
  const code = nick.trim() ? encodeCard(myCard(data, today, nick)) : '';
  return (
    <>
      <View style={{ gap: 4 }}>
        <T small>{t.frNick}</T>
        <TextInput style={inputStyle(c)} value={nick} onChangeText={(v) => setNick(v.slice(0, NICK_MAX))} placeholder={t.frNickPh}
          placeholderTextColor={c.muted} maxLength={NICK_MAX} returnKeyType="done" accessibilityLabel={t.frNick} />
      </View>
      {code ? (
        <>
          <View style={{ alignSelf: 'center', padding: 14, borderRadius: 16, backgroundColor: '#ffffff' }}>
            <QRCode value={code} size={220} color="#16231d" backgroundColor="#ffffff" ecl="M" />
          </View>
          <T small muted style={{ textAlign: 'center' }}>{t.frShowHint}</T>
          <Btn full label={t.frSend} onPress={() => Share.share({ message: `${t.frSendMsg(nick.trim())}\n${code}` }).catch(() => {})} />
        </>
      ) : <Note>{t.frNeedNick}</Note>}
    </>
  );
}

function Scan({ onDone }: { onDone: () => void }) {
  const t = useT(), c = useColors();
  const [perm, ask] = useCameraPermissions();
  const [txt, setTxt] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = (s: string) => {
    if (setFriendCode(s)) { setBad(false); onDone(); return true; }
    setBad(true); return false;
  };
  const web = Platform.OS === 'web';
  return (
    <>
      {web ? <T small muted>{t.frCamWeb}</T> : perm?.granted ? (
        <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={busy ? undefined : ({ data }) => { setBusy(true); if (!accept(data)) setTimeout(() => setBusy(false), 1500); }} />
        </View>
      ) : (
        <>
          <T small>{t.frCamAsk}</T>
          <Btn full kind="pri" label={t.frCamBtn} onPress={() => ask()} />
        </>
      )}
      <TextInput style={[inputStyle(c), { minHeight: 70, textAlignVertical: 'top' }]} multiline value={txt} onChangeText={(v) => { setTxt(v); setBad(false); }}
        placeholder={t.frPastePh} placeholderTextColor={c.muted} autoCapitalize="none" autoCorrect={false} accessibilityLabel={t.frPastePh} />
      <Row style={{ flexWrap: 'nowrap' }}>
        <Btn label={t.frPaste} style={{ flex: 1 }} onPress={async () => { const s = await Clipboard.getStringAsync(); setTxt(s); accept(s); }} />
        <Btn kind="pri" label={t.frCompare} style={{ flex: 1 }} disabled={!txt.trim()} onPress={() => accept(txt)} />
      </Row>
      {bad && <Note>{t.frBad}</Note>}
    </>
  );
}

function Result({ friend, onAgain }: { friend: FriendCard; onAgain: () => void }) {
  const { data, today, nick, lang } = useApp();
  const t = useT(), c = useColors();
  const r0 = (n: number) => Math.round(n).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
  const me = myCard(data, today, nick.trim() || t.frMe);
  const a = cardStats(me), b = cardStats(friend);
  const meName = nick.trim() || t.frMe, frName = friend.n || '?';
  const COL = { me: c.accent, fr: c.water };
  const tie = Math.abs(a.total - b.total) < 5;
  // cao cột theo % mục tiêu calo, trần 150%
  const H = 120, cap = 1.5, bar = (k: number, tg: number) => Math.max(k > 0 ? 3 : 0, (Math.min(k / tg, cap) / cap) * H);
  const rows: { label: string; va: number; vb: number; fmt: (n: number) => string; better: 'high' | 'near100' }[] = [
    { label: t.frRows.total, va: a.total, vb: b.total, fmt: (n) => String(n), better: 'high' },
    { label: t.frRows.kcal, va: a.avgK, vb: b.avgK, fmt: (n) => `${r0(n)} kcal`, better: 'near100' },
    { label: t.frRows.pct, va: a.avgPct * 100, vb: b.avgPct * 100, fmt: (n) => `${r0(n)}%`, better: 'near100' },
    { label: t.frRows.p, va: a.avgP, vb: b.avgP, fmt: (n) => `${r0(n)} g`, better: 'high' },
    { label: t.frRows.w, va: a.avgW, vb: b.avgW, fmt: (n) => `${r0(n)} ml`, better: 'high' },
    { label: t.frRows.full, va: a.fullDays, vb: b.fullDays, fmt: (n) => `${n}/3`, better: 'high' },
  ];
  // hàng calo: tốt hơn là gần mục tiêu hơn (dùng % mục tiêu của từng người)
  const win = (r: (typeof rows)[number]): 0 | 1 | 2 => {
    if (r.better === 'near100') {
      const da = Math.abs(a.avgPct - 1), db = Math.abs(b.avgPct - 1);
      return Math.abs(da - db) < 0.02 ? 0 : da < db ? 1 : 2;
    }
    return r.va === r.vb ? 0 : r.va > r.vb ? 1 : 2;
  };
  return (
    <>
      <View style={{ alignItems: 'center', gap: 2, padding: 12, borderRadius: 14, backgroundColor: c.accentSoft }}>
        <T style={{ fontSize: 20, fontWeight: '700', color: c.accent, textAlign: 'center' }}>{tie ? t.frTie : t.frWin(a.total > b.total ? meName : frName)}</T>
        <T small muted>{`${meName} ${t.frPts(a.total, b.total)} ${frName}`}</T>
      </View>
      <Row style={{ gap: 14, justifyContent: 'center' }}>
        {[[meName, COL.me], [frName, COL.fr]].map(([n, col]) => (
          <Row key={n + col} style={{ gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: col }} /><T small bold>{n}</T></Row>
        ))}
      </Row>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((i) => {
          const x = me.days[i], y = friend.days[i];
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ height: H, width: '100%', justifyContent: 'flex-end' }}>
                {/* vạch mục tiêu (100%) */}
                <View style={{ position: 'absolute', left: 4, right: 4, bottom: H / cap - 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.muted }} />
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6 }}>
                  {[[x, COL.me], [y, COL.fr]].map(([d, col], j) => {
                    const dd = d as FriendCard['days'][number];
                    return (
                      <View key={j} style={{ alignItems: 'center', gap: 2 }}>
                        <T style={{ fontSize: 10, fontWeight: '700', color: col as string }}>{dd.k ? dd.s : '–'}</T>
                        <View style={{ width: 22, height: bar(dd.k, dd.t), borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: col as string }} />
                      </View>
                    );
                  })}
                </View>
              </View>
              <T small bold>{t.frSlots[i]}</T>
              <T muted style={{ fontSize: 10 }}>{`${r0(x.k)} · ${r0(y.k)} kcal`}</T>
            </View>
          );
        })}
      </View>
      <T muted style={{ fontSize: 11, textAlign: 'center' }}>{`${t.frLegendT} · ${t.cmpHint}`}</T>
      <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
        <Row between style={{ flexWrap: 'nowrap', padding: 10, backgroundColor: c.bg }}>
          <T small muted style={{ flex: 1.3 }}> </T>
          <T small bold numberOfLines={1} style={{ flex: 1, textAlign: 'right', color: COL.me }}>{meName}</T>
          <T small bold numberOfLines={1} style={{ flex: 1, textAlign: 'right', color: COL.fr }}>{frName}</T>
        </Row>
        {rows.map((r) => {
          const w = win(r);
          return (
            <Row key={r.label} between style={{ flexWrap: 'nowrap', padding: 10, borderTopWidth: 1, borderColor: c.line }}>
              <T small style={{ flex: 1.3 }}>{r.label}</T>
              <T small style={{ flex: 1, textAlign: 'right', fontWeight: w === 1 ? '700' : '400' }}>{`${w === 1 ? '✓ ' : ''}${r.fmt(r.va)}`}</T>
              <T small style={{ flex: 1, textAlign: 'right', fontWeight: w === 2 ? '700' : '400' }}>{`${w === 2 ? '✓ ' : ''}${r.fmt(r.vb)}`}</T>
            </Row>
          );
        })}
      </View>
      {friend.at !== today && <T small muted>{t.frOld(frName, fmtDate(lang, friend.at))}</T>}
      <Btn full label={t.frAgain} onPress={onAgain} />
    </>
  );
}
