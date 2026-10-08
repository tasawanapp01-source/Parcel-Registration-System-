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
  { value: 'ALL_REGISTERED', label: 'พัสดุที่ลงทะเบียนทั้งหมด' },
  { value: 'SIGNED', label: 'พัสดุที่เซ็นรับแล้ว' },
  { value: 'UNSIGNED', label: 'พัสดุที่ยังไม่เซ็นรับ' },
  { value: 'LEGAL_HOLD', label: 'พัสดุติดนิติการ' },
  { value: 'UNKNOWN_OWNER', label: 'พัสดุไม่ทราบเจ้าของ' },
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
    searchParcelsLocal,
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

  // สถานะสำหรับปฏิทินภาษาไทย (Thai Calendar Popover)
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [viewYearAD, setViewYearAD] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        calendarContainerRef.current &&
        !calendarContainerRef.current.contains(e.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // แสดงรายการพัสดุตามหอพักและสถานะ (โดยใช้ปฏิทินที่ 3 สำหรับบันทึกวันที่รับพัสดุเมื่อกดยืนยัน)
  const manifestParcels = useMemo(() => {
    return searchParcelsLocal('', selectedStatus, selectedDormitory, '');
  }, [searchParcelsLocal, selectedStatus, selectedDormitory]);

  const unsignedParcelsInView = useMemo(
    () => manifestParcels.filter((p) => p.status !== 'ส่งมอบสำเร็จ'),
    [manifestParcels]
  );

  const signedParcelsInView = useMemo(
    () => manifestParcels.filter((p) => p.status === 'ส่งมอบสำเร็จ'),
    [manifestParcels]
  );

  // ล้างรายการที่ติ๊กเลือกไว้หากไม่อยู่ในตารางปัจจุบันแล้ว
  useEffect(() => {
    const visibleIdSet = new Set(manifestParcels.map((p) => p.id));
    setSelectedParcelIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }, [manifestParcels]);

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
    manifestParcels.length > 0 &&
    manifestParcels.every((p) => selectedParcelIds.includes(p.id));

  const handleToggleSelectParcel = (parcelId: string) => {
    setSelectedParcelIds((prev) =>
      prev.includes(parcelId) ? prev.filter((id) => id !== parcelId) : [...prev, parcelId]
    );
  };

  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleChecked) {
      setSelectedParcelIds([]);
    } else {
      setSelectedParcelIds(manifestParcels.map((p) => p.id));
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
    window.print();
  };

  const todayIso = getRelativeDateString(0);
  const todayThaiDisplay = formatThaiDateDisplay(todayIso);
  // วันที่ที่จะใช้บันทึกเป็น "วันที่รับ" เมื่อยืนยันการรับพัสดุ (จากปฏิทินวันที่รับเข้า หากเว้นว่างใช้วันนี้)
  const targetReceivedDateToRecord = selectedDate || todayIso;

  // ยืนยันการรับพัสดุ พร้อมบันทึกวันที่รับตามปฏิทินที่เลือก
  const handleConfirmSelectedDelivered = async () => {
    if (selectedParcelIds.length === 0) return;
    await bulkUpdateParcelStatus(
      selectedParcelIds,
      'ส่งมอบสำเร็จ',
      targetReceivedDateToRecord
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-medium text-slate-500">
              ระบบออกเอกสารใบรายการนำส่งพัสดุแยกตามตะกร้าสีหอพัก · รองรับกระดาษ A4
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
              ใบรายการนำส่งและเซ็นรับพัสดุประจำหอพัก (Printable Manifest)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleConfirmSelectedDelivered}
              disabled={selectedParcelIds.length === 0}
              className="min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>
                ยืนยันการรับพัสดุ
                {selectedParcelIds.length > 0 ? ` (${selectedParcelIds.length} รายการ)` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCancelSelectedDelivered}
              disabled={selectedSignedIds.length === 0}
              className="min-h-[44px] px-4 py-2.5 bg-red-50 hover:bg-red-600 hover:text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                ยกเลิกการรับพัสดุ
                {selectedSignedIds.length > 0 ? ` (${selectedSignedIds.length} รายการ)` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintManifest}
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
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
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span>
                ติ๊กเลือกพัสดุในตารางแล้วกด <strong>"ยืนยันการรับพัสดุ"</strong> (จะบันทึกวันที่รับเป็น{' '}
                <strong className="font-mono underline">
                  {formatThaiSlashDate(targetReceivedDateToRecord)}
                </strong>{' '}
                ตามปฏิทินช่องที่ 3) หรือกด <strong>"ยกเลิกการรับพัสดุ"</strong> กรณีเช็คผิด
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSelectAllUnsigned}
              disabled={unsignedParcelsInView.length === 0}
              className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-emerald-100/60 disabled:opacity-50 text-emerald-900 border border-emerald-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              เลือกที่ยังไม่เซ็นรับทั้งหมด ({unsignedParcelsInView.length})
            </button>

            <button
              type="button"
              onClick={handleConfirmSelectedDelivered}
              disabled={selectedParcelIds.length === 0}
              className="min-h-[38px] px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>
                ยืนยันการรับพัสดุ ({selectedParcelIds.length}) · วันที่{' '}
                {formatThaiSlashDate(targetReceivedDateToRecord)}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCancelSelectedDelivered}
              disabled={selectedSignedIds.length === 0}
              className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-red-600 hover:text-white disabled:opacity-50 text-red-700 border border-red-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ยกเลิกการรับพัสดุ ({selectedSignedIds.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ตัวอย่างใบรายการส่งมอบพัสดุ (Printable A4 Document Sheet) */}
      <section
        aria-label="เอกสารใบรายการนำส่งพัสดุสำหรับพิมพ์"
        className="print-container bg-white border border-slate-300 rounded-2xl p-6 md:p-10 space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <FileSpreadsheet className="w-4 h-4" />
              <span>แบบฟอร์ม พสด.-04 · งานสวัสดิการและหอพักนักเรียน</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
              ใบรายการนำส่งและลงนามรับพัสดุนักเรียนประจำหอพัก
            </h2>
            <p className="text-xs text-slate-600 font-mono tabular-nums">
              วันที่พิมพ์รายการ: {todayThaiDisplay}
            </p>
          </div>

          <div className={`border-2 ${activeTheme.borderClass} ${activeTheme.bgClass} rounded-xl px-4 py-3 text-right shrink-0`}>
            <div className="text-xs font-semibold text-slate-600">หอพักปลายทาง / รหัสตะกร้าสี</div>
            <div className={`text-lg font-extrabold ${activeTheme.textClass}`}>
              {selectedDormitory === 'ALL' ? 'ทุกหอพักรวม' : activeTheme.name}
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
              {activeTheme.basketCode} ({activeTheme.colorName}) · รวม {manifestParcels.length} ชิ้น
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-100 text-slate-900 font-bold">
                <th className="no-print py-2.5 px-2.5 border border-slate-300 text-center w-12">
                  <input
                    type="checkbox"
                    aria-label="เลือกพัสดุทั้งหมดในตาราง"
                    checked={isAllVisibleChecked}
                    disabled={manifestParcels.length === 0}
                    onChange={handleToggleSelectAllVisible}
                    className="w-4 h-4 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-2.5 px-2.5 border border-slate-300 text-center w-10">ลำดับ</th>
                <th className="py-2.5 px-3 border border-slate-300">เลขพัสดุ (Tracking)</th>
                <th className="py-2.5 px-2.5 border border-slate-300">รหัส นร.</th>
                <th className="py-2.5 px-3 border border-slate-300">ชื่อ-นามสกุล (ชื่อเล่น)</th>
                <th className="py-2.5 px-2.5 border border-slate-300 text-center">ห้อง</th>
                <th className="py-2.5 px-3 border border-slate-300">ประเภท / หมายเหตุ</th>
                <th className="py-2.5 px-3 border border-slate-300 w-44 text-center">
                  ลายมือชื่อนักเรียนผู้รับ
                </th>
                <th className="py-2.5 px-2.5 border border-slate-300 w-28 text-center">
                  วันที่รับ
                </th>
              </tr>
            </thead>
            <tbody>
              {manifestParcels.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 border border-slate-300">
                    ไม่มีรายการพัสดุที่ตรงกับตัวกรองในขณะนี้
                  </td>
                </tr>
              ) : (
                manifestParcels.map((p, idx) => {
                  const isSigned = p.status === 'ส่งมอบสำเร็จ';
                  const isChecked = selectedParcelIds.includes(p.id);
                  const recordedThaiDate = isSigned
                    ? formatThaiSlashDate(p.deliveredDate || p.receivedDate || p.updatedAt)
                    : '..../...../.....';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleToggleSelectParcel(p.id)}
                      className={`border-b border-slate-300 transition-colors cursor-pointer hover:bg-slate-50 ${
                        isChecked ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <td
                        className="no-print py-3 px-2.5 border border-slate-300 text-center"
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
                      <td className="py-3 px-2.5 border border-slate-300 text-center font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 border border-slate-300">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">
                          {p.trackingNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">{p.courier}</div>
                      </td>
                      <td className="py-3 px-2.5 border border-slate-300 font-mono font-semibold text-slate-900 tabular-nums">
                        {p.studentCode}
                      </td>
                      <td className="py-3 px-3 border border-slate-300">
                        <div className="font-semibold text-slate-900">
                          {p.studentFullName} ({p.nickname})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ชั้น {p.gradeRoom} · {p.dormitory}
                        </div>
                      </td>
                      <td className="py-3 px-2.5 border border-slate-300 text-center font-mono font-bold text-slate-900 tabular-nums">
                        {p.dormRoom}
                      </td>
                      <td className="py-3 px-3 border border-slate-300">
                        <div className="font-semibold text-slate-800">{p.category}</div>
                        <div className="text-[11px] text-slate-500">
                          สถานะ: {p.status === 'ติดนิติการ' ? 'พัสดุติดนิติการ' : p.status} {p.note ? `· ${p.note}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 border border-slate-300 text-center text-slate-400">
                        {isSigned ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-emerald-700 font-semibold">เซ็นรับแล้ว</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelSingleDelivered(p.id);
                              }}
                              className="no-print px-2 py-0.5 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>ยกเลิกการรับ</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-block w-full border-b border-dotted border-slate-400 pt-4" />
                        )}
                      </td>
                      <td className="py-3 px-2.5 border border-slate-300 text-center font-mono tabular-nums">
                        {isSigned ? (
                          <span className="text-emerald-700 font-bold">{recordedThaiDate}</span>
                        ) : (
                          <span className="text-slate-400">..../...../.....</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
