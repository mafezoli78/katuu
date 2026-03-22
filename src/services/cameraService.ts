import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

export type CameraPhoto = {
  blob: Blob;
  source: 'camera' | 'upload';
};

// Verifica se está rodando como app nativo Capacitor
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Captura foto via câmera nativa (Capacitor) ou browser
export async function takeSelfie(): Promise<CameraPhoto> {
  if (isNative()) {
    return takeNativeSelfie();
  }
  throw new Error('USE_BROWSER_CAMERA');
}

// Câmera nativa via Capacitor
async function takeNativeSelfie(): Promise<CameraPhoto> {
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    direction: CameraDirection.Front,
    width: 720,
    height: 720,
    correctOrientation: true,
  });

  if (!photo.dataUrl) throw new Error('No photo data');

  const blob = dataUrlToBlob(photo.dataUrl);
  return { blob, source: 'camera' };
}

// Upload de arquivo (fallback)
export async function pickFromGallery(): Promise<CameraPhoto> {
  if (isNative()) {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      width: 720,
      height: 720,
      correctOrientation: true,
    });

    if (!photo.dataUrl) throw new Error('No photo data');
    const blob = dataUrlToBlob(photo.dataUrl);
    return { blob, source: 'upload' };
  }

  throw new Error('USE_BROWSER_UPLOAD');
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

// --- Legacy browser stream API (mantida para compatibilidade web) ---
let currentStream: MediaStream | null = null;
let pendingRequest: Promise<MediaStream> | null = null;

export async function requestCamera(): Promise<MediaStream> {
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    try {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      currentStream = stream;
      return stream;
    } catch (err) {
      currentStream = null;
      throw err;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
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

export function isActive(): boolean {
  return currentStream !== null && currentStream.getTracks().some(t => t.readyState === 'live');
}
