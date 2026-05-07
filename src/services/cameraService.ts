import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

let previewActive = false;

export async function startPreview(): Promise<void> {
  if (previewActive) return;
  await CameraPreview.start({
    position: 'front',
    parent: 'cameraPreviewContainer',
    className: 'cameraPreview',
    width: window.screen.width,
    height: window.screen.width, // quadrado (1:1)
    toBack: false,
    disableAudio: true,
  });
  previewActive = true;
}

export async function capturePhoto(): Promise<{ blob: Blob; dataUrl: string }> {
  const result = await CameraPreview.capture({ quality: 85 });
  const dataUrl = `data:image/jpeg;base64,${result.value}`;
  const blob = dataUrlToBlob(dataUrl);
  return { blob, dataUrl };
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
