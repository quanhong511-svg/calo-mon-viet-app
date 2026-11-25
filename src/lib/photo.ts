// Chuẩn bị ảnh (ảnh gửi AI, ảnh thu nhỏ, ảnh 224×224 cho mô hình) và chạy mô hình nhận diện trên máy.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { Platform } from 'react-native';

import FoodNet from './foodnet';
import { byId, FOOD_CLASS_ID } from './foods';

export type Photo = { uri: string; dataUrl: string; b64: string; thumb: string; px: Uint8Array | null };
type Net = { size: number; classes: string[]; acc?: { top1: number; top5: number } };

async function bytesOf(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

export async function prepPhoto(uri: string): Promise<Photo> {
  const base = await ImageManipulator.manipulate(uri).renderAsync();
  const W = base.width, H = base.height;
  // 1) ảnh gửi AI: cạnh dài tối đa 768 (đủ để nhận món, gửi nhanh hơn nhiều so với 1280)
  const s = Math.min(1, 768 / Math.max(W, H));
  const mainCtx = ImageManipulator.manipulate(uri);
  if (s < 1) mainCtx.resize({ width: Math.round(W * s), height: Math.round(H * s) });
  const main = await (await mainCtx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  // 2) ảnh thu nhỏ 320×211 cắt giữa (lưu kèm nhật ký)
  const side = Math.min(W, H), sw = side, sh = side * 0.66;
  const thumb = await (await ImageManipulator.manipulate(uri)
    .crop({ originX: (W - sw) / 2, originY: (H - sh) / 2, width: sw, height: sh })
    .resize({ width: 320, height: Math.round(320 * 0.66) }).renderAsync()).saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  // 3) ảnh 224×224 cho mô hình (cắt giữa 224/256 như lúc huấn luyện)
  let px: Uint8Array | null = null;
  try {
    const cs = (side * 224) / 256;
    const m = await (await ImageManipulator.manipulate(uri)
      .crop({ originX: (W - cs) / 2, originY: (H - cs) / 2, width: cs, height: cs })
      .resize({ width: 224, height: 224 }).renderAsync()).saveAsync({ compress: 1, format: SaveFormat.JPEG });
    px = jpeg.decode(await bytesOf(m.uri), { useTArray: true, formatAsRGBA: true }).data;
  } catch {}
  return {
    uri: main.uri, b64: main.base64 || '', dataUrl: 'data:image/jpeg;base64,' + (main.base64 || ''),
    thumb: 'data:image/jpeg;base64,' + (thumb.base64 || ''), px,
  };
}

// ---- mô hình trên máy (MobileNetV3 int8, 30VNFoods) ----
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL = require('../../assets/models/foodnet.bin');
let netP: Promise<Net> | null = null;
export function getFoodNet(): Promise<Net> {
  return (netP ||= (async () => {
    const a = Asset.fromModule(MODEL);
    await a.downloadAsync();
    const bytes = await bytesOf(a.localUri || a.uri);
    return FoodNet.load(bytes) as Net;
  })().catch((e) => { netP = null; throw e; }));
}

/** 5 món khả năng cao nhất [{id, p}] hoặc null. */
export async function recognizeLocal(ph: Photo | null): Promise<{ id: string; p: number }[] | null> {
  if (!ph?.px) return null;
  const net = await getFoodNet();
  const { probs } = await FoodNet.run(net, FoodNet.fromRGBA(net, ph.px), () => new Promise((r) => setTimeout(r, 0)));
  return (probs as number[])
    .map((p, i) => ({ id: FOOD_CLASS_ID[net.classes[i]], p }))
    .filter((x) => byId[x.id]).sort((a, b) => b.p - a.p).slice(0, 5);
}

/** Mô hình đủ tốt để gợi ý? (độ chính xác top-1 khi thử ≥ 30%) */
export const modelUsable = (net: Net | null) => !!net?.acc && net.acc.top1 >= 0.3;
