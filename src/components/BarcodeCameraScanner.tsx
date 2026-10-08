import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  RefreshCw,
  AlertTriangle,
  ImageUp,
  Zap,
  X,
} from 'lucide-react';

export const SUPPORTED_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

const NATIVE_DETECTOR_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'itf',
  'codabar',
  'qr_code',
  'data_matrix',
  'upc_a',
  'upc_e',
];

type NativeBarcodeDetector = {
  detect: (
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | HTMLImageElement
  ) => Promise<{ rawValue?: string }[]>;
};

function createNativeDetector(): NativeBarcodeDetector | null {
  if (typeof window === 'undefined') return null;
  const WinWithDetector = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => NativeBarcodeDetector;
  };
  if (typeof WinWithDetector.BarcodeDetector !== 'function') return null;
  try {
    return new WinWithDetector.BarcodeDetector({ formats: NATIVE_DETECTOR_FORMATS });
  } catch {
    try {
      return new WinWithDetector.BarcodeDetector();
    } catch {
      return null;
    }
  }
}

type Html5QrcodeInternal = Html5Qrcode & {
  qrcode?: {
    decodeRobustlyAsync?: (canvas: HTMLCanvasElement) => Promise<{ text?: string }>;
  };
};

/**
 * ฟังก์ชันถอดรหัสบาร์โค้ดจากไฟล์รูปภาพ (รองรับภาพความละเอียดสูงจากกล้องหลังมือถือทั้งแนวตั้งและแนวนอน)
 */
export async function decodeBarcodeFromImageFile(file: File): Promise<string> {
  const nativeDetector = createNativeDetector();

  // โหลดรูปภาพเป็น HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const imageEl = new Image();
    imageEl.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageEl);
    };
    imageEl.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    imageEl.src = objectUrl;
  });

  // 1. ลองใช้ Native BarcodeDetector ก่อนหากเบราว์เซอร์มือถือรองรับ
  if (nativeDetector) {
    try {
      const results = await nativeDetector.detect(img);
      const found = results?.[0]?.rawValue?.trim();
      if (found) return found;
    } catch {
      // fallback to canvas decoder
    }
  }

  // สร้าง container ชั่วคราวสำหรับตัวถอดรหัส ZXing ภายใน Html5Qrcode
  const tempId = `temp-barcode-decoder-${Math.random().toString(36).slice(2, 9)}`;
  const tempDiv = document.createElement('div');
  tempDiv.id = tempId;
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '800px';
  tempDiv.style.height = '600px';
  document.body.appendChild(tempDiv);

  try {
    const decoder = new Html5Qrcode(tempId, {
      formatsToSupport: SUPPORTED_BARCODE_FORMATS,
      verbose: false,
    }) as Html5QrcodeInternal;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && decoder.qrcode?.decodeRobustlyAsync) {
      // ทดสอบหลายขนาดและหลายมุมหมุน (0 องศา และ 90 องศา สำหรับภาพถ่ายแนวตั้งจากมือถือ)
      const maxSizes = [1400, 960];
      const rotations = [0, 90, 270];

      for (const maxDim of maxSizes) {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const sw = Math.max(1, Math.round(img.width * scale));
        const sh = Math.max(1, Math.round(img.height * scale));

        for (const angle of rotations) {
          if (angle === 0) {
            canvas.width = sw;
            canvas.height = sh;
            ctx.drawImage(img, 0, 0, sw, sh);
          } else {
            canvas.width = sh;
            canvas.height = sw;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((angle * Math.PI) / 180);
            ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
            ctx.restore();
          }

          try {
            const res = await decoder.qrcode.decodeRobustlyAsync(canvas);
            if (res?.text?.trim()) {
              return res.text.trim();
            }
          } catch {
            // ลองมุมหรือขนาดถัดไป
          }
        }
      }
    }

    // Fallback สุดท้ายด้วย scanFile มาตรฐาน
    const fallbackText = await decoder.scanFile(file, false);
    if (fallbackText?.trim()) {
      return fallbackText.trim();
    }
  } finally {
    try {
      document.body.removeChild(tempDiv);
    } catch {
      // ignore
    }
  }

  throw new Error('ไม่พบบาร์โค้ดในภาพ');
}

interface BarcodeCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (decodedText: string) => void;
  onScanFromFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isScanningFile?: boolean;
}

interface VideoDeviceItem {
  deviceId: string;
  label: string;
  isRear: boolean;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  isOpen,
  onClose,
  onDetected,
  onScanFromFile,
  isScanningFile = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderContainerIdRef = useRef<string>(
    `barcode-offscreen-decoder-${Math.random().toString(36).slice(2, 9)}`
  );

  const [status, setStatus] = useState<'requesting' | 'streaming' | 'error'>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preferredFacing, setPreferredFacing] = useState<'environment' | 'user'>('environment');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoDevices, setVideoDevices] = useState<VideoDeviceItem[]>([]);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('กล้องหลัง (Rear Camera)');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const startCameraStream = useCallback(
    async (targetFacing: 'environment' | 'user', specificDeviceId?: string) => {
      setStatus('requesting');
      setErrorMessage(null);

      // ถ้าระบบมี Stream เปิดค้างอยู่ก่อนหน้า ให้ปิดและรอ 200ms เพื่อให้ไดรเวอร์กล้องมือถือคืนทรัพยากร
      // แต่ถ้าเป็นการเปิดครั้งแรก ไม่ต้องหน่วงเวลา เพื่อรักษาสิทธิ์ User Gesture บน iOS Safari / Android
      const hadActiveStream = Boolean(streamRef.current);
      stopCurrentStream();
      if (hadActiveStream) {
        await new Promise((r) => setTimeout(r, 200));
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMessage(
          'เบราว์เซอร์ไม่รองรับการเปิดกล้องสตรีมสด (ต้องเปิดผ่าน HTTPS หรือเบราว์เซอร์หลัก เช่น Chrome/Safari) คุณสามารถกดปุ่ม "เปิดกล้องหลังถ่ายรูปบาร์โค้ด" ด้านล่างเพื่อใช้กล้องหลังของมือถือได้ทันที'
        );
        return;
      }

      let stream: MediaStream | null = null;

      try {
        // 1. กรณีผู้ใช้เลือกเลนส์กล้องจากรายการโดยตรง (ระบุ deviceId)
        if (specificDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: specificDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: specificDeviceId } },
              audio: false,
            });
          }
        } else if (targetFacing === 'environment') {
          // 2. กรณีต้องการเปิดกล้องหลังโทรศัพท์มือถือ (ไล่ลำดับ Constraint เพื่อรองรับมือถือทุกรุ่น):
          const envConstraintsList: MediaStreamConstraints[] = [
            {
              video: {
                facingMode: { exact: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            },
            {
              video: { facingMode: { exact: 'environment' } },
              audio: false,
            },
            {
              video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            },
            {
              video: { facingMode: { ideal: 'environment' } },
              audio: false,
            },
            {
              video: true,
              audio: false,
            },
          ];

          for (const constraints of envConstraintsList) {
            try {
              stream = await navigator.mediaDevices.getUserMedia(constraints);
              if (stream) break;
            } catch (err) {
              const errName = err instanceof Error ? err.name : '';
              // หากผู้ใช้กดปฏิเสธสิทธิ์การใช้กล้อง (NotAllowedError) ให้หยุดทันทีเพื่อแจ้งเตือนการขอสิทธิ์
              if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
                throw err;
              }
            }
          }
        } else {
          // 3. กรณีต้องการเปิดกล้องหน้า
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        if (!stream) {
          throw new Error('ไม่สามารถเปิดสตรีมกล้องได้');
        }

        streamRef.current = stream;

        // ดึงรายชื่อกล้องทั้งหมดหลังจากได้รับสิทธิ์แล้ว เพื่อตรวจสอบว่าเปิดกล้องหลังจริงหรือไม่
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices
            .filter((d) => d.kind === 'videoinput')
            .map((d, idx) => {
              const lbl = d.label || `กล้อง #${idx + 1}`;
              const isRear =
                /back|rear|environment|world|หลัง/i.test(lbl) ||
                (!/front|user|facetime|selfie|หน้า/i.test(lbl) && idx > 0);
              return {
                deviceId: d.deviceId,
                label: lbl,
                isRear,
              };
            });
          setVideoDevices(videoInputs);

          const currentTrack = stream.getVideoTracks()[0];
          const currentSettings = currentTrack?.getSettings?.() || {};
          const currentLabel = currentTrack?.label || '';
          const isOpenedFrontCamera =
            currentSettings.facingMode === 'user' ||
            /front|user|facetime|selfie|หน้า/i.test(currentLabel);

          // หากตั้งค่าเป็นกล้องหลัง แต่เบราว์เซอร์มือถือดันเปิดกล้องหน้าขึ้นมา ให้สลับไปใช้ Device ID ของกล้องหลังทันที
          if (
            !specificDeviceId &&
            targetFacing === 'environment' &&
            isOpenedFrontCamera &&
            videoInputs.length > 1
          ) {
            // ค้นหากล้องหลังตัวหลัก (หลีกเลี่ยงเลนส์ ultra-wide / macro / depth หากมีเลนส์หลัก)
            const rearCandidates = videoInputs.filter((v) => v.isRear);
            const primaryRear =
              rearCandidates.find((v) => !/ultra|macro|tele|depth/i.test(v.label)) ||
              rearCandidates[0] ||
              videoInputs.find((v) => v.deviceId && v.deviceId !== currentSettings.deviceId);

            if (primaryRear && primaryRear.deviceId && primaryRear.deviceId !== currentSettings.deviceId) {
              try {
                stopCurrentStream();
                await new Promise((r) => setTimeout(r, 200));
                const rearStream = await navigator.mediaDevices.getUserMedia({
                  video: {
                    deviceId: { exact: primaryRear.deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  },
                  audio: false,
                });
                stream = rearStream;
                streamRef.current = rearStream;
                setSelectedDeviceId(primaryRear.deviceId);
              } catch {
                // หากสลับด้วย exact deviceId ไม่สำเร็จ ให้เปิดสตรีมกล้องหลังสำรองกลับมา
                const fallbackStream = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: 'environment' },
                  audio: false,
                });
                stream = fallbackStream;
                streamRef.current = fallbackStream;
              }
            }
          }
        } catch {
          // ignore enumerateDevices error
        }

        // ตั้งค่า Continuous Autofocus และตรวจสอบไฟฉาย (Torch) บนกล้องหลัง
        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const activeSettings = activeTrack.getSettings?.() || {};
          if (activeSettings.deviceId && !specificDeviceId) {
            setSelectedDeviceId(activeSettings.deviceId);
          }
          setActiveCameraLabel(
            activeTrack.label ||
              (targetFacing === 'environment' ? 'กล้องหลัง (Rear Camera)' : 'กล้องหน้า (Front Camera)')
          );
          try {
            const capabilities = (
              activeTrack as MediaStreamTrack & {
                getCapabilities?: () => Record<string, unknown>;
              }
            ).getCapabilities?.();
            if (capabilities) {
              if ('torch' in capabilities && Boolean(capabilities.torch)) {
                setTorchSupported(true);
              }
              if (
                Array.isArray(capabilities.focusMode) &&
                capabilities.focusMode.includes('continuous')
              ) {
                await activeTrack.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
                });
              }
            }
          } catch {
            // ignore advanced constraint errors
          }
        }

        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          try {
            await videoRef.current.play();
          } catch {
            // บางเบราว์เซอร์จะเริ่มเล่นใน onLoadedMetadata
          }
        }

        setStatus('streaming');
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';
        setStatus('error');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setErrorMessage(
            'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดที่ไอคอนรูปแม่กุญแจ 🔒 หรือการตั้งค่าเว็บไซต์บนแถบ URL ของเบราว์เซอร์ แล้วเลือก "อนุญาต (Allow)" กล้อง จากนั้นกดปุ่ม "ขออนุญาตเปิดกล้องหลังอีกครั้ง"'
          );
        } else {
          setErrorMessage(
            'ไม่สามารถเปิดสตรีมกล้องหลังสดได้ (อาจเกิดจากเปิดลิงก์ผ่านแอป LINE/Facebook หรือกล้องถูกแอปอื่นใช้งานอยู่) คุณสามารถกดปุ่มสีเหลือง "เปิดกล้องหลังถ่ายรูปบาร์โค้ดทันที" เพื่อใช้กล้องหลังของโทรศัพท์ถ่ายสแกนได้เลย'
          );
        }
      }
    },
    [stopCurrentStream]
  );

  // เปิดใช้งานกล้องเมื่อ isOpen = true
  useEffect(() => {
    if (!isOpen) {
      stopCurrentStream();
      return;
    }
    startCameraStream('environment');
    return () => {
      stopCurrentStream();
    };
  }, [isOpen, startCameraStream, stopCurrentStream]);

  // ระบบถอดรหัสบาร์โค้ดและ QR Code จากภาพสดใน <video> (รองรับทั้งแนวตั้งและแนวนอน)
  useEffect(() => {
    if (!isOpen || status !== 'streaming') return;

    let isCancelled = false;
    let isDecodingFrame = false;
    let frameTick = 0;

    let html5Decoder: Html5QrcodeInternal | null = null;
    try {
      const containerEl = document.getElementById(decoderContainerIdRef.current);
      if (containerEl) {
        html5Decoder = new Html5Qrcode(decoderContainerIdRef.current, {
          formatsToSupport: SUPPORTED_BARCODE_FORMATS,
          verbose: false,
        }) as Html5QrcodeInternal;
      }
    } catch {
      // ignore
    }

    const nativeDetector = createNativeDetector();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const intervalId = window.setInterval(async () => {
      if (isCancelled || isDecodingFrame) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      isDecodingFrame = true;
      frameTick += 1;

      try {
        // 1. ลองสแกนด้วย Native BarcodeDetector ก่อน (เร็วมากบน Android Chrome / iOS Safari 17+)
        if (nativeDetector) {
          try {
            const results = await nativeDetector.detect(video);
            if (!isCancelled && results && results.length > 0) {
              const found = results[0]?.rawValue?.trim();
              if (found) {
                onDetected(found);
                return;
              }
            }
          } catch {
            // fallback to ZXing canvas decoder
          }
        }

        // 2. สแกนด้วย Canvas + ZXing (decodeRobustlyAsync) โดยไม่ต้องแปลงเป็นไฟล์
        if (html5Decoder?.qrcode?.decodeRobustlyAsync && ctx) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scale = Math.min(1, 960 / Math.max(vw, vh));
          const cw = Math.max(1, Math.round(vw * scale));
          const ch = Math.max(1, Math.round(vh * scale));

          // สลับตรวจเฟรมปกติ (แนวนอน) และหมุน 90 องศา (กรณีถือมือถือแนวตั้งส่องบาร์โค้ด)
          const shouldRotate = frameTick % 3 === 0;
          if (!shouldRotate) {
            canvas.width = cw;
            canvas.height = ch;
            ctx.drawImage(video, 0, 0, cw, ch);
          } else {
            canvas.width = ch;
            canvas.height = cw;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(video, -cw / 2, -ch / 2, cw, ch);
            ctx.restore();
          }

          const decodedResult = await html5Decoder.qrcode.decodeRobustlyAsync(canvas);
          if (!isCancelled && decodedResult?.text?.trim()) {
            onDetected(decodedResult.text.trim());
            return;
          }
        }
      } catch {
        // ยังไม่พบบาร์โค้ดในเฟรมนี้ สแกนเฟรมถัดไปต่อ
      } finally {
        isDecodingFrame = false;
      }
    }, 220);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      if (html5Decoder) {
        try {
          html5Decoder.clear();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, status, onDetected]);

  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      // ignore if torch fails
    }
  };

  // ปุ่มสลับเลนส์กล้องถัดไป (ช่วยให้มือถือที่มีหลายเลนส์สลับหากล้องหลังตัวหลักได้ง่ายด้วยปุ่มเดียว)
  const handleCycleCameraLens = () => {
    if (videoDevices.length <= 1) {
      const nextFacing = preferredFacing === 'environment' ? 'user' : 'environment';
      setPreferredFacing(nextFacing);
      startCameraStream(nextFacing);
      return;
    }

    const rearDevices = videoDevices.filter((d) => d.isRear);
    const pool = rearDevices.length > 1 ? rearDevices : videoDevices;
    const currentIdx = pool.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextDevice = pool[(currentIdx + 1) % pool.length];
    if (nextDevice && nextDevice.deviceId) {
      setSelectedDeviceId(nextDevice.deviceId);
      setPreferredFacing(nextDevice.isRear ? 'environment' : 'user');
      startCameraStream(nextDevice.isRear ? 'environment' : 'user', nextDevice.deviceId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
      <div
        id={decoderContainerIdRef.current}
        className="fixed -left-[9999px] -top-[9999px] w-[640px] h-[480px] overflow-hidden pointer-events-none"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <Camera className="w-4 h-4 shrink-0" />
          <span>
            {status === 'requesting'
              ? 'กำลังขออนุญาตเปิดกล้องหลังโทรศัพท์มือถือ กรุณากด "อนุญาต (Allow)"...'
              : `กำลังใช้งาน: ${activeCameraLabel}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* ปุ่มบังคับเปิดกล้องหลัง */}
          <button
            type="button"
            onClick={() => {
              setSelectedDeviceId('');
              setPreferredFacing('environment');
              startCameraStream('environment');
            }}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              preferredFacing === 'environment'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            กล้องหลัง
          </button>

          {/* ปุ่มสลับเลนส์กล้องหลัง (กรณีมือถือมีหลายเลนส์) */}
          <button
            type="button"
            onClick={handleCycleCameraLens}
            className="px-2.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>สลับเลนส์กล้อง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedDeviceId('');
              setPreferredFacing('user');
              startCameraStream('user');
            }}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              preferredFacing === 'user'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            กล้องหน้า
          </button>

          {/* รายการเลือกเลนส์กล้องทั้งหมดในเครื่อง */}
          {videoDevices.length > 1 && (
            <select
              aria-label="เลือกเลนส์กล้องของโทรศัพท์"
              value={selectedDeviceId}
              onChange={(e) => {
                const devId = e.target.value;
                setSelectedDeviceId(devId);
                if (devId) {
                  const chosen = videoDevices.find((d) => d.deviceId === devId);
                  const facing = chosen?.isRear ? 'environment' : 'user';
                  setPreferredFacing(facing);
                  startCameraStream(facing, devId);
                } else {
                  setPreferredFacing('environment');
                  startCameraStream('environment');
                }
              }}
              className="px-2 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg max-w-[165px]"
            >
              <option value="">เลือกเลนส์อัตโนมัติ (หลัง)</option>
              {videoDevices.map((cam, i) => (
                <option key={cam.deviceId || i} value={cam.deviceId}>
                  {cam.isRear ? '📷 [หลัง] ' : '🤳 [หน้า] '}
                  {cam.label}
                </option>
              ))}
            </select>
          )}

          {torchSupported && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer ${
                torchOn
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{torchOn ? 'ปิดไฟฉาย' : 'ไฟฉาย'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>ปิด</span>
          </button>
        </div>
      </div>

      {/* วิดีโอสตรีมจากกล้องหลังโดยตรง (คงไว้ใน DOM เสมอเพื่อให้ iOS Safari / Android เล่นวิดีโอได้ไม่ติดบล็อก) */}
      <div
        className={`relative rounded-xl overflow-hidden bg-black min-h-[250px] flex items-center justify-center ${
          status === 'error' ? 'hidden' : 'block'
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
          }}
          className="w-full max-h-[320px] object-cover"
        />

        {status === 'requesting' && (
          <div className="absolute inset-0 z-10 bg-slate-950/90 p-6 flex flex-col items-center justify-center text-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-white">
              กำลังเชื่อมต่อกล้องหลังโทรศัพท์มือถือ...
            </p>
            <p className="text-xs text-slate-300 max-w-md">
              หากมีหน้าต่างเด้งขึ้นมาถามสิทธิ์การใช้กล้อง กรุณากดปุ่ม{' '}
              <strong>&quot;อนุญาต (Allow)&quot;</strong> หรือ{' '}
              <strong>&quot;ขณะใช้แอป&quot;</strong>
            </p>
          </div>
        )}

        {status === 'streaming' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[280px] h-[130px] border-2 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500/80 animate-pulse" />
            </div>
            <span className="mt-2 text-[11px] font-semibold text-white bg-slate-900/80 px-2.5 py-1 rounded-md">
              วางแถบบาร์โค้ดหรือ QR Code ให้อยู่ในกรอบสีเขียว (หากภาพเป็นกล้องหน้าให้กด &quot;สลับเลนส์กล้อง&quot;)
            </span>
          </div>
        )}
      </div>

      {/* ปุ่มทางัดสำหรับเปิดแอปกล้องหลังของมือถือโดยตรง (ทำงานได้ 100% แม้เปิดผ่าน LINE หรือ WebView) */}
      {onScanFromFile && status === 'streaming' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs text-slate-300">
          <span>หากกล้องโฟกัสไม่ชัด หรือต้องการใช้แอปกล้องหลักของมือถือ:</span>
          <label className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
            <ImageUp className="w-3.5 h-3.5" />
            <span>
              {isScanningFile ? 'กำลังอ่านบาร์โค้ด...' : 'ถ่ายด้วยแอปกล้องหลังมือถือ'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onScanFromFile}
              className="sr-only"
            />
          </label>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="p-4 bg-amber-950/90 border border-amber-700 rounded-xl flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed">{errorMessage}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startCameraStream('environment')}
              className="min-h-[40px] px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>ขออนุญาตเปิดกล้องหลังอีกครั้ง</span>
            </button>

            {onScanFromFile && (
              <label className="min-h-[40px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
                <ImageUp className="w-4 h-4" />
                <span>
                  {isScanningFile
                    ? 'กำลังอ่านบาร์โค้ด...'
                    : 'เปิดกล้องหลังถ่ายรูปบาร์โค้ดทันที'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onScanFromFile}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
