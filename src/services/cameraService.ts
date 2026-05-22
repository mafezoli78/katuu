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
    if (isNativePlatform()) {
      const win = window as any;
      const plugin = win.Capacitor?.Plugins?.CameraPreview;
      if (!plugin) {
        throw new Error('Camera plugin not available');
      }
      CameraPreviewModule = plugin;
    } else {
      throw new Error('Native camera only available in Capacitor environment');
    }
  }
  return CameraPreviewModule;
}

export async function startPreview(): Promise<void> {
  if (previewActive) return;

  const CameraPreview = await getCameraPreview();

  // Aguarda o container estar disponível no DOM
  const el = document.getElementById('cameraPreviewContainer');
  if (!el) {
    console.warn('[cameraService] Container #cameraPreviewContainer não encontrado, aguardando...');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const container = document.getElementById('cameraPreviewContainer');
  const rect = container?.getBoundingClientRect();
  const screenW = window.screen.width;
  const hasValidRect = rect && rect.width > 0 && rect.height > 0;

  const x = hasValidRect ? Math.round(rect.left) : 0;
  const y = hasValidRect ? Math.round(rect.top) : 72;
  const width = hasValidRect ? Math.round(rect.width) : screenW;
  const height = hasValidRect ? Math.round(rect.height) : screenW;

  console.log('[cameraService] Starting preview at:', { x, y, width, height });

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

// Corrige orientação e realiza o recorte quadrado da imagem capturada
async function fixOrientation(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isLandscape = img.width > img.height;
      
      // Define o tamanho do quadrado baseado na menor dimensão
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      if (!isLandscape) {
        // Portrait: Centraliza verticalmente e espelha (selfie)
        const offsetY = (img.height - size) / 2;
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, offsetY, size, size, 0, 0, size, size);
      } else {
        // Landscape: Rotaciona 90°, centraliza horizontalmente e espelha
        const offsetX = (img.width - size) / 2;
        ctx.translate(size, 0);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        // Note: Após rotação, as coordenadas de origem mudam
        ctx.drawImage(img, offsetX, 0, size, size, 0, 0, size, size);
      }

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
  } catch { }
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