import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Printer,
  CheckSquare,
  RotateCcw,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  getDormitoryTheme,
  getAvailableDormitories,
  getRelativeDateString,
  formatThaiSlashDate,
} from '../types/parcel';
import { ManifestPrintPreviewModal } from './ManifestPrintPreviewModal';

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const MANIFEST_STATUS_FILTERS = [
  { value: 'ALL_REGISTERED', label: 'พัสดุที่ลงทะเบียนแล้ว (รวมติดนิติการ/งานพยาบาล)' },
  { value: 'UNSIGNED', label: 'พัสดุที่ยังไม่เซ็นรับทั้งหมด' },
  { value: 'INFIRMARY', label: 'เฉพาะติดต่องานพยาบาล' },
  { value: 'LEGAL_HOLD', label: 'เฉพาะพัสดุติดนิติการ' },
  { value: 'SIGNED', label: 'พัสดุที่เซ็นรับแล้ว' },
  { value: 'ALL', label: 'พัสดุทั้งหมดทุกสถานะ' },
];

function formatThaiDateDisplay(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const yearAD = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(yearAD) || isNaN(monthIdx) || isNaN(day) || !THAI_MONTHS[monthIdx]) {
    return isoDateStr;
  }
  const yearBE = yearAD + 543;
  const dd = String(day).padStart(2, '0');
  const mm = String(monthIdx + 1).padStart(2, '0');
  return `${day} ${THAI_MONTHS[monthIdx]} ${yearBE} (${dd}/${mm}/${yearBE})`;
}

export const ManifestView: React.FC = () => {
  const {
    students,
    parcels,
    updateParcelStatus,
    bulkUpdateParcelStatus,
  } = useParcelSystem();

  const availableDormitories = useMemo(
    () => getAvailableDormitories(students, parcels),
    [students, parcels]
  );

  const [selectedDormitory, setSelectedDormitory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL_REGISTERED');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

  // วันที่สำหรับบันทึกการส่งมอบ (Default: วันนี้)
  const todayIso = useMemo(() => getRelativeDateString(0), []);
  const todayThaiDisplay = useMemo(() => formatThaiDateDisplay(todayIso), [todayIso]);

  // สถานะสำหรับปฏิทินภาษาไทยตัวกรองวันที่รับเข้า (Top Filter Calendar)
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [viewYearAD, setViewYearAD] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);

  // สถานะสำหรับปฏิทินภาษาไทยเลือกวันที่รับพัสดุ (Delivery Record Calendar in Action Box)
  const [deliveryRecordDate, setDeliveryRecordDate] = useState<string>(todayIso);
  const [isDeliveryCalendarOpen, setIsDeliveryCalendarOpen] = useState<boolean>(false);
  const [deliveryViewYearAD, setDeliveryViewYearAD] = useState<number>(() => new Date().getFullYear());
  const [deliveryViewMonth, setDeliveryViewMonth] = useState<number>(() => new Date().getMonth());
  const deliveryCalendarContainerRef = useRef<HTMLDivElement | null>(null);

  // การแบ่งหน้า (Pagination) สำหรับมุมมองหน้าจอ
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        calendarContainerRef.current &&
        !calendarContainerRef.current.contains(e.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
      if (
        deliveryCalendarContainerRef.current &&
        !deliveryCalendarContainerRef.current.contains(e.target as Node)
      ) {
        setIsDeliveryCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // แสดงรายการพัสดุตามหอพักและสถานะ (นำพัสดุที่ลงทะเบียนแล้วมาแสดงในตารางได้เลย รวมถึงของที่ติดนิติการ เพื่อรอพิมพ์ใบนำส่งให้แต่ละหอพัก)
  const manifestParcels = useMemo(() => {
    return parcels.filter((p) => {
      // 1. กรองตามหอพัก
      if (selectedDormitory !== 'ALL') {
        const dorm = (p.dormitory || '').trim();
        if (dorm !== selectedDormitory.trim()) return false;
      }

      // 2. กรองตามวันที่รับเข้าถ้ามีการเลือกจากปฏิทิน
      if (selectedDate) {
        const pDate = (p.receivedDate || '').trim();
        if (pDate && pDate !== selectedDate) return false;
      }

      // 3. กรองตามสถานะ: ให้นำพัสดุที่ลงทะเบียนแล้วมาแสดงในตารางได้เลย เพื่อรอพิมพ์ใบนำส่งให้แต่ละหอพัก ให้รวมถึงของที่ติดนิติการ และงานพยาบาล
      if (selectedStatus === 'ALL_REGISTERED') {
        return (
          p.status === 'ลงทะเบียนรับพัสดุ' ||
          p.status === 'ติดต่องานพยาบาล' ||
          p.status === 'ติดนิติการ' ||
          p.status === 'รอการยืนยัน' ||
          p.status !== 'ส่งมอบสำเร็จ'
        );
      }
      if (selectedStatus === 'UNSIGNED') {
        return p.status !== 'ส่งมอบสำเร็จ';
      }
      if (selectedStatus === 'SIGNED') {
        return p.status === 'ส่งมอบสำเร็จ';
      }
      if (selectedStatus === 'INFIRMARY') {
        return p.status === 'ติดต่องานพยาบาล';
      }
      if (selectedStatus === 'LEGAL_HOLD') {
        return p.status === 'ติดนิติการ';
      }
      if (selectedStatus === 'ALL') {
        return true;
      }
      return p.status === selectedStatus;
    });
  }, [parcels, selectedDormitory, selectedDate, selectedStatus]);

  // จัดเรียงรายการพัสดุตาม หอพัก, ห้องพักหอ, และชื่อ เพื่อให้อ่านและพิมพ์นำส่งเป็นระเบียบ
  const sortedManifestParcels = useMemo(() => {
    return [...manifestParcels].sort((a, b) => {
      if (a.dormitory !== b.dormitory) {
        return (a.dormitory || '').localeCompare(b.dormitory || '', 'th');
      }
      if (a.dormRoom !== b.dormRoom) {
        return (a.dormRoom || '').localeCompare(b.dormRoom || '', 'th', { numeric: true });
      }
      return (a.studentFullName || '').localeCompare(b.studentFullName || '', 'th');
    });
  }, [manifestParcels]);

  const unsignedParcelsInView = useMemo(
    () => sortedManifestParcels.filter((p) => p.status !== 'ส่งมอบสำเร็จ'),
    [sortedManifestParcels]
  );

  const signedParcelsInView = useMemo(
    () => sortedManifestParcels.filter((p) => p.status === 'ส่งมอบสำเร็จ'),
    [sortedManifestParcels]
  );

  // ล้างรายการที่ติ๊กเลือกไว้หากไม่อยู่ในตารางปัจจุบันแล้ว
  useEffect(() => {
    const visibleIdSet = new Set(sortedManifestParcels.map((p) => p.id));
    setSelectedParcelIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }, [sortedManifestParcels]);

  const selectedSignedIds = useMemo(() => {
    const signedSet = new Set(signedParcelsInView.map((p) => p.id));
    return selectedParcelIds.filter((id) => signedSet.has(id));
  }, [selectedParcelIds, signedParcelsInView]);

  const activeTheme = useMemo(
    () =>
      selectedDormitory === 'ALL'
        ? getDormitoryTheme('ทุกหอพักรวม')
        : getDormitoryTheme(selectedDormitory),
    [selectedDormitory]
  );

  const isAllVisibleChecked =
    sortedManifestParcels.length > 0 &&
    sortedManifestParcels.every((p) => selectedParcelIds.includes(p.id));

  // รีเซ็ตหน้าเมื่อตัวกรองเปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDormitory, selectedStatus, selectedDate]);

  const totalItems = sortedManifestParcels.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const currentPageParcels = useMemo(() => {
    return sortedManifestParcels.slice(startIndex, endIndex);
  }, [sortedManifestParcels, startIndex, endIndex]);

  const isAllCurrentPageChecked =
    currentPageParcels.length > 0 &&
    currentPageParcels.every((p) => selectedParcelIds.includes(p.id));

  const handleToggleSelectParcel = (parcelId: string) => {
    setSelectedParcelIds((prev) =>
      prev.includes(parcelId) ? prev.filter((id) => id !== parcelId) : [...prev, parcelId]
    );
  };

  const handleToggleSelectAllVisible = () => {
    if (isAllCurrentPageChecked) {
      const pageIds = new Set(currentPageParcels.map((p) => p.id));
      setSelectedParcelIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = currentPageParcels.map((p) => p.id);
      setSelectedParcelIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectAllUnsigned = () => {
    const unsignedIds = unsignedParcelsInView.map((p) => p.id);
    const allUnsignedAlreadySelected =
      unsignedIds.length > 0 && unsignedIds.every((id) => selectedParcelIds.includes(id));
    if (allUnsignedAlreadySelected) {
      setSelectedParcelIds([]);
    } else {
      setSelectedParcelIds(unsignedIds);
    }
  };

  const handlePrintManifest = () => {
    setIsPrintPreviewOpen(true);
  };

  // ยืนยันการรับพัสดุ พร้อมบันทึกวันที่รับตามปฏิทินที่เลือกจากกล่องข้อความ
  const handleConfirmSelectedDelivered = async () => {
    if (selectedParcelIds.length === 0) return;
    await bulkUpdateParcelStatus(
      selectedParcelIds,
      'ส่งมอบสำเร็จ',
      deliveryRecordDate
    );
    setSelectedParcelIds([]);
  };

  // ยกเลิกการรับพัสดุ (กรณีเจ้าหน้าที่เช็คผิด)
  const handleCancelSelectedDelivered = async () => {
    const idsToCancel =
      selectedSignedIds.length > 0 ? selectedSignedIds : selectedParcelIds;
    if (idsToCancel.length === 0) return;
    await bulkUpdateParcelStatus(idsToCancel, 'ลงทะเบียนรับพัสดุ', '');
    setSelectedParcelIds([]);
  };

  const handleCancelSingleDelivered = async (parcelId: string) => {
    await updateParcelStatus(parcelId, 'ลงทะเบียนรับพัสดุ', undefined, '');
    setSelectedParcelIds((prev) => prev.filter((id) => id !== parcelId));
  };

  // คำนวณวันในเดือนสำหรับปฏิทินภาษาไทย
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYearAD, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYearAD, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [viewYearAD, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYearAD((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYearAD((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectCalendarDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setSelectedDate(`${viewYearAD}-${mm}-${dd}`);
    setIsCalendarOpen(false);
  };

  // คำนวณวันในเดือนสำหรับปฏิทินภาษาไทย (เลือกวันที่รับพัสดุในกล่องข้อความ)
  const deliveryCalendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(deliveryViewYearAD, deliveryViewMonth, 1).getDay();
    const daysInMonth = new Date(deliveryViewYearAD, deliveryViewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [deliveryViewYearAD, deliveryViewMonth]);

  const handlePrevDeliveryMonth = () => {
    if (deliveryViewMonth === 0) {
      setDeliveryViewMonth(11);
      setDeliveryViewYearAD((y) => y - 1);
    } else {
      setDeliveryViewMonth((m) => m - 1);
    }
  };

  const handleNextDeliveryMonth = () => {
    if (deliveryViewMonth === 11) {
      setDeliveryViewMonth(0);
      setDeliveryViewYearAD((y) => y + 1);
    } else {
      setDeliveryViewMonth((m) => m + 1);
    }
  };

  const handleSelectDeliveryCalendarDay = (day: number) => {
    const mm = String(deliveryViewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDeliveryRecordDate(`${deliveryViewYearAD}-${mm}-${dd}`);
    setIsDeliveryCalendarOpen(false);
  };

  const yearOptionsAD = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <div className="space-y-6">
      <div className="no-print space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              ระบบออกเอกสารใบรายการนำส่งพัสดุแยกตามตะกร้าสีหอพัก · รองรับกระดาษ A4
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 leading-snug">
              <span>ใบรายการนำส่งและเซ็นรับพัสดุประจำหอพัก</span>
              <br />
              <span className="text-2xl md:text-3xl font-bold text-emerald-600">
                (Printable Manifest)
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrintManifest}
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>พิมพ์ใบรายการ (Print A4)</span>
            </button>
          </div>
        </div>

        {/* ตัวกรองหอพัก สถานะ และวันที่รับเข้า (ปฏิทินภาษาไทย) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="manifest-dorm-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. เลือกหอพักปลายทาง
            </label>
            <select
              id="manifest-dorm-select"
              value={selectedDormitory}
              onChange={(e) => setSelectedDormitory(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">ทุกหอพักรวมกัน</option>
              {availableDormitories.map((dormName) => (
                <option key={dormName} value={dormName}>
                  {dormName} ({getDormitoryTheme(dormName).basketCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="manifest-status-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              2. กรองตามสถานะพัสดุ
            </label>
            <select
              id="manifest-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
            >
              {MANIFEST_STATUS_FILTERS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div ref={calendarContainerRef} className="relative">
            <label htmlFor="manifest-date-trigger" className="block text-xs font-semibold text-slate-700 mb-1.5">
              3. วันที่รับเข้า (เว้นว่าง = ทุกวัน)
            </label>
            <div className="relative flex items-center">
              <button
                id="manifest-date-trigger"
                type="button"
                onClick={() => {
                  if (selectedDate) {
                    const parts = selectedDate.split('-');
                    if (parts.length === 3) {
                      setViewYearAD(parseInt(parts[0], 10));
                      setViewMonth(parseInt(parts[1], 10) - 1);
                    }
                  }
                  setIsCalendarOpen((prev) => !prev);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 pr-10 text-left text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl hover:bg-white focus:bg-white focus:border-slate-900 focus:outline-none flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className={selectedDate ? 'text-slate-900' : 'text-slate-500 font-normal'}>
                  {selectedDate ? formatThaiDateDisplay(selectedDate) : 'ทุกวัน (คลิกเลือกวันที่จากปฏิทินไทย)'}
                </span>
                <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
              </button>

              {selectedDate && (
                <button
                  type="button"
                  aria-label="ล้างวันที่รับเข้า"
                  onClick={() => setSelectedDate('')}
                  className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* ปฏิทินภาษาไทย (พ.ศ.) */}
            {isCalendarOpen && (
              <div className="absolute z-30 mt-2 right-0 left-0 sm:left-auto sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    aria-label="เดือนก่อนหน้า"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="เลือกเดือนภาษาไทย"
                      value={viewMonth}
                      onChange={(e) => setViewMonth(Number(e.target.value))}
                      className="px-2 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    >
                      {THAI_MONTHS.map((mName, idx) => (
                        <option key={mName} value={idx}>
                          {mName}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="เลือกปี พ.ศ."
                      value={viewYearAD}
                      onChange={(e) => setViewYearAD(Number(e.target.value))}
                      className="px-2 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                    >
                      {yearOptionsAD.map((yAD) => (
                        <option key={yAD} value={yAD}>
                          พ.ศ. {yAD + 543}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    aria-label="เดือนถัดไป"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {THAI_WEEKDAYS.map((wd) => (
                    <div key={wd} className="text-[11px] font-bold text-slate-500 py-1">
                      {wd}
                    </div>
                  ))}
                  {calendarDays.map((day, i) => {
                    if (day === null) {
                      return <div key={`empty-${i}`} className="h-8" />;
                    }
                    const cellIso = `${viewYearAD}-${String(viewMonth + 1).padStart(2, '0')}-${String(
                      day
                    ).padStart(2, '0')}`;
                    const isSelected = selectedDate === cellIso;
                    const isToday = todayIso === cellIso;

                    return (
                      <button
                        key={cellIso}
                        type="button"
                        onClick={() => handleSelectCalendarDay(day)}
                        className={`h-8 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white font-bold'
                            : isToday
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
                            : 'text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('');
                      setIsCalendarOpen(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    เว้นว่าง (ทุกวัน)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setViewYearAD(now.getFullYear());
                      setViewMonth(now.getMonth());
                      setSelectedDate(todayIso);
                      setIsCalendarOpen(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                  >
                    เลือกวันนี้
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* แถบจัดการเลือกพัสดุที่นักเรียนเซ็นรับแล้ว เพื่อยืนยันการรับพัสดุ หรือยกเลิกการรับพัสดุ */}
        <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3 text-xs text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-sm text-emerald-900">
                ติ๊กเลือกพัสดุในตาราง แล้วเลือกวันที่รับพัสดุจากปฏิทินไทย ก่อนยืนยันการรับพัสดุ
              </p>
              <p className="text-emerald-800 text-xs mt-0.5">
                ระบบจะบันทึกวันที่รับเป็น: <strong className="font-mono underline text-emerald-950">{formatThaiDateDisplay(deliveryRecordDate) || formatThaiSlashDate(deliveryRecordDate)}</strong> (หรือกดยกเลิกการรับพัสดุกรณีเช็คผิด)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* ปฏิทินภาษาไทย สำหรับเลือกวันที่รับพัสดุ ก่อนการยืนยันการรับพัสดุ */}
            <div className="relative" ref={deliveryCalendarContainerRef}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-950 whitespace-nowrap">วันที่รับพัสดุ:</span>
                <button
                  type="button"
                  onClick={() => {
                    const parts = deliveryRecordDate.split('-');
                    if (parts.length === 3) {
                      setDeliveryViewYearAD(parseInt(parts[0], 10));
                      setDeliveryViewMonth(parseInt(parts[1], 10) - 1);
                    }
                    setIsDeliveryCalendarOpen((v) => !v);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-emerald-100/60 border border-emerald-400 rounded-xl text-xs font-bold text-emerald-950 flex items-center gap-2 shadow-sm cursor-pointer"
                  title="คลิกเพื่อเลือกวันที่รับพัสดุจากปฏิทินภาษาไทย"
                >
                  <CalendarIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-mono">{formatThaiSlashDate(deliveryRecordDate)}</span>
                </button>
              </div>

              {/* Delivery Thai Calendar Popover */}
              {isDeliveryCalendarOpen && (
                <div className="absolute z-40 mt-2 right-0 w-80 bg-white border border-slate-300 rounded-2xl shadow-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CalendarIcon className="w-4 h-4 text-emerald-600" />
                      เลือกวันที่รับพัสดุ (พ.ศ.)
                    </span>
                    <button
                      type="button"
                      aria-label="ปิดปฏิทิน"
                      onClick={() => setIsDeliveryCalendarOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      aria-label="เดือนก่อนหน้า"
                      onClick={handlePrevDeliveryMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label="เลือกเดือนภาษาไทย"
                        value={deliveryViewMonth}
                        onChange={(e) => setDeliveryViewMonth(Number(e.target.value))}
                        className="px-2 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                      >
                        {THAI_MONTHS.map((mName, idx) => (
                          <option key={mName} value={idx}>
                            {mName}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label="เลือกปี พ.ศ."
                        value={deliveryViewYearAD}
                        onChange={(e) => setDeliveryViewYearAD(Number(e.target.value))}
                        className="px-2 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                      >
                        {yearOptionsAD.map((yAD) => (
                          <option key={yAD} value={yAD}>
                            พ.ศ. {yAD + 543}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      aria-label="เดือนถัดไป"
                      onClick={handleNextDeliveryMonth}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 pt-1">
                    {THAI_WEEKDAYS.map((wd) => (
                      <div key={wd} className="py-1">
                        {wd}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {deliveryCalendarDays.map((dayNum, cellIdx) => {
                      if (!dayNum) {
                        return <div key={`empty-${cellIdx}`} className="h-8" />;
                      }
                      const cellDateIso = `${deliveryViewYearAD}-${String(
                        deliveryViewMonth + 1
                      ).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isSelected = deliveryRecordDate === cellDateIso;
                      const isToday = cellDateIso === todayIso;

                      return (
                        <button
                          key={`day-${dayNum}`}
                          type="button"
                          onClick={() => handleSelectDeliveryCalendarDay(dayNum)}
                          className={`h-8 rounded-lg font-mono font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold shadow'
                              : isToday
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-400 font-bold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryRecordDate(todayIso);
                        setIsDeliveryCalendarOpen(false);
                      }}
                      className="px-2 py-1 text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                    >
                      ใช้วันนี้ ({formatThaiSlashDate(todayIso)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDeliveryCalendarOpen(false)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                    >
                      เสร็จสิ้น
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSelectAllUnsigned}
              disabled={unsignedParcelsInView.length === 0}
              className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-emerald-100/60 disabled:opacity-50 text-emerald-900 border border-emerald-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              เลือกที่ยังไม่เซ็นรับ ({unsignedParcelsInView.length})
            </button>

            <button
              type="button"
              onClick={handleConfirmSelectedDelivered}
              disabled={selectedParcelIds.length === 0}
              className="min-h-[40px] px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CheckSquare className="w-4 h-4" />
              <span>
                ยืนยันการรับพัสดุ ({selectedParcelIds.length}) · {formatThaiSlashDate(deliveryRecordDate)}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCancelSelectedDelivered}
              disabled={selectedSignedIds.length === 0}
              className="min-h-[40px] px-3.5 py-1.5 bg-white hover:bg-red-600 hover:text-white disabled:opacity-50 text-red-700 border border-red-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ยกเลิกการรับ ({selectedSignedIds.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ตัวอย่างใบรายการส่งมอบพัสดุ (Printable A4 Document Sheet) */}
      <section
        aria-label="เอกสารใบรายการนำส่งพัสดุสำหรับพิมพ์"
        className="print-container bg-white border border-slate-300 rounded-2xl p-5 md:p-8 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
              ใบรายการนำส่งและลงนามรับพัสดุนักเรียนประจำหอพัก
            </h2>
            <p className="text-xs text-slate-600 font-mono tabular-nums">
              วันที่พิมพ์รายการ: {todayThaiDisplay} · รวมทั้งหมด {sortedManifestParcels.length} ชิ้น
            </p>
          </div>

          <div className={`border-2 ${activeTheme.borderClass} ${activeTheme.bgClass} rounded-xl px-4 py-2.5 text-right shrink-0`}>
            <div className="text-xs font-semibold text-slate-600">หอพักปลายทาง / รหัสตะกร้าสี</div>
            <div className={`text-lg font-extrabold ${activeTheme.textClass}`}>
              {selectedDormitory === 'ALL' ? 'ทุกหอพักรวม' : activeTheme.name}
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
              {activeTheme.basketCode} ({activeTheme.colorName}) · รวม {sortedManifestParcels.length} ชิ้น
            </div>
          </div>
        </div>

        {/* ส่วนแสดงข้อมูลรายการนำส่งพัสดุประจำหอพัก */}
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">หอพักปลายทาง:</span>
            <span className="font-bold text-slate-900 text-sm">
              {selectedDormitory === 'ALL' ? 'ทุกหอพักรวม' : activeTheme.name}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">รหัสตะกร้าคัดแยก:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {activeTheme.basketCode} ({activeTheme.colorName})
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">จำนวนรายการนำส่งทั้งหมด:</span>
            <span className="font-extrabold text-slate-900 text-sm font-mono tabular-nums">
              {sortedManifestParcels.length} ชิ้น
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">สถานะการลงนามรับมอบ:</span>
            <span className="font-bold text-emerald-800 text-xs font-mono tabular-nums">
              เซ็นรับแล้ว {signedParcelsInView.length} / รอเซ็น {unsignedParcelsInView.length} ชิ้น
            </span>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible w-full">
          <table className="w-full table-fixed border-collapse text-left text-xs print:text-[10px] print:w-full">
            <thead className="table-header-group border-y-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
              <tr className="border-y-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
                <th className="no-print py-2 px-1.5 border border-slate-300 text-center w-8">
                  <input
                    type="checkbox"
                    aria-label="เลือกพัสดุทั้งหมดในหน้านี้"
                    title="เลือก/ยกเลิกเลือก ทุกรายการในหน้านี้"
                    checked={isAllCurrentPageChecked}
                    disabled={currentPageParcels.length === 0}
                    onChange={handleToggleSelectAllVisible}
                    className="w-4 h-4 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-2 px-1 border border-slate-300 text-center w-[5%]">ลำดับ</th>
                <th className="py-2 px-2 border border-slate-300 w-[15%]">เลขพัสดุ / ขนส่ง</th>
                <th className="py-2 px-1 border border-slate-300 text-center w-[8%]">รหัส นร.</th>
                <th className="py-2 px-2 border border-slate-300 w-[19%]">
                  ชื่อ-นามสกุลนักเรียน (ชื่อเล่น · ชั้น)
                </th>
                <th className="py-2 px-2 border border-slate-300 w-[33%]">ประเภทสิ่งของ</th>
                <th className="py-2 px-1 border border-slate-300 w-[10%] text-center">
                  ลายมือชื่อผู้รับ
                </th>
                <th className="py-2 px-1 border border-slate-300 w-[10%] text-center">
                  วันที่รับ
                </th>
              </tr>
            </thead>
            <tbody className="table-row-group">
              {sortedManifestParcels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500 border border-slate-300">
                    ไม่มีรายการพัสดุที่ตรงกับตัวกรองในขณะนี้
                  </td>
                </tr>
              ) : (
                sortedManifestParcels.map((p, idx) => {
                  const isSigned = p.status === 'ส่งมอบสำเร็จ';
                  const isLegalHold = p.status === 'ติดนิติการ';
                  const isInfirmary = p.status === 'ติดต่องานพยาบาล';
                  const isChecked = selectedParcelIds.includes(p.id);
                  const isRowInCurrentPage = idx >= startIndex && idx < endIndex;
                  const recordedThaiDate = isSigned
                    ? formatThaiSlashDate(p.deliveredDate || p.receivedDate || p.updatedAt)
                    : '';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleToggleSelectParcel(p.id)}
                      style={
                        isLegalHold
                          ? { backgroundColor: '#FEF1F0' }
                          : isInfirmary
                          ? { backgroundColor: '#FFFBEB' }
                          : undefined
                      }
                      className={`border-b transition-colors cursor-pointer break-inside-avoid print:break-inside-avoid ${
                        isLegalHold
                          ? 'bg-[#FEF1F0] text-rose-950 font-medium border-rose-300 print:bg-[#FEF1F0]'
                          : isInfirmary
                          ? 'bg-amber-50/70 text-amber-950 font-medium border-amber-300 print:bg-amber-50/70'
                          : isChecked
                          ? 'bg-emerald-50/60 border-slate-300'
                          : 'hover:bg-slate-50 border-slate-300'
                      } ${isRowInCurrentPage ? '' : 'hidden print:table-row'}`}
                    >
                      <td
                        className="no-print py-2 px-1.5 border border-slate-300 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`เลือกพัสดุ ${p.trackingNumber}`}
                          checked={isChecked}
                          onChange={() => handleToggleSelectParcel(p.id)}
                          className="w-4 h-4 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-1 border border-slate-300 text-center font-mono tabular-nums text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2 border border-slate-300 leading-tight">
                        <div className="font-mono font-bold text-slate-900 tabular-nums truncate">
                          {p.trackingNumber}
                        </div>
                        <div className="text-[9.5px] text-slate-500 truncate">{p.courier}</div>
                      </td>
                      <td className="py-2 px-1 border border-slate-300 text-center font-mono font-semibold text-slate-900 tabular-nums">
                        {p.studentCode}
                      </td>
                      <td className="py-2 px-2 border border-slate-300 font-bold text-slate-900 truncate" title={`${p.studentFullName} ${p.nickname ? `(${p.nickname})` : ''} ชั้น ${p.gradeRoom}`}>
                        <span>{p.studentFullName}</span>
                        {p.nickname && <span className="text-slate-600 font-normal ml-1">({p.nickname})</span>}
                        {p.gradeRoom && <span className="text-slate-500 font-normal text-[10px] ml-1">ชั้น {p.gradeRoom}</span>}
                      </td>
                      <td className="py-2 px-2 border border-slate-300 leading-tight">
                        <div className="font-semibold text-slate-800 truncate">{p.category}</div>
                        {p.status === 'ติดนิติการ' && (
                          <div className="text-[9.5px] font-bold text-red-700 leading-tight mt-0.5">
                            [ติดนิติการ]
                          </div>
                        )}
                        {p.status === 'ติดต่องานพยาบาล' && (
                          <div className="text-[9.5px] font-bold text-amber-800 leading-tight mt-0.5">
                            [ติดต่องานพยาบาล]
                          </div>
                        )}
                        {p.note && p.status !== 'ติดนิติการ' && p.status !== 'ติดต่องานพยาบาล' && (
                          <div className="text-[9.5px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                            {p.note}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1 border border-slate-300 text-center">
                        {isSigned ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="text-emerald-700 font-bold text-[10px] leading-tight">เซ็นรับแล้ว</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelSingleDelivered(p.id);
                              }}
                              className="no-print px-1 py-0.5 text-[9px] font-semibold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>ยกเลิก</span>
                            </button>
                          </div>
                        ) : (
                          <div className="w-12 mx-auto pt-2 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
                            ลงชื่อ
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-1 border border-slate-300 text-center">
                        {isSigned ? (
                          <span className="text-emerald-700 font-bold text-[10px] leading-tight">{recordedThaiDate}</span>
                        ) : (
                          <div className="w-12 mx-auto pt-2 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
                            ว/ด/ป
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ตัวแบ่งหน้า (Pagination) สำหรับมุมมองหน้าจอ - ซ่อนเมื่อสั่งพิมพ์ */}
        {totalItems > 0 && (
          <div className="no-print pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <span className="font-semibold text-slate-700">แสดง:</span>
              <select
                aria-label="จำนวนรายการต่อหน้า"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              >
                <option value={10}>10 รายการ / หน้า</option>
                <option value={15}>15 รายการ / หน้า</option>
                <option value={20}>20 รายการ / หน้า</option>
                <option value={30}>30 รายการ / หน้า</option>
                <option value={50}>50 รายการ / หน้า</option>
                <option value={9999}>แสดงทั้งหมด ({totalItems} รายการ)</option>
              </select>
              <span className="text-slate-500 font-mono">
                (รายการที่ {startIndex + 1} - {Math.min(endIndex, totalItems)} จากทั้งหมด {totalItems} รายการ)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="min-h-[34px] px-3 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>ก่อนหน้า</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((pageNum) => {
                    if (totalPages <= 7) return true;
                    if (pageNum === 1 || pageNum === totalPages) return true;
                    return Math.abs(pageNum - currentPage) <= 1;
                  })
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNum - prev > 1;
                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-h-[34px] min-w-[34px] px-2 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer ${
                            currentPage === pageNum
                              ? 'bg-emerald-700 text-white shadow-sm'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="min-h-[34px] px-3 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>ถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* สรุปข้อมูลรายการนำส่งท้ายตาราง */}
        <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
          <p className="font-bold">
            สรุปข้อมูลรายการนำส่ง: ทั้งสิ้น {sortedManifestParcels.length} รายการ (ส่งมอบสำเร็จแล้ว {signedParcelsInView.length} รายการ, รอส่งมอบ {unsignedParcelsInView.length} รายการ)
          </p>
          <p className="text-slate-500 font-mono text-[11px]">
            * รายการพัสดุลงทะเบียนสำหรับพิมพ์ใบนำส่งประจำหอพัก (รวมรายการติดนิติการ)
          </p>
        </div>

        {/* แถบปุ่มพิมพ์เอกสารต่อท้ายตาราง (ซ่อนเมื่อสั่งพิมพ์) */}
        <div className="no-print pt-5 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 mt-2">
          <div className="text-xs text-slate-600">
            <p className="font-bold text-sm text-slate-900">
              พิมพ์ใบรายการนำส่งและเซ็นรับพัสดุประจำหอพัก (Print A4)
            </p>
            <p className="text-slate-500 mt-0.5">
              แสดงหน้าตัวอย่างการพิมพ์แบบ HTML พร้อมเลือกการพิมพ์แบบแนวตั้งหรือแนวนอน ขนาดกระดาษ A4
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrintManifest}
            className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg shrink-0 ml-auto"
          >
            <Printer className="w-5 h-5 text-emerald-400" />
            <span>พิมพ์ใบรายการ (Print A4)</span>
          </button>
        </div>
      </section>

      {/* หน้าต่างตัวอย่างการพิมพ์แบบ HTML (HTML Print Preview Modal with A4 Portrait / Landscape) */}
      <ManifestPrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        parcels={sortedManifestParcels}
        dormitory={selectedDormitory}
        activeTheme={activeTheme}
        printDateDisplay={todayThaiDisplay}
        selectedStatusLabel={
          MANIFEST_STATUS_FILTERS.find((s) => s.value === selectedStatus)?.label || selectedStatus
        }
        selectedDate={selectedDate}
      />
    </div>
  );
};
