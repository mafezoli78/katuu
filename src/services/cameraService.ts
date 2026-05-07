import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let previewActive = false;

export async function startPreview(): Promise<void> {
  if (previewActive) return;

  const el = document.getElementById('cameraPreviewContainer');
  const rect = el?.getBoundingClientRect();
  const size = rect?.width ?? window.screen.width;
  const x = rect?.left ?? 0;
  const y = rect?.top ?? 0;

  await CameraPreview.start({
    position: 'front',
    parent: 'cameraPreviewContainer',
    className: 'cameraPreview',
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(size),
    height: Math.round(size),
    toBack: true,
    disableAudio: true,
  });
  previewActive = true;
}

export async function capturePhoto(): Promise<{ blob: Blob; dataUrl: string }> {
  const result = await CameraPreview.capture({ quality: 85 });
  const rawDataUrl = `data:image/jpeg;base64,${result.value}`;
  const corrected = await fixRotation(rawDataUrl);
  const blob = dataUrlToBlob(corrected);
  return { blob, dataUrl: corrected };
}

function fixRotation(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const needsRotation = img.width > img.height;
      const size = Math.min(img.width, img.height);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      if (needsRotation) {
        ctx.translate(size, 0);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
      } else {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

export async function stopPreview(): Promise<void> {
  if (!previewActive) return;
  try {
    await CameraPreview.stop();
  } catch {}
  previewActive = false;
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
