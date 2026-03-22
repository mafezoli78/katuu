import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, RefreshCw, Loader2, Upload, ImageOff } from 'lucide-react';
import * as faceapi from 'face-api.js';
import * as cameraService from '@/services/cameraService';

type Step = 'capture' | 'preview' | 'fallback-upload' | 'native-capture';

interface CheckinSelfieProps {
  onConfirm: (imageBlob: Blob, source: 'camera' | 'upload') => void;
  onCancel: () => void;
  uploading?: boolean;
}

export function CheckinSelfie({ onConfirm, onCancel, uploading }: CheckinSelfieProps) {
  const isNative = cameraService.isNative();

  const [step, setStep] = useState<Step>(isNative ? 'native-capture' : 'capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFailCount, setCameraFailCount] = useState(0);
  const [selfieSource, setSelfieSource] = useState<'camera' | 'upload'>('camera');
  const [faceDetected, setFaceDetected] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [nativeLoading, setNativeLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Câmera nativa — abre automaticamente ao montar
  useEffect(() => {
    if (!isNative) return;
    handleNativeCapture();
  }, []);

  const handleNativeCapture = async () => {
    setNativeLoading(true);
    try {
      const photo = await cameraService.takeSelfie();
      setCapturedBlob(photo.blob);
      setCapturedImage(URL.createObjectURL(photo.blob));
      setSelfieSource(photo.source);
      setStep('preview');
    } catch (err: any) {
      console.error('[CheckinSelfie] Native camera error:', err);
      setCameraError('Não foi possível acessar a câmera.');
      setStep('fallback-upload');
    } finally {
      setNativeLoading(false);
    }
  };

  const handleNativeGallery = async () => {
    setNativeLoading(true);
    try {
      const photo = await cameraService.pickFromGallery();
      setCapturedBlob(photo.blob);
      setCapturedImage(URL.createObjectURL(photo.blob));
      setSelfieSource(photo.source);
      setStep('preview');
    } catch (err) {
      console.error('[CheckinSelfie] Gallery error:', err);
    } finally {
      setNativeLoading(false);
    }
  };

  // --- Lógica browser (mantida para web) ---

  useEffect(() => {
    if (isNative) return;
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setModelsLoaded(true);
      } catch {
        setModelsLoaded(true);
        setFaceDetected(true);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (isNative) return;
    return () => {
      cameraService.stopCamera();
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isNative || step !== 'capture') return;
    const stream = cameraService.getStream();
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
      setCameraError(null);
    } else {
      setCameraError('Não foi possível acessar a câmera.');
      setCameraFailCount((c) => c + 1);
    }
  }, [step, isNative]);

  useEffect(() => {
    if (isNative || step !== 'capture' || !modelsLoaded || !videoRef.current || cameraError) return;
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
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      setFaceDetected(false);
    };
  }, [step, modelsLoaded, cameraError, isNative]);

  useEffect(() => {
    if (!isNative && cameraFailCount >= 2) setStep('fallback-upload');
  }, [cameraFailCount, isNative]);

  const handleCapture = () => {
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
        setCapturedBlob(blob);
        setCapturedImage(URL.createObjectURL(blob));
        setSelfieSource('camera');
        setStep('preview');
      }
    }, 'image/jpeg', 0.85);
  };

  const handleRetake = async () => {
    if (isNative) {
      await handleNativeCapture();
      return;
    }
    try {
      await cameraService.requestCamera();
      setCapturedImage(null);
      setCapturedBlob(null);
      setCameraError(null);
      setSelfieSource('camera');
      setStep('capture');
    } catch {
      setCameraError('Não foi possível acessar a câmera.');
      setCameraFailCount((c) => c + 1);
    }
  };

  const handleUsePhoto = () => {
    if (capturedBlob) {
      if (!isNative && selfieSource === 'camera') cameraService.stopCamera();
      onConfirm(capturedBlob, selfieSource);
    }
  };

  const handleCancel = () => {
    if (!isNative) cameraService.stopCamera();
    onCancel();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedBlob(file);
    setCapturedImage(URL.createObjectURL(file));
    setSelfieSource('upload');
    setStep('preview');
  };

  // Tela de loading para câmera nativa
  if (isNative && nativeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-muted-foreground text-sm">Abrindo câmera...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Fallback upload */}
      {step === 'fallback-upload' && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Envie uma foto</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-8 gap-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center max-w-[280px]">
              <p className="text-base font-medium mb-1">Câmera indisponível</p>
              <p className="text-sm text-muted-foreground">
                Não conseguimos acessar sua câmera. Envie uma foto para continuar.
              </p>
            </div>
            {isNative ? (
              <Button
                onClick={handleNativeGallery}
                disabled={nativeLoading}
                className="w-full max-w-[280px] h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              >
                <Upload className="h-5 w-5 mr-2" />
                Escolher da galeria
              </Button>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-[280px] h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Escolher foto
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {/* Browser camera capture */}
      {step === 'capture' && !isNative && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold">Tire sua selfie</h2>
          </div>
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
                <p className="text-white text-center">{cameraError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/30 hover:bg-white/10"
                  onClick={handleRetake}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
            {!cameraError && modelsLoaded && (
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
          {!cameraError && (
            <Button
              onClick={handleCapture}
              variant="secondary"
              disabled={!faceDetected || !modelsLoaded}
              className="w-full h-12 rounded-xl font-semibold text-base disabled:opacity-50"
            >
              <Camera className="h-5 w-5 mr-2" />
              {!modelsLoaded ? 'Carregando...' : !faceDetected ? 'Posicione seu rosto' : 'Capturar'}
            </Button>
          )}
        </>
      )}

      {/* Preview */}
      {step === 'preview' && capturedImage && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={selfieSource === 'upload' ? () => setStep('fallback-upload') : handleRetake}
              disabled={uploading}
            >
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
              ) : (
                'Usar esta foto'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={selfieSource === 'upload' ? () => setStep('fallback-upload') : handleRetake}
              disabled={uploading}
              className="w-full h-11 rounded-xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {selfieSource === 'upload' ? 'Escolher outra' : 'Refazer'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
