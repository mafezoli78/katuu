import { Capacitor } from '@capacitor/core';
import { Camera, CameraPermissionState } from '@capacitor/camera';

// Verifica se está rodando como app nativo Capacitor
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Solicita permissão de câmera via Capacitor (nativo) ou browser
export async function requestCameraPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const status = await Camera.requestPermissions({ permissions: ['camera'] });
      return status.camera === 'granted' || status.camera === 'limited';
    } catch {
      return false;
    }
  }
  // No browser, a permissão é solicitada automaticamente pelo getUserMedia
  return true;
}

// --- Stream de câmera inline (funciona no browser e no Capacitor via WebView) ---
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

      // No Capacitor, solicita permissão nativa primeiro
      if (isNative()) {
        const granted = await requestCameraPermission();
        if (!granted) throw new Error('PERMISSION_DENIED');
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
