// Bảng "So sánh với bạn bè": mã QR của tôi, quét / dán mã của bạn, biểu đồ 3 ngày đặt cạnh nhau.
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, Share, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { fmtDate } from '@/lib/backup';
import { captureAndShare } from '@/lib/share-image';
import { cardStats, encodeCard, myCard, NICK_MAX, rankAll, type FriendCard, type Ranked } from '@/lib/friend';
import { removeFriend, setFriendCode, setNick, toast, useApp, useT } from '@/state/store';
import { Btn, inputStyle, Note, Row, Seg, T } from '@/ui/kit';
import { useColors } from '@/ui/theme';

type Mode = 'mine' | 'scan' | 'rank';

export function FriendSheet() {
  const { friends } = useApp();
  const t = useT();
  const [mode, setMode] = useState<Mode>(friends.length ? 'rank' : 'mine');
  // đang xem so sánh chi tiết với một người (theo biệt danh)
  const [detail, setDetail] = useState<string | null>(null);
  const fr = detail ? friends.find((f) => f.n === detail) : undefined;
  return (
    <>
      <Seg items={[{ v: 'mine' as const, label: t.frMine }, { v: 'scan' as const, label: t.frScan }, ...(friends.length ? [{ v: 'rank' as const, label: t.frRank }] : [])]}
        value={mode} onChange={(m) => { setMode(m); setDetail(null); }} />
      {mode === 'mine' && <MyCode />}
      {mode === 'scan' && <Scan onDone={(n) => { toast(t.frAdded(n)); setMode('rank'); setDetail(null); }} />}
      {mode === 'rank' && (fr ? <Result friend={fr} onBack={() => setDetail(null)} /> : <Ranking onOpen={setDetail} />)}
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

function Scan({ onDone }: { onDone: (nick: string) => void }) {
  const t = useT(), c = useColors();
  const [perm, ask] = useCameraPermissions();
  const [txt, setTxt] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = (s: string) => {
    const card = setFriendCode(s);
    if (card) { setBad(false); onDone(card.n); return true; }
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

function Result({ friend, onBack }: { friend: FriendCard; onBack: () => void }) {
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
      <Btn full label={t.frBack} onPress={onBack} />
      <Btn full kind="warn" label={`${t.frRemove} ${frName}`} onPress={() => { removeFriend(friend.n); onBack(); }} />
    </>
  );
}

const MEDAL = ['🥇', '🥈', '🥉'];

function Ranking({ onOpen }: { onOpen: (nick: string) => void }) {
  const { data, today, nick, friends, lang } = useApp();
  const t = useT(), c = useColors();
  const me = myCard(data, today, nick.trim() || t.frMe);
  const list = rankAll(me, friends);
  const shot = useRef<ComponentRef<typeof View>>(null);
  const [img, setImg] = useState(false);
  const share = () => captureAndShare(shot, 1080, 1350, `calo-mon-viet-xep-hang-${today}.png`, t.frShareImg).catch(() => toast(t.frImgFail));
  return (
    <>
      <Podium list={list} />
      <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
        {list.map((x, i) => (
          <Pressable key={x.card.n + i} disabled={x.me} onPress={() => onOpen(x.card.n)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderTopWidth: i ? 1 : 0, borderColor: c.line, backgroundColor: x.me ? c.accentSoft : 'transparent' }}>
            <T style={{ width: 28, fontSize: i < 3 ? 18 : 14, fontWeight: '700', textAlign: 'center', color: c.muted }}>{i < 3 ? MEDAL[i] : String(i + 1)}</T>
            <View style={{ flex: 1 }}>
              <T bold numberOfLines={1}>{`${x.card.n}${x.me ? ' ' + t.frYou : ''}`}</T>
              <T muted style={{ fontSize: 11 }}>{`${Math.round(x.stats.avgK).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')} kcal/${lang === 'en' ? 'day' : 'ngày'} · ${Math.round(x.stats.avgPct * 100)}% · ${x.stats.fullDays}/3`}</T>
            </View>
            <T style={{ fontSize: 16, fontWeight: '700', color: c.accent }}>{x.stats.total}</T>
            {!x.me && <T muted style={{ fontSize: 18 }}>›</T>}
          </Pressable>
        ))}
      </View>
      <T muted style={{ fontSize: 11 }}>{t.cmpHint}</T>
      {friends.length === 0 && <Note>{t.frOnlyMe}</Note>}
      {!img ? <Btn full kind="pri" label={t.frMakeImg} onPress={() => setImg(true)} /> : (
        <>
          <View style={{ alignSelf: 'center', borderRadius: 12, overflow: 'hidden' }}>
            <View ref={shot} collapsable={false}><ShareImage list={list} from={list[0].card.days[0].d} to={today} /></View>
          </View>
          <T small muted style={{ textAlign: 'center' }}>{t.frImgHint}</T>
          <Btn full kind="pri" label={t.frShareImg} onPress={share} />
        </>
      )}
    </>
  );
}

/** Bục 3 bậc: hạng 2 – hạng 1 – hạng 3. */
function Podium({ list, img }: { list: Ranked[]; img?: boolean }) {
  const c = useColors(), t = useT();
  const order = [1, 0, 2].filter((i) => list[i]);
  // ảnh chia sẻ cao hơn để lấp khung 4:5
  const H = img ? [140, 104, 80] : [96, 70, 52];
  const fg = img ? '#ffffff' : c.fg, sub = img ? 'rgba(255,255,255,0.75)' : c.muted;
  const block = img ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.12)'] : [c.accent, c.accentSoft, c.accentSoft];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
      {order.map((i) => {
        const x = list[i];
        return (
          <View key={i} style={{ width: 100, alignItems: 'center', gap: 4 }}>
            <T style={{ fontSize: i === 0 ? 34 : 28 }}>{MEDAL[i]}</T>
            <T numberOfLines={2} style={{ fontSize: 13, fontWeight: '700', color: fg, maxWidth: 100, textAlign: 'center' }}>{x.card.n}</T>
            <T style={{ fontSize: 11, color: sub }}>{`${x.stats.total} ${t.frPtsShort}`}</T>
            <View style={{ width: '100%', height: H[i], borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: block[i], alignItems: 'center', paddingTop: 6 }}>
              <T style={{ fontSize: 22, fontWeight: '800', color: i === 0 && !img ? c.onAccent : fg }}>{i + 1}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Ảnh 4:5 để đăng mạng xã hội (vẽ 360×450, xuất 1080×1350). Màu cố định, không theo giao diện sáng/tối. */
function ShareImage({ list, from, to }: { list: Ranked[]; from: string; to: string }) {
  const { lang } = useApp();
  const t = useT();
  const d = (s: string) => fmtDate(lang, s).slice(0, 5);
  return (
    <View style={{ width: 360, height: 450, backgroundColor: '#0f6b4f', padding: 20, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.06)', top: -90, right: -80 }} />
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -50 }} />
      <T style={{ color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' }}>{`🏆 ${t.frRankTitle}`}</T>
      <T style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center', marginTop: 2 }}>{t.frRankSub(d(from), d(to))}</T>
      <View style={{ marginTop: 22 }}><Podium list={list} img /></View>
      <View style={{ marginTop: 12, gap: 4 }}>
        {list.slice(3, 7).map((x, k) => (
          <View key={x.card.n + k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <T style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', width: 18 }}>{String(k + 4)}</T>
            <T numberOfLines={1} style={{ color: '#ffffff', fontSize: 12, flex: 1 }}>{x.card.n}</T>
            <T style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>{`${x.stats.total} ${t.frPtsShort}`}</T>
          </View>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 14, alignItems: 'center', gap: 2 }}>
        <T style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8.5, textAlign: 'center' }}>{t.frImgFooter}</T>
        <T style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>{`🍜 ${t.frImgApp}`}</T>
      </View>
    </View>
  );
}
