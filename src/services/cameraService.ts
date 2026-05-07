import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let previewActive = false;

function waitForElement(id: string, timeout = 3000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Garante que o elemento tem dimensões reais na tela
        if (rect.width > 0 && rect.height > 0) {
          resolve(el);
          return;
        }
      }
      if (Date.now() - start > timeout) {
        reject(new Error(`Element #${id} not found or has no size after ${timeout}ms`));
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

export async function startPreview(): Promise<void> {
  if (previewActive) return;

  const el = await waitForElement('cameraPreviewContainer');
  const rect = el.getBoundingClientRect();

  const x = Math.round(rect.left);
  const y = Math.round(rect.top);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  console.log('[KATUU-CAM] rect:', JSON.stringify({ x, y, width, height }));

  await CameraPreview.start({
    position: 'front',
    parent: 'cameraPreviewContainer',
    className: 'cameraPreview',
    x,
    y,
    width,
    height,
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
