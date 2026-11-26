// Chụp một View thành ảnh PNG rồi mở bảng chia sẻ (web: tải file về).
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function captureAndShare(ref: RefObject<any>, width: number, height: number, fileName: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const uri = await captureRef(ref, { format: 'png', result: 'data-uri', width, height });
    const a = document.createElement('a'); a.href = uri; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  const uri = await captureRef(ref, { format: 'png', result: 'tmpfile', width, height });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
}
