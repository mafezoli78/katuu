// Serviço de câmera - suporte nativo (Capacitor) e web (MediaStream)
// As importações do Capacitor são carregadas condicionalmente

// Detecta se está rodando em app nativo sem importar o módulo diretamente
function isNativePlatform(): boolean {
  const win = window as any;
  return !!(win.Capacitor?.isNativePlatform?.()) || 
         !!(win.Capacitor?.getPlatform?.() === 'android') ||
         !!(win.Capacitor?.getPlatform?.() === 'ios');
}

export function isNative(): boolean {
  return isNativePlatform();
}

// ============================================================
// CÂMERA NATIVA (via plugin Capacitor)
// ============================================================

let previewActive = false;
let CameraPreviewModule: any = null;

async function getCameraPreview(): Promise<any> {
  if (!CameraPreviewModule) {
    // Só importa o plugin em ambiente nativo
    if (isNativePlatform()) {
      try {
        const mod = await import('@capacitor-community/camera-preview');
        CameraPreviewModule = mod.CameraPreview;
      } catch (err) {
        console.error('[cameraService] Failed to load CameraPreview:', err);
        throw new Error('Camera plugin not available');
      }
    } else {
      throw new Error('Native camera only available in Capacitor environment');
    }
  }
  return CameraPreviewModule;
}

export async function startPreview(): Promise<void> {
  if (previewActive) return;

  const CameraPreview = await getCameraPreview();

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
  const CameraPreview = await getCameraPreview();
  const result = await CameraPreview.captureSample({ quality: 85 });
  const rawDataUrl = `data:image/jpeg;base64,${result.value}`;
  const corrected = await fixOrientation(rawDataUrl);
  const blob = dataUrlToBlob(corrected);
  return { blob, dataUrl: corrected };
}

// Corrige orientação da imagem capturada pela câmera frontal nativa
// captureSample retorna imagem em landscape — rotaciona para portrait
async function fixOrientation(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isLandscape = img.width > img.height;

      if (!isLandscape) {
        // Já está em portrait, apenas espelha horizontalmente (selfie)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.translate(img.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
        return;
      }

      // Landscape → rotaciona 90° e espelha para selfie frontal
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function stopPreview(): Promise<void> {
  if (!previewActive) return;
  previewActive = false;
  try {
    await new Promise(resolve => setTimeout(resolve, 300));
    const CameraPreview = await getCameraPreview();
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

// ============================================================
// CÂMERA WEB (MediaStream API)
// ============================================================

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