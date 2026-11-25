// Lưu dữ liệu trên máy: điện thoại dùng SQLite (không giới hạn 5 MB như trình duyệt), web dùng localStorage.
import { Platform } from 'react-native';

type KV = { getItemSync(k: string): string | null; setItemSync(k: string, v: string): void };

let kv: KV;
if (Platform.OS === 'web') {
  kv = {
    getItemSync: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItemSync: (k, v) => localStorage.setItem(k, v),
  };
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  kv = require('expo-sqlite/kv-store').default as KV;
}

export const store = {
  get<T>(k: string): T | null {
    try { const v = kv.getItemSync(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  },
  set(k: string, v: unknown): boolean {
    try { kv.setItemSync(k, JSON.stringify(v)); return true; } catch { return false; }
  },
};
