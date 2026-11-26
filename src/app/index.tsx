import { useEffect } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Home, { Header } from '@/screens/home';
import Progress from '@/screens/progress';
import Settings from '@/screens/settings';
import Sheets from '@/sheets/sheets';
import { setupNotifications } from '@/lib/water';
import { backupNag, checkDay, goTab, openSheet, rescheduleWater, set, tr, useApp, type Tab } from '@/state/store';
import { Icon, MAXW, useKeyboardScroll } from '@/ui/kit';
import { useColors } from '@/ui/theme';

function TabBtn({ id, icon, label, tab }: { id: Tab; icon: 'home' | 'chart' | 'gear'; label: string; tab: Tab }) {
  const c = useColors();
  const on = tab === id, col = on ? c.accent : c.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTab(id)}
      style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, minHeight: 52 }}>
      <Icon name={icon} color={col} />
      <Text style={{ color: col, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const { tab, toast, sheet } = useApp();
  const c = useColors(), ins = useSafeAreaInsets(), t = tr();
  // bảng trượt tự lo phần bàn phím của nó
  const { kb, ref: scroll, onScroll } = useKeyboardScroll(!sheet);

  useEffect(() => {
    const nag = setTimeout(backupNag, 1500);
    setupNotifications().then(() => rescheduleWater(1000));
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { checkDay(); rescheduleWater(); } });
    const iv = setInterval(checkDay, 60000);
    return () => { clearTimeout(nag); sub.remove(); clearInterval(iv); };
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [tab, scroll]);


  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: ins.top + 12, paddingBottom: Math.max(110 + ins.bottom, kb + 24), paddingLeft: Math.max(16, ins.left), paddingRight: Math.max(16, ins.right) }}>
        <View style={{ width: '100%', maxWidth: MAXW, alignSelf: 'center', gap: 14 }}>
          <Header />
          {tab === 'home' && <Home />}
          {tab === 'progress' && <Progress />}
          {tab === 'settings' && <Settings />}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6, paddingBottom: 8 + ins.bottom, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', width: '100%', maxWidth: MAXW, alignSelf: 'center' }}>
          <TabBtn id="home" icon="home" label={t.navHome} tab={tab} />
          <View style={{ width: 88, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.addTitle} onPress={() => openSheet('add')}
              style={({ pressed }) => ({
                width: 64, height: 64, marginTop: -26, borderRadius: 32, borderWidth: 4, borderColor: c.bg, backgroundColor: c.accent,
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
                shadowColor: '#0f6b4f', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 6,
              })}>
              <Icon name="plus" size={30} color={c.onAccent} strokeWidth={2.6} />
            </Pressable>
          </View>
          <TabBtn id="progress" icon="chart" label={t.navProgress} tab={tab} />
          <TabBtn id="settings" icon="gear" label={t.navSettings} tab={tab} />
        </View>
      </View>

      {toast && (
        <Pressable onPress={() => { set({ toast: null }); toast.onTap?.(); }}
          style={{ position: 'absolute', alignSelf: 'center', bottom: 92 + ins.bottom, maxWidth: '92%', backgroundColor: c.fg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, elevation: 8 }}>
          <Text style={{ color: c.bg, fontSize: 15, fontWeight: '500' }}>{toast.msg}</Text>
        </Pressable>
      )}

      <Sheets />
    </View>
  );
}
