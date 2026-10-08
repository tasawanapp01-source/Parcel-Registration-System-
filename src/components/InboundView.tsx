import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Barcode,
  Camera,
  UserCheck,
  AlertTriangle,
  PackagePlus,
  Search,
  X,
  ArrowRight,
  Layers,
  RefreshCw,
  ImageUp,
  CheckCircle2,
  UserPlus,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  ParcelCategory,
  ParcelStatus,
  PARCEL_CATEGORIES,
  COURIER_LIST,
  Student,
  getDormitoryTheme,
  getAvailableDormitories,
  detectCourierFromTracking,
  generateUniqueParentTrackingNumber,
  WEEKLY_PARCEL_WARNING_LIMIT,
  isUnknownOwnerParcel,
} from '../types/parcel';

const INBOUND_STATUS_OPTIONS: {
  value: ParcelStatus;
  label: string;
  desc: string;
  activeClass: string;
  inactiveClass: string;
  descActiveClass: string;
  descInactiveClass: string;
}[] = [
  {
    value: 'ลงทะเบียนรับพัสดุ',
    label: 'ลงทะเบียนรับพัสดุ',
    desc: 'พัสดุปกติ ลงทะเบียนรับเข้าและคัดแยกส่งหอพัก',
    activeClass: 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-600/30',
    inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300',
    descActiveClass: 'text-emerald-50',
    descInactiveClass: 'text-emerald-700/80',
  },
  {
    value: 'ติดนิติการ',
    label: 'พัสดุติดนิติการ',
    desc: 'พัสดุต้องสงสัยหรือผิดระเบียบหอพัก รอตรวจสอบ',
    activeClass: 'bg-red-600 text-white border-red-700 ring-2 ring-red-600/30',
    inactiveClass: 'bg-red-50/70 text-red-900 border-red-200 hover:bg-red-100/80 hover:border-red-300',
    descActiveClass: 'text-red-50',
    descInactiveClass: 'text-red-700/80',
  },
  {
    value: 'พัสดุไม่ทราบเจ้าของ',
    label: 'พัสดุไม่ทราบเจ้าของ',
    desc: 'หน้ากล่องไม่ระบุชื่อชัดเจน หรือไม่พบข้อมูลนักเรียนผู้รับ',
    activeClass: 'bg-slate-600 text-white border-slate-700 ring-2 ring-slate-600/30',
    inactiveClass: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200/80 hover:border-slate-400',
    descActiveClass: 'text-slate-100',
    descInactiveClass: 'text-slate-600',
  },
];

const LEGAL_HOLD_REASONS = [
  'สงสัยเครื่องใช้ไฟฟ้าทำความร้อน (ผิดระเบียบหอพัก)',
  'สงสัยอาหารสดเน่าเสียง่าย ต้องเปิดตรวจต่อหน้าครูหอพัก',
  'กล่องพัสดุชำรุด/มีกลิ่นผิดปกติ',
  'ไม่ระบุชื่อผู้รับชัดเจน รอตรวจสอบหลักฐานการสั่งซื้อ',
];

const SUPPORTED_BARCODE_FORMATS = [
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

function playScanBeep(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 beep
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore audio context restrictions
  }
}

export const InboundView: React.FC = () => {
  const {
    students,
    parcels,
    lookupStudentByCode,
    recordLocalSearchSaving,
    addInboundParcel,
    updateParcelStatus,
    upsertSingleStudent,
    pullFromFirebaseToLocal,
    getStudentParcelCounts,
    openWeeklyWarningPopup,
    user,
    isSyncing,
  } = useParcelSystem();

  // 1. ข้อมูลบาร์โค้ดและขนส่ง
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [courier, setCourier] = useState<string>('Flash Express');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // 2. ข้อมูลนักเรียน (กรอกและดึงข้อมูลนักเรียน)
  const [studentCodeInput, setStudentCodeInput] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentPrefix, setStudentPrefix] = useState<string>('นาย');
  const [studentFullName, setStudentFullName] = useState<string>('');
  const [studentNickname, setStudentNickname] = useState<string>('');
  const [studentGradeRoom, setStudentGradeRoom] = useState<string>('');
  const [studentDormitory, setStudentDormitory] = useState<string>('');
  const [studentDormRoom, setStudentDormRoom] = useState<string>('');
  const [studentFetchFeedback, setStudentFetchFeedback] = useState<{
    type: 'success' | 'warning';
    message: string;
  } | null>(null);

  // 3. ประเภทสิ่งของ และรายละเอียดเพิ่มเติม (เครื่องสำอาง / อื่นๆ)
  const [category, setCategory] = useState<ParcelCategory>('ของใช้ส่วนตัว');
  const [customCategoryDetail, setCustomCategoryDetail] = useState<string>('');

  // 4. สถานะการคัดแยกพัสดุ (2 รายการ: ลงทะเบียนรับพัสดุ, ติดนิติการ(ผิดระเบียบ))
  const [status, setStatus] = useState<ParcelStatus>('ลงทะเบียนรับพัสดุ');
  const [note, setNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // 5. ตัวกรองเลือกแสดงตามหอพักและตัวแบ่งหน้าสำหรับรายการพัสดุที่รับเข้าล่าสุด
  const [recentDormFilter, setRecentDormFilter] = useState<string>('ALL');
  const [recentPage, setRecentPage] = useState<number>(1);
  const [recentPageSize, setRecentPageSize] = useState<string>('10');

  // สถานะกล้องสแกนบาร์โค้ดและการขออนุญาตสิทธิ์ใช้กล้อง (Camera Permission)
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [cameraPermission, setCameraPermission] = useState<
    'prompt' | 'granted' | 'denied' | 'requesting'
  >('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const trackingInputRef = useRef<HTMLInputElement | null>(null);
  const studentCodeInputRef = useRef<HTMLInputElement | null>(null);
  const customCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeFileInputRef = useRef<HTMLInputElement | null>(null);

  const availableDormitories = useMemo(
    () => getAvailableDormitories(students, parcels),
    [students, parcels]
  );

  // ค้นหาข้อมูลนักเรียนอัตโนมัติจาก Local Cache Map (0 Firestore Reads)
  const matchedStudent = useMemo(() => {
    return lookupStudentByCode(studentCodeInput);
  }, [lookupStudentByCode, studentCodeInput]);

  // คำนวณจำนวนพัสดุของนักเรียนที่กำลังเลือกอยู่ แยกเป็น วัน, สัปดาห์, เดือน
  const activeStudentParcelStats = useMemo(() => {
    return getStudentParcelCounts(studentCodeInput, studentFullName, matchedStudent);
  }, [getStudentParcelCounts, studentCodeInput, studentFullName, matchedStudent]);

  // ฟังก์ชันเติมข้อมูลนักเรียนลงในฟอร์มเมื่อดึงข้อมูลสำเร็จ พร้อมแจ้งเตือนหากพัสดุเกิน 3 ชิ้นต่อสัปดาห์
  const populateStudentFields = useCallback(
    (st: Student) => {
      setStudentCodeInput(st.studentCode);
      setStudentPrefix(st.prefix && st.prefix !== '-' ? st.prefix : 'นาย');
      const fullName = `${st.prefix && st.prefix !== '-' ? st.prefix : ''}${st.firstName} ${
        st.lastName && st.lastName !== '-' ? st.lastName : ''
      }`.trim();
      setStudentFullName(fullName);
      setStudentNickname(st.nickname && st.nickname !== '-' ? st.nickname : '');
      const gRoom =
        st.grade && st.grade !== '-'
          ? `${st.grade}${st.room && st.room !== '-' ? `/${st.room}` : ''}`
          : '';
      setStudentGradeRoom(gRoom);
      setStudentDormitory(st.dormitory && st.dormitory !== '-' ? st.dormitory : '');
      setStudentDormRoom(st.dormRoom && st.dormRoom !== '-' ? st.dormRoom : '');

      const stStats = getStudentParcelCounts(st.studentCode, fullName, st);
      if (stStats.isOverWeeklyLimit) {
        openWeeklyWarningPopup(stStats, 'student_lookup');
      }
    },
    [getStudentParcelCounts, openWeeklyWarningPopup]
  );

  // เมื่อพิมพ์รหัสนักเรียนตรงกับในระบบ ให้ดึงข้อมูลมาแสดงในช่องกรอกอัตโนมัติทันที
  useEffect(() => {
    if (matchedStudent) {
      recordLocalSearchSaving();
      populateStudentFields(matchedStudent);
      setStudentFetchFeedback({
        type: 'success',
        message: `ดึงข้อมูลนักเรียนสำเร็จ: ${matchedStudent.prefix}${matchedStudent.firstName} ${matchedStudent.lastName} (${matchedStudent.dormitory} ห้อง ${matchedStudent.dormRoom})`,
      });
    }
  }, [matchedStudent, recordLocalSearchSaving, populateStudentFields]);

  // ปุ่มกด "ดึงข้อมูลนักเรียน" จากรหัสนักเรียน หรือคำค้นหาชื่อ/ชื่อเล่น
  const handleFetchStudentData = () => {
    setFormError(null);
    const codeQuery = studentCodeInput.trim();
    const textQuery = studentSearchQuery.trim().toLowerCase();

    if (codeQuery) {
      const byCode = lookupStudentByCode(codeQuery);
      if (byCode) {
        recordLocalSearchSaving();
        populateStudentFields(byCode);
        setStudentFetchFeedback({
          type: 'success',
          message: `ดึงข้อมูลนักเรียนรหัส ${byCode.studentCode} สำเร็จ (${byCode.prefix}${byCode.firstName} ${byCode.lastName})`,
        });
        return;
      }
      // ลองค้นหาจากชื่อหรือรหัสบางส่วนในกรณีที่ผู้ใช้พิมพ์ชื่อในช่องรหัส
      const fuzzyByCodeField = students.find(
        (s) =>
          s.studentCode.toLowerCase().includes(codeQuery.toLowerCase()) ||
          s.firstName.toLowerCase().includes(codeQuery.toLowerCase()) ||
          s.lastName.toLowerCase().includes(codeQuery.toLowerCase()) ||
          s.nickname.toLowerCase().includes(codeQuery.toLowerCase())
      );
      if (fuzzyByCodeField) {
        recordLocalSearchSaving();
        populateStudentFields(fuzzyByCodeField);
        setStudentFetchFeedback({
          type: 'success',
          message: `ดึงข้อมูลนักเรียนสำเร็จ: ${fuzzyByCodeField.prefix}${fuzzyByCodeField.firstName} ${fuzzyByCodeField.lastName} (รหัส ${fuzzyByCodeField.studentCode})`,
        });
        return;
      }
    }

    if (textQuery) {
      const bySearch = students.find(
        (s) =>
          s.studentCode.toLowerCase().includes(textQuery) ||
          s.firstName.toLowerCase().includes(textQuery) ||
          s.lastName.toLowerCase().includes(textQuery) ||
          s.nickname.toLowerCase().includes(textQuery)
      );
      if (bySearch) {
        recordLocalSearchSaving();
        populateStudentFields(bySearch);
        setStudentFetchFeedback({
          type: 'success',
          message: `ดึงข้อมูลนักเรียนสำเร็จ: ${bySearch.prefix}${bySearch.firstName} ${bySearch.lastName} (รหัส ${bySearch.studentCode})`,
        });
        return;
      }
    }

    setStudentFetchFeedback({
      type: 'warning',
      message:
        students.length === 0
          ? 'ยังไม่มีรายชื่อนักเรียนในแคชของเครื่อง คุณสามารถกรอกข้อมูลนักเรียนในฟอร์มด้านล่างโดยตรง หรือกดปุ่มนำเข้าข้อมูลนักเรียน'
          : `ไม่พบข้อมูลนักเรียนจากคำค้น "${codeQuery || textQuery}" สามารถกรอกข้อมูลนักเรียนด้านล่างได้โดยตรง`,
    });
  };

  // กรองรายชื่อนักเรียนจากข้อมูลจริงที่นำเข้าแล้ว
  const filteredStudentSuggestions = useMemo(() => {
    const q = (studentSearchQuery.trim() || studentCodeInput.trim()).toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter(
        (s) =>
          s.studentCode.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.nickname.toLowerCase().includes(q) ||
          s.dormitory.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [students, studentSearchQuery, studentCodeInput]);

  // สีประจำหอพัก (Color-Coding)
  const activeDormitoryName = studentDormitory.trim() || (matchedStudent ? matchedStudent.dormitory : '');
  const dormTheme = useMemo(() => getDormitoryTheme(activeDormitoryName), [activeDormitoryName]);

  const handleTrackingChange = useCallback((val: string) => {
    setTrackingNumber(val);
    setFormError(null);
    if (val.trim().length >= 2) {
      setCourier(detectCourierFromTracking(val));
    }
  }, []);

  const handleSelectCourier = useCallback(
    (selectedCourier: string) => {
      setCourier(selectedCourier);
      setFormError(null);
      if (selectedCourier === 'ผู้ปกครองฝากส่ง') {
        const autoTracking = generateUniqueParentTrackingNumber(parcels);
        setTrackingNumber(autoTracking);
        setLastScannedCode(null);
      } else if (trackingNumber.trim().toUpperCase().startsWith('PRT-')) {
        setTrackingNumber('');
      }
    },
    [parcels, trackingNumber]
  );

  // จัดการเมื่อสแกนบาร์โค้ดผ่านกล้องสำเร็จ
  const handleBarcodeDetected = useCallback(
    (decodedText: string) => {
      const cleaned = decodedText.trim();
      if (!cleaned) return;
      playScanBeep();
      handleTrackingChange(cleaned);
      setLastScannedCode(cleaned);
      setIsScannerOpen(false);
      setTimeout(() => {
        if (studentCodeInputRef.current) {
          studentCodeInputRef.current.focus();
        }
      }, 150);
    },
    [handleTrackingChange]
  );

  // ตรวจสอบสถานะสิทธิ์การใช้กล้องจากเบราว์เซอร์เมื่อเริ่มต้น
  useEffect(() => {
    let permStatus: PermissionStatus | null = null;
    const handlePermChange = () => {
      if (!permStatus) return;
      if (permStatus.state === 'granted') setCameraPermission('granted');
      else if (permStatus.state === 'denied') setCameraPermission('denied');
      else setCameraPermission('prompt');
    };

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((statusObj) => {
          permStatus = statusObj;
          handlePermChange();
          statusObj.addEventListener('change', handlePermChange);
        })
        .catch(() => {
          // บางเบราว์เซอร์เช่น Safari อาจไม่รองรับ permissions.query('camera')
        });
    }

    return () => {
      if (permStatus) {
        permStatus.removeEventListener('change', handlePermChange);
      }
    };
  }, []);

  // ฟังก์ชันขออนุญาตใช้กล้องจากเบราว์เซอร์โดยตรง (เรียกทันทีเมื่อผู้ใช้กดปุ่ม เพื่อให้เด้ง Popup ขออนุญาตใช้กล้องเสมอ)
  const requestCameraPermissionAndOpenScanner = useCallback(async () => {
    setCameraError(null);
    setCameraPermission('requesting');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('denied');
      setCameraError(
        'เบราว์เซอร์ของคุณไม่รองรับการเปิดกล้องโดยตรง (ต้องใช้งานผ่าน HTTPS หรือ localhost) คุณสามารถกดปุ่ม "ถ่ายรูป/เลือกรูปบาร์โค้ด" เพื่อสแกนได้ทันที'
      );
      setIsScannerOpen(true);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // ขออนุญาตใช้กล้องหลังก่อน (สำหรับมือถือ/แท็บเล็ต)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
      } catch {
        // หากเป็นโน้ตบุ๊กหรือคอมพิวเตอร์ที่มีแต่กล้องหน้า ให้ขออนุญาตกล้องใดก็ได้ที่มีในเครื่อง
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      // ปิด Stream ชั่วคราวทันทีหลังจากได้รับสิทธิ์ เพื่อส่งต่อกล้องให้ตัวอ่านบาร์โค้ด Html5Qrcode
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermission('granted');

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const mapped = devices.map((d, idx) => ({
            id: d.id,
            label: d.label || `กล้องอุปกรณ์ #${idx + 1}`,
          }));
          setAvailableCameras(mapped);
          // เลือกกล้องหลังอัตโนมัติถ้าพบชื่อ back/rear/environment
          const rearCam = mapped.find((c) =>
            /back|rear|environment|หลัง/i.test(c.label)
          );
          if (rearCam && !selectedCameraId) {
            setSelectedCameraId(rearCam.id);
          }
        }
      } catch {
        // proceed with default camera
      }

      setIsScannerOpen(true);
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      setCameraPermission('denied');
      setIsScannerOpen(true);
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'คุณยังไม่ได้กดอนุญาตให้ใช้กล้อง กรุณากดที่ไอคอนรูปแม่กุญแจ 🔒 หรือรูปกล้อง 📷 บนแถบ URL ด้านบนของเบราว์เซอร์ แล้วเลือก "อนุญาต (Allow)" สำหรับกล้อง จากนั้นกดปุ่ม "ขออนุญาตใช้กล้องอีกครั้ง"'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError(
          'ไม่พบอุปกรณ์กล้องในเครื่องนี้ คุณสามารถกดปุ่ม "ถ่ายรูป/เลือกรูปบาร์โค้ด" ด้านล่างเพื่อสแกนจากรูปภาพแทนได้ทันที'
        );
      } else {
        setCameraError(
          'ไม่สามารถเข้าถึงกล้องได้ในขณะนี้ (อาจมีโปรแกรมอื่นกำลังใช้กล้องอยู่ หรือยังไม่ได้อนุญาตสิทธิ์กล้อง) กรุณากด "ขออนุญาตใช้กล้องอีกครั้ง" หรือใช้ปุ่มถ่ายรูปบาร์โค้ด'
        );
      }
    }
  }, [facingMode, selectedCameraId]);

  const handleToggleScanner = useCallback(() => {
    if (isScannerOpen) {
      setIsScannerOpen(false);
    } else {
      requestCameraPermissionAndOpenScanner();
    }
  }, [isScannerOpen, requestCameraPermissionAndOpenScanner]);

  // เปิด/ปิดและถอดรหัสบาร์โค้ดผ่านกล้องอุปกรณ์ด้วย Html5Qrcode
  useEffect(() => {
    if (!isScannerOpen || cameraPermission === 'denied' || cameraPermission === 'requesting') {
      if (html5QrCodeRef.current) {
        const scanner = html5QrCodeRef.current;
        html5QrCodeRef.current = null;
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        }
      }
      return;
    }

    let isMounted = true;
    setCameraError(null);

    const startScanner = async () => {
      try {
        let detectedDevices: { id: string; label: string }[] = [];
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            detectedDevices = devices.map((d, idx) => ({
              id: d.id,
              label: d.label || `กล้องอุปกรณ์ #${idx + 1}`,
            }));
            if (isMounted) {
              setAvailableCameras(detectedDevices);
            }
          }
        } catch {
          // ignore camera list error
        }

        if (!isMounted) return;

        const readerElement = document.getElementById('inbound-barcode-reader');
        if (!readerElement) return;

        const scannerInstance = new Html5Qrcode('inbound-barcode-reader', {
          formatsToSupport: SUPPORTED_BARCODE_FORMATS,
          verbose: false,
        });
        html5QrCodeRef.current = scannerInstance;

        const scanConfig = {
          fps: 15,
          qrbox: { width: 260, height: 140 },
        };

        const onScanSuccess = (decodedText: string) => {
          if (isMounted) {
            handleBarcodeDetected(decodedText);
          }
        };

        const onScanFailure = () => {
          // ignore frame scan miss
        };

        // ลองเปิดกล้องตามลำดับ Fallback เพื่อรองรับทั้งมือถือ (กล้องหลัง) และโน้ตบุ๊ก/PC (Webcam)
        try {
          const primaryTarget = selectedCameraId
            ? selectedCameraId
            : { facingMode };
          await scannerInstance.start(primaryTarget, scanConfig, onScanSuccess, onScanFailure);
        } catch {
          if (detectedDevices.length > 0) {
            await scannerInstance.start(
              detectedDevices[0].id,
              scanConfig,
              onScanSuccess,
              onScanFailure
            );
          } else {
            await scannerInstance.start(
              { facingMode: 'user' },
              scanConfig,
              onScanSuccess,
              onScanFailure
            );
          }
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'ไม่สามารถเปิดสตรีมกล้องสดได้ กรุณากดปุ่ม "ขออนุญาตใช้กล้องอีกครั้ง" หรือกดปุ่ม "ถ่ายรูปบาร์โค้ด / เลือกรูปจากอุปกรณ์" ด้านล่าง'
          );
        }
      }
    };

    const timer = setTimeout(startScanner, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        const scanner = html5QrCodeRef.current;
        html5QrCodeRef.current = null;
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
        }
      }
    };
  }, [isScannerOpen, cameraPermission, selectedCameraId, facingMode, handleBarcodeDetected]);

  // สแกนบาร์โค้ดจากไฟล์ภาพถ่ายกล้องอุปกรณ์ (Fallback / Mobile Camera Capture)
  const handleScanBarcodeFromImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFile(true);
    setCameraError(null);

    try {
      const fileScanner = new Html5Qrcode('inbound-barcode-file-reader', {
        formatsToSupport: SUPPORTED_BARCODE_FORMATS,
        verbose: false,
      });
      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      handleBarcodeDetected(decodedText);
    } catch {
      setCameraError(
        'ไม่พบบาร์โค้ดในภาพที่เลือก กรุณาถ่ายภาพให้เห็นแถบบาร์โค้ดชัดเจน หรือพิมพ์เลขพัสดุในช่องกรอก'
      );
    } finally {
      setIsScanningFile(false);
      if (barcodeFileInputRef.current) {
        barcodeFileInputRef.current.value = '';
      }
    }
  };

  // บันทึกข้อมูลนักเรียนที่กรอกลงทะเบียนนักเรียนโดยตรง
  const handleSaveStudentOnly = async () => {
    const code = studentCodeInput.trim();
    const fullName = studentFullName.trim();
    if (!code || !fullName) {
      setFormError('กรุณากรอกรหัสนักเรียนและชื่อ-นามสกุลก่อนบันทึกลงทะเบียนนักเรียน');
      return;
    }

    const nameWithoutPrefix = fullName.replace(/^(นาย|นางสาว|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/, '').trim();
    const nameParts = nameWithoutPrefix.split(/\s+/);
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.slice(1).join(' ') || '-';

    const gradeParts = (studentGradeRoom.trim() || '-/-').split('/');
    const grade = gradeParts[0] || '-';
    const room = gradeParts[1] || '-';

    await upsertSingleStudent({
      seqNo: matchedStudent ? matchedStudent.seqNo : students.length + 1,
      studentCode: code,
      prefix: studentPrefix || '-',
      firstName,
      lastName,
      nickname: studentNickname.trim() || '-',
      grade,
      room,
      dormitory: studentDormitory.trim() || '-',
      dormRoom: studentDormRoom.trim() || '-',
      bed: matchedStudent?.bed || '-',
    });

    setStudentFetchFeedback({
      type: 'success',
      message: `บันทึกข้อมูลนักเรียนรหัส ${code} (${fullName}) ลงในระบบเรียบร้อยแล้ว`,
    });
  };

  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalTracking = trackingNumber.trim();
    const isDuplicateInDb = parcels.some(
      (p) =>
        p.id.toUpperCase() === finalTracking.toUpperCase() ||
        p.trackingNumber.toUpperCase() === finalTracking.toUpperCase()
    );

    if (courier === 'ผู้ปกครองฝากส่ง') {
      if (!finalTracking || isDuplicateInDb) {
        finalTracking = generateUniqueParentTrackingNumber(parcels);
        setTrackingNumber(finalTracking);
      }
    } else {
      if (!finalTracking) {
        setFormError('กรุณายิงบาร์โค้ดผ่านกล้อง หรือกรอกเลข Tracking พัสดุในขั้นตอนที่ 1');
        if (trackingInputRef.current) trackingInputRef.current.focus();
        return;
      }
      if (isDuplicateInDb) {
        setFormError(`เลขพัสดุ "${finalTracking}" มีอยู่ในฐานข้อมูลแล้ว ไม่สามารถบันทึกซ้ำได้`);
        if (trackingInputRef.current) trackingInputRef.current.focus();
        return;
      }
    }

    const finalStudentCode = studentCodeInput.trim();
    const finalStudentName = studentFullName.trim();
    if (!finalStudentCode && !finalStudentName && status !== 'พัสดุไม่ทราบเจ้าของ') {
      setFormError('กรุณากรอกข้อมูลนักเรียน หรือดึงข้อมูลนักเรียนในขั้นตอนที่ 2 (หรือเลือกสถานะ "พัสดุไม่ทราบเจ้าของ")');
      if (studentCodeInputRef.current) studentCodeInputRef.current.focus();
      return;
    }

    // ตรวจสอบการกรอกประเภทสิ่งของ กรณีเลือก "อื่นๆ" หรือ "เครื่องสำอาง"
    const trimmedDetail = customCategoryDetail.trim();
    if (category === 'อื่นๆ' && !trimmedDetail) {
      setFormError('กรุณาระบุรายละเอียดประเภทสิ่งของในช่อง "อื่นๆ ให้กรอกว่าเป็นอะไร"');
      if (customCategoryInputRef.current) customCategoryInputRef.current.focus();
      return;
    }

    const formattedCategory: ParcelCategory = trimmedDetail
      ? `${category} (${trimmedDetail})`
      : category;

    const savedParcel = await addInboundParcel({
      trackingNumber: finalTracking,
      studentCode: finalStudentCode || 'UNKNOWN',
      category: formattedCategory,
      status,
      courier,
      note,
      customStudent: {
        studentFullName:
          finalStudentName ||
          (matchedStudent
            ? `${matchedStudent.prefix}${matchedStudent.firstName} ${matchedStudent.lastName}`
            : status === 'พัสดุไม่ทราบเจ้าของ'
            ? 'พัสดุไม่ทราบเจ้าของ'
            : '-'),
        nickname:
          studentNickname.trim() || (matchedStudent ? matchedStudent.nickname : '-'),
        gradeRoom:
          studentGradeRoom.trim() ||
          (matchedStudent ? `${matchedStudent.grade}/${matchedStudent.room}` : '-'),
        dormitory:
          studentDormitory.trim() ||
          (matchedStudent ? matchedStudent.dormitory : '-'),
        dormRoom:
          studentDormRoom.trim() || (matchedStudent ? matchedStudent.dormRoom : '-'),
        bed: matchedStudent ? matchedStudent.bed : '-',
      },
    });

    if (courier === 'ผู้ปกครองฝากส่ง') {
      const nextParentTracking = generateUniqueParentTrackingNumber([savedParcel, ...parcels]);
      setTrackingNumber(nextParentTracking);
    } else {
      setTrackingNumber('');
    }
    setLastScannedCode(null);
    setCustomCategoryDetail('');
    setNote('');
    if (trackingInputRef.current) {
      trackingInputRef.current.focus();
    }
  };

  // นับจำนวนพัสดุแยกตามหอพักสำหรับตัวกรอง "รายการพัสดุที่รับเข้าล่าสุด"
  const dormParcelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: parcels.length };
    for (const d of availableDormitories) {
      counts[d] = 0;
    }
    for (const p of parcels) {
      const dName = (p.dormitory || '').trim();
      if (dName) {
        counts[dName] = (counts[dName] || 0) + 1;
      }
    }
    return counts;
  }, [parcels, availableDormitories]);

  // กรองรายการพัสดุที่รับเข้าล่าสุดตามหอพักที่เลือก พร้อมแบ่งหน้า
  const allFilteredRecentParcels = useMemo(() => {
    return recentDormFilter === 'ALL'
      ? parcels
      : parcels.filter((p) => p.dormitory.trim() === recentDormFilter);
  }, [parcels, recentDormFilter]);

  const effectivePageSize = useMemo(() => {
    if (recentPageSize === 'ALL') {
      return Math.max(1, allFilteredRecentParcels.length);
    }
    return Number(recentPageSize) || 10;
  }, [recentPageSize, allFilteredRecentParcels.length]);

  const totalRecentPages = useMemo(
    () => Math.max(1, Math.ceil(allFilteredRecentParcels.length / effectivePageSize)),
    [allFilteredRecentParcels.length, effectivePageSize]
  );

  const currentRecentPage = Math.min(recentPage, totalRecentPages);

  const filteredRecentParcels = useMemo(() => {
    if (recentPageSize === 'ALL') {
      return allFilteredRecentParcels;
    }
    const startIdx = (currentRecentPage - 1) * effectivePageSize;
    return allFilteredRecentParcels.slice(startIdx, startIdx + effectivePageSize);
  }, [allFilteredRecentParcels, currentRecentPage, effectivePageSize, recentPageSize]);

  return (
    <div className="space-y-8">
      {/* Hidden container สำหรับสแกนบาร์โค้ดจากไฟล์รูปภาพ */}
      <div id="inbound-barcode-file-reader" className="hidden" />

      {/* ส่วนหัวหน้าจอรับเข้าพัสดุ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            จุดคัดแยกพัสดุส่วนกลาง · รองรับการยิงบาร์โค้ดผ่านกล้องอุปกรณ์ และดึงข้อมูลนักเรียนอัตโนมัติ
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            ระบบลงทะเบียนรับเข้าและคัดแยกพัสดุประจำหอพัก (Inbound)
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleScanner}
            className="min-h-[44px] px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>
              {isScannerOpen
                ? 'ปิดกล้องสแกนบาร์โค้ด'
                : cameraPermission === 'granted'
                ? 'เปิดกล้องสแกนบาร์โค้ด'
                : 'ขออนุญาตใช้กล้อง & สแกนบาร์โค้ด'}
            </span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center justify-between gap-3">
          <span>{formError}</span>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-red-600 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* คอลัมน์ซ้าย: ฟอร์ม 5 ขั้นตอนตามความต้องการของผู้ใช้ */}
        <form onSubmit={handleSubmitInbound} className="lg:col-span-7 space-y-6">
          {/* ขั้นตอนที่ 1: ยิงบาร์โค้ดผ่านกล้องอุปกรณ์ หรือสแกน/กรอกเลข Tracking */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="tracking-number-input"
                className="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                <Barcode className="w-5 h-5 text-slate-700" />
                <span>1. ยิงบาร์โค้ดผ่านกล้องอุปกรณ์ หรือสแกนเลขพัสดุ</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleScanner}
                  className={`min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isScannerOpen
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>
                    {isScannerOpen
                      ? 'ปิดกล้องสแกน'
                      : cameraPermission === 'granted'
                      ? 'เปิดกล้องสแกนโค้ด'
                      : 'ขออนุญาตใช้กล้องสแกน'}
                  </span>
                </button>

                <label className="min-h-[40px] px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer">
                  <ImageUp className="w-4 h-4 shrink-0" />
                  <span>{isScanningFile ? 'กำลังอ่าน...' : 'ถ่ายรูป/เลือกรูปบาร์โค้ด'}</span>
                  <input
                    ref={barcodeFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScanBarcodeFromImage}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* แถบแสดงสถานะการขออนุญาตใช้กล้อง (แสดงเมื่อยังไม่เปิดกล้องและยังไม่ได้อนุญาตสิทธิ์) */}
            {!isScannerOpen && cameraPermission !== 'granted' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    ต้องการสแกนบาร์โค้ดหรือ QR Code จากกล่องพัสดุ? กดปุ่มเพื่อ<strong>ขออนุญาตเปิดใช้งานกล้องของอุปกรณ์</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={requestCameraPermissionAndOpenScanner}
                  className="min-h-[36px] px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shrink-0 self-start sm:self-center cursor-pointer"
                >
                  อนุญาตให้ใช้กล้องเพื่อสแกนโค้ด
                </button>
              </div>
            )}

            {/* หน้าจอกล้องสแกนบาร์โค้ดสด (Inline Device Camera Barcode Scanner) */}
            {isScannerOpen && (
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <Camera className="w-4 h-4" />
                    <span>
                      {cameraPermission === 'requesting'
                        ? 'กำลังขออนุญาตใช้กล้องจากเบราว์เซอร์ กรุณากด "อนุญาต (Allow)" บนหน้าต่างที่เด้งขึ้นมา...'
                        : 'หันกล้องอุปกรณ์ไปที่บาร์โค้ดหรือ QR Code บนกล่องพัสดุ'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {availableCameras.length > 1 ? (
                      <select
                        aria-label="เลือกกล้องอุปกรณ์"
                        value={selectedCameraId}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg"
                      >
                        <option value="">อัตโนมัติ ({facingMode === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'})</option>
                        {availableCameras.map((cam) => (
                          <option key={cam.id} value={cam.id}>
                            {cam.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCameraId('');
                          setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>สลับกล้อง ({facingMode === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    >
                      ปิดกล้อง
                    </button>
                  </div>
                </div>

                {cameraPermission === 'requesting' ? (
                  <div className="rounded-xl bg-slate-950 min-h-[200px] p-6 flex flex-col items-center justify-center text-center gap-3">
                    <Camera className="w-8 h-8 text-emerald-400 animate-pulse" />
                    <p className="text-sm font-bold text-white">
                      ระบบกำลังขออนุญาตใช้กล้องเพื่อสแกนโค้ด...
                    </p>
                    <p className="text-xs text-slate-300 max-w-md">
                      กรุณากดปุ่ม <strong>&quot;อนุญาต (Allow)&quot;</strong> หรือ <strong>&quot;ขณะใช้เว็บไซต์&quot;</strong> บนหน้าต่างแจ้งเตือนของเบราว์เซอร์ด้านบน
                    </p>
                  </div>
                ) : !cameraError ? (
                  <div className="relative rounded-xl overflow-hidden bg-black min-h-[240px] flex items-center justify-center">
                    <div id="inbound-barcode-reader" className="w-full" />
                  </div>
                ) : (
                  <div className="p-4 bg-amber-950/90 border border-amber-700 rounded-xl flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200 leading-relaxed">{cameraError}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={requestCameraPermissionAndOpenScanner}
                        className="min-h-[40px] px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>ขออนุญาตใช้กล้องอีกครั้ง</span>
                      </button>

                      <label className="min-h-[40px] px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
                        <ImageUp className="w-4 h-4" />
                        <span>ถ่ายภาพบาร์โค้ดด้วยกล้อง</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleScanBarcodeFromImage}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {lastScannedCode && (
              <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    สแกนบาร์โค้ดสำเร็จ: <strong className="font-mono">{lastScannedCode}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={requestCameraPermissionAndOpenScanner}
                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  สแกนซ้ำ
                </button>
              </div>
            )}

            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={trackingInputRef}
                  id="tracking-number-input"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => handleTrackingChange(e.target.value)}
                  placeholder="ยิงบาร์โค้ดผ่านกล้อง / เครื่องสแกน หรือพิมพ์เลขพัสดุ..."
                  className="w-full min-h-[52px] px-4 pr-10 py-3 text-base font-mono font-semibold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
                />
                {trackingNumber && (
                  <button
                    type="button"
                    aria-label="ล้างเลขพัสดุ"
                    onClick={() => {
                      setTrackingNumber('');
                      setLastScannedCode(null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleScanner}
                title="เปิดกล้องเพื่อสแกนบาร์โค้ด"
                className="min-h-[52px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">สแกนโค้ด</span>
              </button>
            </div>

            {/* ปุ่มเลือกบริษัทขนส่ง */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="block text-xs font-medium text-slate-500">
                  บริษัทขนส่ง (ตรวจจับอัตโนมัติจากเลขพัสดุ หรือกดเลือกเอง):
                </span>
                {courier === 'ผู้ปกครองฝากส่ง' && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextCode = generateUniqueParentTrackingNumber(parcels);
                      setTrackingNumber(nextCode);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>สุ่มสร้างเลขพัสดุใหม่ (ไม่ซ้ำในฐานข้อมูล)</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {COURIER_LIST.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleSelectCourier(c)}
                    className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                      courier === c
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ขั้นตอนที่ 2: กรอกข้อมูลนักเรียน และดึงข้อมูลนักเรียน */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="student-code-input"
                className="text-base font-bold text-slate-900 flex items-center gap-2"
              >
                <UserCheck className="w-5 h-5 text-slate-700" />
                <span>2. กรอกข้อมูลนักเรียน และดึงข้อมูลนักเรียน</span>
              </label>

              <div className="flex items-center gap-2">
                {user && (
                  <button
                    type="button"
                    onClick={pullFromFirebaseToLocal}
                    disabled={isSyncing}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>ซิงก์รายชื่อจาก Cloud</span>
                  </button>
                )}
              </div>
            </div>

            {/* แถบค้นหาและปุ่มกดดึงข้อมูลนักเรียน */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="student-code-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    รหัสนักเรียน
                  </label>
                  <input
                    ref={studentCodeInputRef}
                    id="student-code-input"
                    type="text"
                    value={studentCodeInput}
                    onChange={(e) => {
                      setStudentCodeInput(e.target.value);
                      setFormError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFetchStudentData();
                      }
                    }}
                    placeholder="กรอกรหัสนักเรียน..."
                    className="w-full min-h-[46px] px-3.5 py-2 text-sm font-mono font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="student-quick-filter"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    ค้นหาด้วยชื่อ / ชื่อเล่น / หอพัก
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-quick-filter"
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFetchStudentData();
                        }
                      }}
                      placeholder="พิมพ์ชื่อ หรือชื่อเล่น..."
                      className="w-full min-h-[46px] pl-9 pr-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleFetchStudentData}
                    className="w-full min-h-[46px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <span>ดึงข้อมูลนักเรียน</span>
                  </button>
                </div>
              </div>

              {/* รายชื่อนักเรียนแนะนำให้กดดึงข้อมูลได้ทันที */}
              {students.length > 0 && (
                <div className="pt-1">
                  <span className="block text-xs font-medium text-slate-500 mb-1.5">
                    คลิกเลือกนักเรียนเพื่อดึงข้อมูลอัตโนมัติ ({filteredStudentSuggestions.length} รายการ):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredStudentSuggestions.map((st) => {
                      const isSelected = st.studentCode === studentCodeInput.trim();
                      const stStats = getStudentParcelCounts(st.studentCode, undefined, st);
                      return (
                        <button
                          key={st.studentCode}
                          type="button"
                          onClick={() => {
                            populateStudentFields(st);
                            setStudentFetchFeedback({
                              type: 'success',
                              message: `ดึงข้อมูลนักเรียน: ${st.prefix}${st.firstName} ${st.lastName} (${st.dormitory} ห้อง ${st.dormRoom})`,
                            });
                          }}
                          className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : stStats.isOverWeeklyLimit
                              ? 'bg-red-50 text-red-900 border-red-300 hover:bg-red-100'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-mono font-bold">{st.studentCode}</span>
                          <span>·</span>
                          <span>
                            {st.firstName} {st.nickname && st.nickname !== '-' ? `(${st.nickname})` : ''}
                          </span>
                          <span className="font-mono text-[11px] opacity-85 tabular-nums">
                            (ส.{stStats.weekCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {studentFetchFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                    studentFetchFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <span>{studentFetchFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setStudentFetchFeedback(null)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ฟอร์มกรอก/แก้ไขข้อมูลนักเรียนผู้รับพัสดุโดยตรง */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  ข้อมูลนักเรียนผู้รับพัสดุ (ดึงอัตโนมัติ หรือกรอก/แก้ไขข้อมูลได้โดยตรง):
                </span>
                <button
                  type="button"
                  onClick={handleSaveStudentOnly}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>บันทึกคนนี้ลงทะเบียนนักเรียน</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">คำนำหน้า</label>
                  <select
                    aria-label="คำนำหน้าชื่อนักเรียน"
                    value={studentPrefix}
                    onChange={(e) => setStudentPrefix(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ชื่อ-นามสกุลนักเรียน *
                  </label>
                  <input
                    type="text"
                    value={studentFullName}
                    onChange={(e) => setStudentFullName(e.target.value)}
                    placeholder="กรอกชื่อ-นามสกุลผู้รับ..."
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อเล่น</label>
                  <input
                    type="text"
                    value={studentNickname}
                    onChange={(e) => setStudentNickname(e.target.value)}
                    placeholder="ชื่อเล่น..."
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    ระดับชั้น/ห้อง
                  </label>
                  <input
                    type="text"
                    value={studentGradeRoom}
                    onChange={(e) => setStudentGradeRoom(e.target.value)}
                    placeholder="ระบุระดับชั้น/ห้อง..."
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    หอพัก *
                  </label>
                  <input
                    type="text"
                    list="dormitory-options-list"
                    value={studentDormitory}
                    onChange={(e) => setStudentDormitory(e.target.value)}
                    placeholder="ระบุชื่อหอพัก..."
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                  <datalist id="dormitory-options-list">
                    {availableDormitories.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">ห้องพักหอ</label>
                  <input
                    type="text"
                    value={studentDormRoom}
                    onChange={(e) => setStudentDormRoom(e.target.value)}
                    placeholder="ห้องพักหอ"
                    className="w-full min-h-[44px] px-3 py-2 text-sm font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* แสดงการนับจำนวนพัสดุของนักเรียนคนนี้ แยกเป็น วัน, สัปดาห์, เดือน */}
              {(studentCodeInput.trim() || studentFullName.trim() || matchedStudent) && (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    activeStudentParcelStats.isOverWeeklyLimit
                      ? 'bg-red-50 border-red-300'
                      : activeStudentParcelStats.weekCount === WEEKLY_PARCEL_WARNING_LIMIT
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      สถิติจำนวนพัสดุสะสมของนักเรียนคนนี้ (วัน / สัปดาห์ / เดือน):
                    </span>
                    {activeStudentParcelStats.isOverWeeklyLimit ? (
                      <button
                        type="button"
                        onClick={() => openWeeklyWarningPopup(activeStudentParcelStats, 'manual')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          แจ้งเตือน! เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์ (คลิกดู Popup)
                        </span>
                      </button>
                    ) : activeStudentParcelStats.weekCount === WEEKLY_PARCEL_WARNING_LIMIT ? (
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          รับครบ {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นในสัปดาห์นี้แล้ว (ชิ้นถัดไปจะแจ้งเตือน Popup)
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                      <span className="block text-[11px] font-semibold text-slate-500">
                        วัน (วันนี้)
                      </span>
                      <span className="block text-xl font-mono font-extrabold text-slate-900 tabular-nums mt-0.5">
                        {activeStudentParcelStats.dayCount}
                      </span>
                      <span className="block text-[10px] text-slate-500">ชิ้น</span>
                    </div>

                    <div
                      className={`bg-white rounded-xl p-2.5 border ${
                        activeStudentParcelStats.isOverWeeklyLimit
                          ? 'border-2 border-red-600'
                          : 'border-slate-200'
                      }`}
                    >
                      <span
                        className={`block text-[11px] font-bold ${
                          activeStudentParcelStats.isOverWeeklyLimit
                            ? 'text-red-700'
                            : 'text-slate-600'
                        }`}
                      >
                        สัปดาห์ (7 วัน)
                      </span>
                      <span
                        className={`block text-xl font-mono font-extrabold tabular-nums mt-0.5 ${
                          activeStudentParcelStats.isOverWeeklyLimit
                            ? 'text-red-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {activeStudentParcelStats.weekCount}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        ชิ้น (เกณฑ์ไม่เกิน {WEEKLY_PARCEL_WARNING_LIMIT})
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5">
                      <span className="block text-[11px] font-semibold text-slate-500">
                        เดือน (เดือนนี้)
                      </span>
                      <span className="block text-xl font-mono font-extrabold text-slate-900 tabular-nums mt-0.5">
                        {activeStudentParcelStats.monthCount}
                      </span>
                      <span className="block text-[10px] text-slate-500">ชิ้น</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ขั้นตอนที่ 3: กรอกประเภทสิ่งของ (เพิ่ม เครื่องสำอาง และ อื่นๆ ให้กรอกว่าเป็นอะไร) */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div>
              <span className="block text-base font-bold text-slate-900">
                3. กรอกประเภทสิ่งของ
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                เลือกหมวดหมู่สิ่งของ (กรณีเลือก "เครื่องสำอาง" หรือ "อื่นๆ" สามารถระบุรายละเอียดว่าเป็นอะไรได้ด้านล่าง)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PARCEL_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setFormError(null);
                    }}
                    className={`min-h-[52px] px-3.5 py-2.5 text-sm font-semibold rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* ช่องกรอกรายละเอียดว่าเป็นอะไร (แสดงเด่นชัดเมื่อเลือก "อื่นๆ" หรือ "เครื่องสำอาง" และอนุญาตให้ระบุเพิ่มเติมได้ทุกหมวด) */}
            <div
              className={`p-4 rounded-xl border space-y-2 transition-colors ${
                category === 'อื่นๆ' || category === 'เครื่องสำอาง'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <label
                htmlFor="custom-category-detail-input"
                className="block text-xs font-bold text-slate-800"
              >
                {category === 'อื่นๆ'
                  ? 'ระบุประเภทสิ่งของ (อื่นๆ ว่าเป็นอะไร) *'
                  : category === 'เครื่องสำอาง'
                  ? 'ระบุรายละเอียดเครื่องสำอาง (ว่าเป็นอะไร)'
                  : `ระบุรายละเอียดสิ่งของเพิ่มเติมสำหรับ "${category}" (ถ้ามี)`}
              </label>
              <input
                ref={customCategoryInputRef}
                id="custom-category-detail-input"
                type="text"
                value={customCategoryDetail}
                onChange={(e) => {
                  setCustomCategoryDetail(e.target.value);
                  setFormError(null);
                }}
                placeholder={
                  category === 'อื่นๆ'
                    ? 'กรอกว่าเป็นอะไร...'
                    : category === 'เครื่องสำอาง'
                    ? 'กรอกรายละเอียดเครื่องสำอางว่าเป็นอะไร...'
                    : 'ระบุว่าเป็นอะไร (เว้นว่างได้)...'
                }
                className="w-full min-h-[46px] px-4 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
              />
            </div>
          </section>

          {/* ขั้นตอนที่ 4: เลือกสถานะการคัดแยกพัสดุ */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <div>
              <span className="block text-base font-bold text-slate-900">
                4. เลือกสถานะการคัดแยกพัสดุ
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                เลือกสถานะพัสดุ: ลงทะเบียนรับพัสดุ, พัสดุติดนิติการ หรือ พัสดุไม่ทราบเจ้าของ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {INBOUND_STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`min-h-[64px] p-4 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                      active ? opt.activeClass : opt.inactiveClass
                    }`}
                  >
                    <div className="font-bold text-sm">{opt.label}</div>
                    <div className={`text-xs mt-1 ${active ? opt.descActiveClass : opt.descInactiveClass}`}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {status === 'ติดนิติการ' && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <span className="block text-xs font-bold text-red-900">
                  กดเลือกสาเหตุที่พัสดุติดนิติการด่วน:
                </span>
                <div className="flex flex-wrap gap-2">
                  {LEGAL_HOLD_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setNote(reason)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white border border-red-300 text-red-900 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="parcel-note-input" className="block text-xs font-medium text-slate-600 mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                id="parcel-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ระบุลักษณะกล่อง หรือหมายเหตุการตรวจสอบ..."
                className="w-full min-h-[46px] px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[56px] px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <PackagePlus className="w-5 h-5" />
              <span>บันทึกลงทะเบียนพัสดุ</span>
            </button>
          </section>
        </form>

        {/* คอลัมน์ขวา: จอแสดงสีประจำหอพักขนาดใหญ่ + รายการพัสดุที่รับเข้าล่าสุด (เลือกแสดงเป็นหอพักได้) */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-label="ป้ายสีประจำหอพักสำหรับคัดแยกตะกร้า"
            className={`rounded-2xl border-4 ${dormTheme.borderClass} ${dormTheme.bgClass} p-6 space-y-5 transition-colors`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-600">
                  จุดคัดแยกลงตะกร้าหอพัก (Color-Coding Guide)
                </span>
                <h2 className={`text-2xl font-extrabold ${dormTheme.textClass} mt-0.5`}>
                  {dormTheme.name}
                </h2>
              </div>
              <div className={`px-4 py-2.5 rounded-xl font-mono font-extrabold text-lg ${dormTheme.accentBgClass}`}>
                {dormTheme.basketCode}
              </div>
            </div>

            {studentFullName.trim() || matchedStudent ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-medium text-slate-600">ชื่อ-นามสกุลนักเรียนผู้รับ</span>
                  <div className={`text-xl font-bold ${dormTheme.textClass}`}>
                    {studentFullName.trim() ||
                      `${matchedStudent?.prefix || ''}${matchedStudent?.firstName || ''} ${
                        matchedStudent?.lastName || ''
                      }`}{' '}
                    {(studentNickname.trim() || matchedStudent?.nickname) && (
                      <span className="font-normal text-base">
                        ({studentNickname.trim() || matchedStudent?.nickname})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
                    รหัสนักเรียน: {studentCodeInput.trim() || matchedStudent?.studentCode || '-'} · ชั้น{' '}
                    {studentGradeRoom.trim() ||
                      (matchedStudent ? `${matchedStudent.grade}/${matchedStudent.room}` : '-')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white/90 border border-black/10 rounded-xl p-3.5">
                    <span className="block text-xs font-medium text-slate-500">สีตะกร้าคัดแยก</span>
                    <span className={`block text-sm font-bold mt-1 ${dormTheme.textClass}`}>
                      {dormTheme.colorName}
                    </span>
                  </div>
                  <div className="bg-white/90 border border-black/10 rounded-xl p-3.5">
                    <span className="block text-xs font-medium text-slate-500">ห้องพักหอ</span>
                    <span className={`block text-2xl font-mono font-extrabold tabular-nums mt-0.5 ${dormTheme.textClass}`}>
                      {studentDormRoom.trim() || matchedStudent?.dormRoom || '-'}
                    </span>
                  </div>
                </div>

                {/* แสดงจำนวนพัสดุของนักเรียน (วัน / สัปดาห์ / เดือน) บนการ์ดคัดแยกตะกร้า */}
                <div className="bg-white/90 border border-black/10 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      จำนวนพัสดุของนักเรียน (วัน / สัปดาห์ / เดือน)
                    </span>
                    {activeStudentParcelStats.isOverWeeklyLimit && (
                      <button
                        type="button"
                        onClick={() => openWeeklyWarningPopup(activeStudentParcelStats, 'manual')}
                        className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-bold rounded-md cursor-pointer"
                      >
                        เกิน 3 ชิ้น/สัปดาห์!
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2">
                      <span className="block text-[10px] font-sans text-slate-500">วัน</span>
                      <strong className="text-sm text-slate-900 tabular-nums">
                        {activeStudentParcelStats.dayCount}
                      </strong>{' '}
                      <span className="text-[10px] font-sans text-slate-500">ชิ้น</span>
                    </div>
                    <div
                      className={`rounded-lg py-1.5 px-2 border ${
                        activeStudentParcelStats.isOverWeeklyLimit
                          ? 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <span className="block text-[10px] font-sans">สัปดาห์</span>
                      <strong className="text-sm tabular-nums">
                        {activeStudentParcelStats.weekCount}
                      </strong>{' '}
                      <span className="text-[10px] font-sans">ชิ้น</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2">
                      <span className="block text-[10px] font-sans text-slate-500">เดือน</span>
                      <strong className="text-sm text-slate-900 tabular-nums">
                        {activeStudentParcelStats.monthCount}
                      </strong>{' '}
                      <span className="text-[10px] font-sans text-slate-500">ชิ้น</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <p className="text-sm font-semibold text-slate-800">
                  ผู้รับ: กรุณากรอกข้อมูลนักเรียน หรือกดดึงข้อมูลนักเรียนในขั้นตอนที่ 2
                </p>
                <p className="text-xs text-slate-600 font-mono">
                  เมื่อดึงหรือกรอกข้อมูลนักเรียน ระบบจะแสดงชื่อ หอพัก ห้อง และสีตะกร้าที่นี่ทันที
                </p>
              </div>
            )}

            {availableDormitories.length > 0 && (
              <div className="pt-3 border-t border-black/10">
                <span className="block text-xs font-semibold text-slate-600 mb-2">
                  ผังสีตะกร้าประจำหอพักในระบบ:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableDormitories.map((dName) => {
                    const t = getDormitoryTheme(dName);
                    return (
                      <div
                        key={dName}
                        className="flex items-center gap-2.5 bg-white/80 px-3 py-2 rounded-lg border border-black/5 text-xs"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: t.hexColor }}
                        />
                        <span className="font-mono font-bold text-slate-900">{t.basketCode}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-700 truncate">{t.shortName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* รายการพัสดุที่รับเข้าล่าสุด พร้อมตัวเลือกแสดงเป็นหอพักและตัวแบ่งหน้า */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>รายการพัสดุที่รับเข้าล่าสุด</span>
              </h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                แสดง {filteredRecentParcels.length} จาก {allFilteredRecentParcels.length} ชิ้น
              </span>
            </div>

            {/* ตัวเลือกแสดงตามหอพัก (Dropdown + ปุ่มกดเลือกหอพัก) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="recent-dorm-filter-select"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>เลือกแสดงเป็นหอพัก:</span>
                </label>

                <select
                  id="recent-dorm-filter-select"
                  value={recentDormFilter}
                  onChange={(e) => {
                    setRecentDormFilter(e.target.value);
                    setRecentPage(1);
                  }}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                >
                  <option value="ALL">ทุกหอพักรวม ({parcels.length} ชิ้น)</option>
                  {availableDormitories.map((dName) => (
                    <option key={dName} value={dName}>
                      {dName} ({getDormitoryTheme(dName).basketCode}) · {dormParcelCounts[dName] || 0} ชิ้น
                    </option>
                  ))}
                </select>
              </div>

              {/* แถบปุ่มกดกรองตามหอพักด่วน */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRecentDormFilter('ALL');
                    setRecentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    recentDormFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ทุกหอพัก ({parcels.length})
                </button>
                {availableDormitories.map((dName) => {
                  const active = recentDormFilter === dName;
                  const t = getDormitoryTheme(dName);
                  const count = dormParcelCounts[dName] || 0;
                  return (
                    <button
                      key={dName}
                      type="button"
                      onClick={() => {
                        setRecentDormFilter(dName);
                        setRecentPage(1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: t.hexColor }}
                      />
                      <span>{dName}</span>
                      <span className="font-mono tabular-nums opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredRecentParcels.length === 0 ? (
              <div className="py-8 text-center space-y-1 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-700">
                  {recentDormFilter === 'ALL'
                    ? 'ยังไม่มีรายการพัสดุที่รับเข้า'
                    : `ยังไม่มีรายการพัสดุที่รับเข้าสำหรับ "${recentDormFilter}"`}
                </p>
                {recentDormFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentDormFilter('ALL');
                      setRecentPage(1);
                    }}
                    className="text-xs font-bold text-slate-900 underline cursor-pointer"
                  >
                    กลับไปดูทุกหอพัก
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {filteredRecentParcels.map((p) => {
                    const pTheme = getDormitoryTheme(p.dormitory);
                    const pStats = !isUnknownOwnerParcel(p)
                      ? getStudentParcelCounts(p.studentCode, p.studentFullName)
                      : null;
                    return (
                      <div key={p.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-sm shrink-0"
                                style={{ backgroundColor: pTheme.hexColor }}
                              />
                              <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                                {p.trackingNumber}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {pTheme.basketCode} ({p.dormitory} ห้อง {p.dormRoom})
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              <span className="font-semibold text-slate-800">{p.studentFullName}</span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="font-mono">รหัส {p.studentCode}</span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="font-medium text-slate-800">{p.category}</span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span
                                className={
                                  p.status === 'ติดนิติการ'
                                    ? 'font-bold text-red-700'
                                    : p.status === 'พัสดุไม่ทราบเจ้าของ'
                                    ? 'font-bold text-slate-600'
                                    : 'font-bold text-emerald-700'
                                }
                              >
                                สถานะ: {p.status === 'ติดนิติการ' ? 'พัสดุติดนิติการ' : p.status}
                              </span>
                            </div>
                            {pStats && (
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1 font-mono tabular-nums">
                                <span>
                                  จำนวนพัสดุ: วัน <strong>{pStats.dayCount}</strong> · สัปดาห์{' '}
                                  <strong
                                    className={
                                      pStats.isOverWeeklyLimit ? 'text-red-600' : 'text-slate-900'
                                    }
                                  >
                                    {pStats.weekCount}
                                  </strong>{' '}
                                  · เดือน <strong>{pStats.monthCount}</strong> ชิ้น
                                </span>
                                {pStats.isOverWeeklyLimit && (
                                  <button
                                    type="button"
                                    onClick={() => openWeeklyWarningPopup(pStats, 'manual')}
                                    className="font-sans px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-md cursor-pointer"
                                  >
                                    เกิน 3 ชิ้น/สัปดาห์
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {p.status !== 'ส่งมอบสำเร็จ' && (
                            <button
                              type="button"
                              onClick={() => updateParcelStatus(p.id, 'ส่งมอบสำเร็จ')}
                              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <span>เซ็นรับสำเร็จ</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ตัวแบ่งหน้า (Pagination Controls) */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <select
                      id="recent-page-size-select"
                      aria-label="จำนวนชิ้นต่อหน้า"
                      value={recentPageSize}
                      onChange={(e) => {
                        setRecentPageSize(e.target.value);
                        setRecentPage(1);
                      }}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-slate-900"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                      <option value="50">50</option>
                      <option value="ALL">All</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentRecentPage <= 1}
                      onClick={() => setRecentPage(Math.max(1, currentRecentPage - 1))}
                      aria-label="หน้าก่อนหน้า"
                      className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>ก่อนหน้า</span>
                    </button>

                    <button
                      type="button"
                      disabled={currentRecentPage >= totalRecentPages}
                      onClick={() => setRecentPage(Math.min(totalRecentPages, currentRecentPage + 1))}
                      aria-label="หน้าถัดไป"
                      className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>ถัดไป</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
