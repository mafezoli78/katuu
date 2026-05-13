import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';
import exifr from 'exifr';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let previewActive = false;

export async function startPreview(): Promise<void> {
  if (previewActive) return;

  const el = document.getElementById('cameraPreviewContainer');
  const rect = el?.getBoundingClientRect();

  const screenW = window.screen.width;
  const hasValidRect = rect && rect.width > 0 && rect.height > 0;

  const x = hasValidRect ? Math.round(rect.left) : 0;
  const y = hasValidRect ? Math.round(rect.top) : 72;
  const width = hasValidRect ? Math.round(rect.width) : screenW;
  const height = hasValidRect ? Math.round(rect.height) : screenW;

  await CameraPreview.start({
    position: 'front',
    parent: 'cameraPreviewContainer',
    className: 'cameraPreview',
    x,
    y,
    width,
    height,
    toBack: false,
    disableAudio: true,
  });
  previewActive = true;
}

export async function capturePhoto(): Promise<{ blob: Blob; dataUrl: string }> {
  const result = await CameraPreview.captureSample({ quality: 85 });
  const rawDataUrl = `data:image/jpeg;base64,${result.value}`;
  const corrected = await fixRotationWithExif(rawDataUrl);
  const blob = dataUrlToBlob(corrected);
  return { blob, dataUrl: corrected };
}


async function fixRotationWithExif(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Rotaciona 90° para portrait
      const rotated = document.createElement('canvas');
      rotated.width = img.height;
      rotated.height = img.width;
      const rCtx = rotated.getContext('2d')!;
      rCtx.translate(0, img.width);
      rCtx.rotate(-Math.PI / 2);
      rCtx.drawImage(img, 0, 0);

      // Recorta para quadrado centralizado
      const size = Math.min(rotated.width, rotated.height);
      const offsetX = (rotated.width - size) / 2;
      const offsetY = (rotated.height - size) / 2;

      const final = document.createElement('canvas');
      final.width = size;
      final.height = size;
      const fCtx = final.getContext('2d')!;
      fCtx.drawImage(rotated, offsetX, offsetY, size, size, 0, 0, size, size);

      resolve(final.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function stopPreview(): Promise<void> {
  if (!previewActive) return;
  previewActive = false;
  try {
    await new Promise(resolve => setTimeout(resolve, 400));
    await CameraPreview.stop();
  } catch {}
}

export function isPreviewActive(): boolean {
  return previewActive;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

// --- Legacy browser stream API (mantida para web) ---
let currentStream: MediaStream | null = null;

export async function requestCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
    audio: false,
  });
  currentStream = stream;
  return stream;
}

export function getStream(): MediaStream | null {
  return currentStream;
}

export function stopCamera(): void {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}
