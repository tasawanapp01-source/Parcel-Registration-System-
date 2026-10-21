import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  Calendar,
  X,
  Package,
  User,
  Home,
  Clock,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import {
  Parcel,
  getDormitoryTheme,
  formatThaiSlashDate,
  formatStudentCode,
  getRelativeDateString,
} from '../types/parcel';

interface DeliveryDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcel: Parcel | null;
  parcelsList?: Parcel[]; // กรณีส่งมอบหลายรายการพร้อมกัน
  onConfirm: (deliveredDate: string, note?: string) => Promise<void> | void;
  isBatch?: boolean;
}

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

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function formatFullThaiDate(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  const dayName = !isNaN(dt.getTime()) ? THAI_DAYS[dt.getDay()] : '';
  const yearBE = y + 543;
  const dd = String(d).padStart(2, '0');
  const mm = String(m + 1).padStart(2, '0');
  return `${dayName ? `วัน${dayName}ที่ ` : ''}${d} ${THAI_MONTHS[m] || ''} ${yearBE} (${dd}/${mm}/${yearBE})`;
}

const NOTE_PRESETS = [
  'นักเรียนรับเอง',
  'ครูหอพักรับแทน',
  'เพื่อนร่วมห้องรับแทน',
  'ติดต่อรับที่ห้องพัสดุ',
  'ฝากไว้ที่โต๊ะเจ้าหน้าที่หอพัก',
];

export const DeliveryDateModal: React.FC<DeliveryDateModalProps> = ({
  isOpen,
  onClose,
  parcel,
  parcelsList = [],
  onConfirm,
  isBatch = false,
}) => {
  const todayIso = useMemo(() => getRelativeDateString(0), []);
  const yesterdayIso = useMemo(() => getRelativeDateString(1), []);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // กำหนดค่าเริ่มต้นเมื่อเปิด Modal
  useEffect(() => {
    if (isOpen) {
      if (parcel && parcel.deliveredDate) {
        setSelectedDate(parcel.deliveredDate);
      } else {
        setSelectedDate(todayIso);
      }
      setNote(parcel?.note || '');
      setIsSubmitting(false);
    }
  }, [isOpen, parcel, todayIso]);

  // ปิด modal ด้วยปุ่ม Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || (!parcel && parcelsList.length === 0)) return null;

  const dormTheme = parcel ? getDormitoryTheme(parcel.dormitory) : null;
  const isEditingExisting = parcel && parcel.status === 'ส่งมอบสำเร็จ';
  const receivedDateIso = parcel?.receivedDate || '';

  const handleQuickSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleFocusDateInput = () => {
    if (dateInputRef.current) {
      dateInputRef.current.focus();
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          (dateInputRef.current as any).showPicker();
        } catch {
          // ignore
        }
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedDate) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedDate, note.trim());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 id="delivery-modal-title" className="text-lg font-bold">
                {isEditingExisting
                  ? 'แก้ไขวันที่รับพัสดุ'
                  : isBatch
                  ? `ส่งมอบสำเร็จ (${parcelsList.length} รายการ)`
                  : 'ส่งมอบสำเร็จ (บันทึกการรับพัสดุ)'}
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                เลือกวันที่นักเรียนหรือผู้แทนรับพัสดุไปเรียบร้อยแล้ว
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* ข้อมูลสรุปพัสดุ */}
          {parcel && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                    {parcel.trackingNumber}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                    {parcel.courier}
                  </span>
                </div>
                {dormTheme && (
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: dormTheme.hexColor + '20',
                      color: dormTheme.hexColor,
                    }}
                  >
                    {dormTheme.basketCode}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {parcel.studentFullName} {parcel.nickname ? `(${parcel.nickname})` : ''}
                  </span>
                </div>
                <div className="text-slate-600 font-mono tabular-nums">
                  รหัส: <strong className="text-slate-800">{formatStudentCode(parcel.studentCode)}</strong> · ชั้น {parcel.gradeRoom}
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {parcel.dormitory} ห้อง {parcel.dormRoom} เตียง {parcel.bed}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono tabular-nums">
                    รับเข้า: {formatThaiSlashDate(parcel.receivedDate)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isBatch && parcelsList.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
              <p className="font-bold text-sm text-emerald-950">
                คุณกำลังบันทึกส่งมอบพัสดุพร้อมกัน {parcelsList.length} ชิ้น
              </p>
              <p className="text-emerald-800">
                ระบบจะตั้งสถานะเป็น "ส่งมอบสำเร็จ" และบันทึกวันที่รับพัสดุเดียวกันให้กับทุกรายการที่เลือก
              </p>
            </div>
          )}

          {/* ส่วนเลือกวันที่รับพัสดุ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="delivery-date-input"
                className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>วันที่รับพัสดุ (Delivery Date)</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                พ.ศ. {(parseInt(selectedDate.slice(0, 4), 10) || 0) + 543}
              </span>
            </div>

            {/* แสดงผลวันที่ที่เลือกอย่างชัดเจน */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 text-center">
              <p className="text-xs font-medium text-emerald-800">วันที่รับพัสดุที่เลือก:</p>
              <p className="text-base sm:text-lg font-bold text-emerald-950 mt-0.5">
                {formatFullThaiDate(selectedDate)}
              </p>
              <p className="text-xs font-mono text-emerald-700 mt-1 tabular-nums">
                รูปแบบบันทึก: {selectedDate}
              </p>
            </div>

            {/* ปุ่มด่วน (Quick Buttons): วันนี้, เมื่อวาน, วันที่รับเข้า, วันที่ */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>ปุ่มด่วนเลือกวันที่:</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. ปุ่มวันนี้ */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect(todayIso)}
                  className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                    selectedDate === todayIso
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {selectedDate === todayIso && <Check className="w-3.5 h-3.5" />}
                    <span>วันนี้</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      selectedDate === todayIso ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {formatThaiSlashDate(todayIso)}
                  </span>
                </button>

                {/* 2. ปุ่มเมื่อวาน */}
                <button
                  type="button"
                  onClick={() => handleQuickSelect(yesterdayIso)}
                  className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                    selectedDate === yesterdayIso
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {selectedDate === yesterdayIso && <Check className="w-3.5 h-3.5" />}
                    <span>เมื่อวาน</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      selectedDate === yesterdayIso ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {formatThaiSlashDate(yesterdayIso)}
                  </span>
                </button>

                {/* 3. ปุ่มวันที่รับเข้า (ถ้ามีและไม่ซ้ำกับวันนี้/เมื่อวาน) หรือ 2 วันก่อน */}
                {receivedDateIso &&
                receivedDateIso !== todayIso &&
                receivedDateIso !== yesterdayIso ? (
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(receivedDateIso)}
                    className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      selectedDate === receivedDateIso
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {selectedDate === receivedDateIso && <Check className="w-3.5 h-3.5" />}
                      <span>วันรับเข้า</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        selectedDate === receivedDateIso ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      {formatThaiSlashDate(receivedDateIso)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(getRelativeDateString(2))}
                    className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      selectedDate === getRelativeDateString(2)
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {selectedDate === getRelativeDateString(2) && <Check className="w-3.5 h-3.5" />}
                      <span>2 วันก่อน</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        selectedDate === getRelativeDateString(2)
                          ? 'text-emerald-100'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatThaiSlashDate(getRelativeDateString(2))}
                    </span>
                  </button>
                )}

                {/* 4. ปุ่มเลือกวันที่ (เปิดปฏิทิน/โฟกัสช่องวันที่) */}
                <button
                  type="button"
                  onClick={handleFocusDateInput}
                  className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                    selectedDate !== todayIso &&
                    selectedDate !== yesterdayIso &&
                    selectedDate !== receivedDateIso &&
                    selectedDate !== getRelativeDateString(2)
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>วันที่...</span>
                  </span>
                  <span className="text-[10px] opacity-80">
                    {selectedDate !== todayIso &&
                    selectedDate !== yesterdayIso &&
                    selectedDate !== receivedDateIso &&
                    selectedDate !== getRelativeDateString(2)
                      ? formatThaiSlashDate(selectedDate)
                      : 'เลือกจากปฏิทิน'}
                  </span>
                </button>
              </div>
            </div>

            {/* ช่องระบุวันที่แบบ Date Input */}
            <div className="pt-1">
              <label htmlFor="delivery-date-input" className="sr-only">
                ระบุวันที่รับพัสดุ
              </label>
              <div className="relative">
                <input
                  ref={dateInputRef}
                  id="delivery-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={getRelativeDateString(-30)} // ไม่ให้เกิน 30 วันข้างหน้า
                  className="w-full min-h-[48px] px-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-colors cursor-pointer"
                  required
                />
              </div>
            </div>
          </div>

          {/* หมายเหตุเพิ่มเติม (ตัวเลือก) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="delivery-note-input" className="text-xs font-semibold text-slate-700">
                หมายเหตุเพิ่มเติม (ถ้ามี):
              </label>
              <span className="text-[11px] text-slate-400">ระบุผู้รับแทน หรือข้อความบันทึก</span>
            </div>
            <input
              id="delivery-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น นักเรียนเซ็นรับด้วยตนเอง, ครูหอรับแทน, หรือระบุชื่อผู้รับ..."
              maxLength={300}
              className="w-full min-h-[44px] px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
            />

            {/* ชิปข้อความด่วน */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNote(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    note === preset
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || !selectedDate}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'กำลังบันทึกข้อมูล...'
                : isEditingExisting
                ? 'บันทึกการแก้ไขวันที่'
                : 'ยืนยันส่งมอบสำเร็จ'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
