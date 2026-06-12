import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, RefreshCw, Loader2 } from 'lucide-react';
import * as cameraService from '@/services/cameraService';

type Step = 'loading' | 'capture' | 'preview' | 'error';

interface CheckinSelfieProps {
  onConfirm: (imageBlob: Blob, source: 'camera' | 'upload') => void;
  onCancel: () => void;
  uploading?: boolean;
  /**
   * true quando o componente roda DENTRO de um Dialog (ex: SelfCard).
   * O preview deixa de ser fixed/tela-cheia e renderiza no fluxo do modal.
   */
  embedded?: boolean;
}

const KATUU_GREEN = '#6B8E7F';
const KATUU_ORANGE = '#F4A261';

/**
 * Filtros leves: preview via CSS filter (custo zero) e aplicação definitiva
 * via canvas só ao confirmar. "Suave" usa duas passadas no canvas (nítida +
 * desfocada com alpha) — soft focus que alivia rugas sem transformar a
 * pessoa; o CSS do preview é uma aproximação.
 *
 * NOTA: face-api.js foi REMOVIDO do projeto (dependência abandonada,
 * vulnerabilidade high via node-fetch e megabytes de TensorFlow no bundle).
 * Verificação de selfie é épico futuro, com ferramenta nativa (ML Kit).
 */
const FILTERS = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'natural',  label: 'Natural',  css: 'brightness(1.06) contrast(1.08)' },
  { id: 'suave',    label: 'Suave',    css: 'blur(0.6px) brightness(1.06) saturate(1.03)' },
  { id: 'vivido',   label: 'Vívido',   css: 'brightness(1.04) contrast(1.06) saturate(1.28)' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

export function CheckinSelfie({ onConfirm, onCancel, uploading, embedded = false }: CheckinSelfieProps) {
  const isNative = cameraService.isNative();

  const [step, setStep] = useState<Step>('loading');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterId>('original');
  const [applyingFilter, setApplyingFilter] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isNative) return;
    setStep('capture');
    const timer = setTimeout(() => initNativePreview(), 800);
    return () => {
      clearTimeout(timer);
      cameraService.stopPreview();
    };
  }, []);

  useEffect(() => {
    if (isNative) return;
    initBrowserCamera();
    return () => {
      cameraService.stopCamera();
    };
  }, []);

  useEffect(() => {
    if (isNative || step !== 'capture') return;
    const stream = cameraService.getStream();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => { });
    }
  }, [step, isNative]);

  useEffect(() => {
    if (!isNative || step !== 'preview') return;
    cameraService.stopPreview();
    const timer = setTimeout(() => setPreviewReady(true), 150);
    return () => clearTimeout(timer);
  }, [step, isNative]);

  const initNativePreview = async () => {
    try {
      await cameraService.startPreview();
    } catch (err: any) {
      console.error('[CheckinSelfie] Native preview error:', err?.message || err);
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões nas configurações do dispositivo.');
      setStep('error');
    }
  };

  const initBrowserCamera = async () => {
    setStep('loading');
    try {
      await cameraService.requestCamera();
      setStep('capture');
    } catch {
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      setStep('error');
    }
  };

  const handleCapture = async () => {
    if (isNative) {
      try {
        setPreviewReady(false);
        setSelectedFilter('original');
        const photo = await cameraService.capturePhoto();
        setCapturedBlob(photo.blob);
        setCapturedImage(photo.dataUrl);
        setStep('preview');
      } catch {
        setErrorMsg('Erro ao capturar foto. Tente novamente.');
        setStep('error');
      }
      return;
    }

    // Browser
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        cameraService.stopCamera();
        setSelectedFilter('original');
        setCapturedBlob(blob);
        setCapturedImage(URL.createObjectURL(blob));
        setStep('preview');
      }
    }, 'image/jpeg', 0.85);
  };

  const handleRetake = async () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setPreviewReady(false);
    setErrorMsg(null);
    setSelectedFilter('original');
    if (isNative) {
      setStep('capture');
      setTimeout(() => initNativePreview(), 500);
    } else {
      await initBrowserCamera();
    }
  };

  // Aplica o filtro selecionado de forma definitiva (canvas) e confirma
  const handleUsePhoto = async () => {
    if (!capturedBlob || !capturedImage) return;

    const filter = FILTERS.find(f => f.id === selectedFilter);
    if (!filter || filter.id === 'original') {
      onConfirm(capturedBlob, 'camera');
      return;
    }

    setApplyingFilter(true);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = capturedImage;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context');

      if (filter.id === 'suave') {
        // Soft focus em duas passadas: base nítida + camada desfocada por cima
        ctx.filter = 'brightness(1.05)';
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 0.4;
        // Blur proporcional ao tamanho da foto (~0.4% da largura)
        const blurPx = Math.max(2, Math.round(img.naturalWidth * 0.004));
        ctx.filter = `blur(${blurPx}px) brightness(1.05)`;
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 1;
      } else {
        ctx.filter = filter.css;
        ctx.drawImage(img, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );

      onConfirm(blob || capturedBlob, 'camera');
    } catch (error) {
      console.error('[CheckinSelfie] Erro ao aplicar filtro, usando original:', error);
      onConfirm(capturedBlob, 'camera');
    } finally {
      setApplyingFilter(false);
    }
  };

  const handleCancel = () => {
    if (isNative) {
      cameraService.stopPreview();
    } else {
      cameraService.stopCamera();
    }
    onCancel();
  };

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground text-sm">Acessando câmera...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Erro */}
      {step === 'error' && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Câmera indisponível</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <p className="text-sm text-muted-foreground max-w-[280px]">{errorMsg}</p>
            <Button
              onClick={handleRetake}
              className="h-11 rounded-xl font-semibold text-white"
              style={{ backgroundColor: KATUU_ORANGE }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </>
      )}

      {/* Captura nativa */}
      {step === 'capture' && isNative && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Tire sua selfie</h2>
          </div>

          {/* Frame quadrado — border-radius não funciona com câmera nativa */}
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ aspectRatio: '1/1' }}
          >
            <div
              id="cameraPreviewContainer"
              className="absolute inset-0"
              style={{ zIndex: 1 }}
            />
          </div>

          <Button
            onClick={handleCapture}
            className="w-full h-12 rounded-xl font-semibold text-base text-white"
            style={{ backgroundColor: KATUU_ORANGE }}
          >
            <Camera className="h-5 w-5 mr-2" />
            Capturar
          </Button>
        </>
      )}

      {/* Captura browser */}
      {step === 'capture' && !isNative && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Tire sua selfie</h2>
          </div>
          <div className="relative w-full aspect-square overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <Button
            onClick={handleCapture}
            className="w-full h-12 rounded-xl font-semibold text-base text-white"
            style={{ backgroundColor: KATUU_ORANGE }}
          >
            <Camera className="h-5 w-5 mr-2" />
            Capturar
          </Button>
        </>
      )}

      {/* Preview — tela cheia no check-in, embutido quando dentro de Dialog */}
      {step === 'preview' && capturedImage && (
        <div
          className={embedded ? 'flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
          style={embedded ? undefined : {
            backgroundColor: previewReady ? 'var(--background)' : 'white',
            transition: 'background-color 0.15s ease-in',
          }}
        >
          <div className={embedded ? 'flex items-center gap-3 pb-2' : 'flex items-center gap-3 p-4'}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleRetake} disabled={uploading || applyingFilter}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Ficou boa?</h2>
          </div>
          <div
            className={embedded ? '' : 'px-4'}
            style={embedded ? undefined : { opacity: previewReady ? 1 : 0, transition: 'opacity 0.15s ease-in' }}
          >
            <img
              src={capturedImage}
              alt="Selfie"
              className={embedded ? 'rounded-xl' : ''}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: FILTERS.find(f => f.id === selectedFilter)?.css || 'none',
              }}
            />
          </div>

          {/* Filtros — miniaturas da própria foto com o preset aplicado */}
          <div
            className={embedded ? 'flex justify-center gap-3 pt-3' : 'flex justify-center gap-3 px-4 pt-3'}
            style={embedded ? undefined : { opacity: previewReady ? 1 : 0, transition: 'opacity 0.15s ease-in' }}
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                disabled={uploading || applyingFilter}
                className="flex flex-col items-center gap-1"
              >
                <img
                  src={capturedImage}
                  alt={filter.label}
                  className={`w-14 h-14 object-cover rounded-lg border-2 transition-all ${
                    selectedFilter === filter.id ? 'border-accent' : 'border-transparent opacity-80'
                  }`}
                  style={{ filter: filter.css }}
                />
                <span className={`text-xs ${
                  selectedFilter === filter.id ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}>
                  {filter.label}
                </span>
              </button>
            ))}
          </div>

          <div
            className={embedded ? 'flex flex-col gap-2 pt-4' : 'flex flex-col gap-2 p-4'}
            style={embedded ? undefined : { opacity: previewReady ? 1 : 0, transition: 'opacity 0.15s ease-in' }}
          >
            <Button
              onClick={handleUsePhoto}
              disabled={uploading || applyingFilter}
              className="w-full h-12 rounded-xl font-semibold text-base text-white"
              style={{ backgroundColor: KATUU_GREEN }}
            >
              {uploading || applyingFilter ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{applyingFilter ? 'Aplicando...' : 'Entrando...'}</>
              ) : 'Usar esta foto'}
            </Button>
            <Button variant="ghost" onClick={handleRetake} disabled={uploading || applyingFilter} className="w-full h-11 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refazer
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
