import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RotateCw, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CameraScanner({
  onScan,
  onClose,
  title = "Pindai Barcode Produk"
}: CameraScannerProps) {
  const scannerId = "html5qr-code-full-reader";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sound feedback on successful scan
  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // high chime
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // 1. Get cameras and request permission
  useEffect(() => {
    // Check if browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Browser Anda tidak mendukung akses kamera. Mohon gunakan Chrome, Safari, atau Firefox versi terbaru.");
      setHasPermission(false);
      return;
    }

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setHasPermission(true);
          
          // Prefer back/rear camera by default for barcode scanning
          const backCam = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );
          setActiveCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMessage("Tidak ada kamera terdeteksi di perangkat Anda.");
          setHasPermission(false);
        }
      })
      .catch(err => {
        console.error("Camera access error:", err);
        setErrorMessage("Gagal mendapatkan izin akses kamera. Mohon pastikan izin kamera diaktifkan di browser Anda.");
        setHasPermission(false);
      });

    return () => {
      // Clean up scanner on unmount
      stopScanner();
    };
  }, []);

  // 2. Start/Restart scanner when active camera changes
  useEffect(() => {
    if (activeCameraId && hasPermission) {
      startScanner(activeCameraId);
    }
  }, [activeCameraId, hasPermission]);

  const startScanner = async (cameraId: string) => {
    try {
      // Stop any existing session first
      await stopScanner();

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;
      setIsScanning(true);

      const config = {
        fps: 15,
        qrbox: (width: number, height: number) => {
          // Optimized for barcode scan box (wider aspect ratio)
          const size = Math.min(width, height);
          return {
            width: Math.floor(size * 0.85),
            height: Math.floor(size * 0.45)
          };
        }
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          playSuccessBeep();
          onScan(decodedText);
          toast.success(`Scan berhasil: ${decodedText}`);
        },
        (errorMessage) => {
          // Silent failure on scanning frames - standard behavior of html5-qrcode
        }
      );
    } catch (err: any) {
      console.error("Failed to start scanning:", err);
      // Retry using default constraints if exact ID fails (common on some Android webviews)
      try {
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 120 } },
            (decodedText) => {
              playSuccessBeep();
              onScan(decodedText);
              toast.success(`Scan berhasil: ${decodedText}`);
            },
            () => {}
          );
          setIsScanning(true);
        }
      } catch (retryErr) {
        setErrorMessage(`Kamera gagal memuat: ${err.message || err}`);
        setIsScanning(false);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop scanner cleanly:", err);
      }
    }
    html5QrCodeRef.current = null;
    setIsScanning(false);
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setActiveCameraId(cameras[nextIndex].id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-6 overflow-hidden">
      {/* Header Bar */}
      <div className="w-full max-w-md flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl mt-4 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-pink-500 animate-pulse" />
          <div>
            <h3 className="text-white text-xs font-black uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] text-slate-400 font-medium">Dekatkan barcode ke dalam kotak tengah</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800"
          title="Tutup scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Viewfinder Frame */}
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center relative my-4">
        {/* Scanning Box Container */}
        <div className="w-full aspect-square max-w-[340px] border border-slate-800 bg-slate-900/40 rounded-2xl relative overflow-hidden flex items-center justify-center">
          {/* html5-qrcode video element attaches here */}
          <div id={scannerId} className="absolute inset-0 w-full h-full" />

          {/* Virtual Target Reticle Overlaid on Video */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none z-10">
            {/* Corner Bracket Elements */}
            <div className="flex justify-between">
              <div className="w-8 h-8 border-t-4 border-l-4 border-pink-500 rounded-tl-lg" />
              <div className="w-8 h-8 border-t-4 border-r-4 border-pink-500 rounded-tr-lg" />
            </div>

            {/* Scanning Laser Animation Line */}
            <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-lg shadow-pink-500/80 animate-bounce" />

            <div className="flex justify-between">
              <div className="w-8 h-8 border-b-4 border-l-4 border-pink-500 rounded-bl-lg" />
              <div className="w-8 h-8 border-b-4 border-r-4 border-pink-500 rounded-br-lg" />
            </div>
          </div>

          {/* Display State Messages */}
          {!isScanning && !errorMessage && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <Camera className="h-10 w-10 text-slate-500 animate-spin mb-3" />
              <p className="text-slate-300 text-xs font-bold">Menghubungkan Kamera...</p>
            </div>
          )}

          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3 border border-red-900/30">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-white text-xs font-bold leading-normal">{errorMessage}</p>
              <button 
                onClick={() => hasPermission && activeCameraId && startScanner(activeCameraId)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-bold"
              >
                Coba Hubungkan Kembali
              </button>
            </div>
          )}
        </div>

        {/* Display detected camera info */}
        {cameras.length > 0 && isScanning && (
          <div className="mt-4 bg-slate-900/60 border border-slate-800/40 px-3 py-1 rounded-full text-[9px] font-mono text-slate-400 font-medium">
            Kamera Aktif: {cameras.find(c => c.id === activeCameraId)?.label || `Camera ${cameras.findIndex(c => c.id === activeCameraId) + 1}`}
          </div>
        )}
      </div>

      {/* Footer / Control Bar */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-4 rounded-xl mb-4 shrink-0 flex flex-col items-center gap-3">
        {/* Switch Camera Button if multiple exist */}
        {cameras.length > 1 && (
          <button
            onClick={switchCamera}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 border border-slate-700 cursor-pointer active:scale-[0.98] transition-all"
          >
            <RotateCw className="h-4 w-4" />
            Ganti Kamera ({cameras.length})
          </button>
        )}

        {/* Informative text */}
        <div className="text-[10px] text-slate-500 font-medium text-center flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-pink-500" />
          Kompatibel dengan semua HP & Tablet (iOS / Android)
        </div>
      </div>
    </div>
  );
}
