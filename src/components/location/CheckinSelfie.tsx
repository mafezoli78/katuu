import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, RefreshCw, Loader2 } from 'lucide-react';
import * as faceapi from 'face-api.js';
import * as cameraService from '@/services/cameraService';

type Step = 'loading' | 'capture' | 'preview' | 'error';

interface CheckinSelfieProps {
  onConfirm: (imageBlob: Blob, source: 'camera' | 'upload') => void;
  onCancel: () => void;
  uploading?: boolean;
}

export function CheckinSelfie({ onConfirm, onCancel, uploading }: CheckinSelfieProps) {
  const isNative = cameraService.isNative();

  const [step, setStep] = useState<Step>('loading');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Câmera nativa — renderiza o container primeiro, depois inicia o preview
  useEffect(() => {
    if (!isNative) return;
    setStep('capture');
    const timer = setTimeout(() => {
      initNativePreview();
    }, 500);
    return () => {
      clearTimeout(timer);
      cameraService.stopPreview();
    };
  }, []);

  // Câmera browser — carrega modelos e inicia stream
  useEffect(() => {
    if (isNative) return;
    initBrowserCamera();
    return () => {
      cameraService.stopCamera();
      stopDetection();
    };
  }, []);

  useEffect(() => {
    if (isNative || step !== 'capture') return;
    const stream = cameraService.getStream();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [step, isNative]);

  useEffect(() => {
    if (isNative || step !== 'capture' || !modelsLoaded) return;
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        );
        setFaceDetected(!!detection);
      } catch {}
    }, 400);
    return stopDetection;
  }, [step, modelsLoaded, isNative]);

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setFaceDetected(false);
  };

  const initNativePreview = async () => {
    try {
      await cameraService.startPreview();
    } catch (err: any) {
      console.error('[CheckinSelfie] Native preview error:', err);
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões nas configurações do dispositivo.');
      setStep('error');
    }
  };

  const initBrowserCamera = async () => {
    setStep('loading');
    try {
      faceapi.nets.tinyFaceDetector.loadFromUri('/models')
        .then(() => setModelsLoaded(true))
        .catch(() => { setModelsLoaded(true); setFaceDetected(true); });
      await cameraService.requestCamera();
      setStep('capture');
    } catch (err) {
      console.error('[CheckinSelfie] Browser camera error:', err);
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      setStep('error');
    }
  };

  const handleCapture = async () => {
    if (isNative) {
      try {
        const photo = await cameraService.capturePhoto();
        await cameraService.stopPreview();
        setCapturedBlob(photo.blob);
        setCapturedImage(photo.dataUrl);
        setStep('preview');
      } catch (err) {
        console.error('[CheckinSelfie] Capture error:', err);
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
        stopDetection();
        setCapturedBlob(blob);
        setCapturedImage(URL.createObjectURL(blob));
        setStep('preview');
      }
    }, 'image/jpeg', 0.85);
  };

  const handleRetake = async () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    if (isNative) {
      setStep('capture');
      setTimeout(() => {
        initNativePreview();
      }, 500);
    } else {
      await initBrowserCamera();
    }
  };

  const handleUsePhoto = () => {
    if (capturedBlob) onConfirm(capturedBlob, 'camera');
  };

  const handleCancel = () => {
    if (isNative) {
      cameraService.stopPreview();
    } else {
      cameraService.stopCamera();
      stopDetection();
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
            <Button onClick={handleRetake} className="h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </>
      )}

      {/* Captura nativa inline */}
      {step === 'capture' && isNative && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Tire sua selfie</h2>
          </div>
          {/* Container transparente — o plugin renderiza atrás dele */}
          <div
            id="cameraPreviewContainer"
            className="relative w-full aspect-square rounded-2xl overflow-hidden"
            style={{ background: 'transparent' }}
          />
          <Button
            onClick={handleCapture}
            className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-base"
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
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {modelsLoaded && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  faceDetected ? 'bg-green-500/90 text-white' : 'bg-black/60 text-white/70'
                }`}>
                  {faceDetected ? '✓ Rosto detectado' : 'Posicione seu rosto'}
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <Button
            onClick={handleCapture}
            variant="secondary"
            disabled={!faceDetected || !modelsLoaded}
            className="w-full h-12 rounded-xl font-semibold text-base disabled:opacity-50"
          >
            <Camera className="h-5 w-5 mr-2" />
            {!modelsLoaded ? 'Carregando...' : !faceDetected ? 'Posicione seu rosto' : 'Capturar'}
          </Button>
        </>
      )}

      {/* Preview */}
      {step === 'preview' && capturedImage && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleRetake} disabled={uploading}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Ficou boa?</h2>
          </div>
          <div className="w-full aspect-square rounded-2xl overflow-hidden">
            <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleUsePhoto}
              disabled={uploading}
              className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-base"
            >
              {uploading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Entrando...</>
              ) : 'Usar esta foto'}
            </Button>
            <Button variant="ghost" onClick={handleRetake} disabled={uploading} className="w-full h-11 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refazer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
