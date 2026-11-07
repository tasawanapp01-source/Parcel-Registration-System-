import React from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  Building2,
  Package,
  UserCheck,
  Edit3,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  Parcel,
  formatStudentCode,
  formatThaiSlashDate,
  getDormitoryTheme,
  extractParcelLocalYMD,
} from '../types/parcel';

interface DuplicateParcelModalProps {
  isOpen: boolean;
  parcel: Parcel | null;
  onClose: () => void;
  onOpenEdit?: (parcel: Parcel) => void;
  onClearTracking?: () => void;
  canEdit?: boolean;
}

export const DuplicateParcelModal: React.FC<DuplicateParcelModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onOpenEdit,
  onClearTracking,
  canEdit = false,
}) => {
  if (!isOpen || !parcel) return null;

  const dormTheme = getDormitoryTheme(parcel.dormitory);
  const isLegalHold = parcel.status === 'ติดนิติการ';
  const isMedicalHold = parcel.status === 'ติดต่องานพยาบาล';
  const isDelivered = parcel.status === 'ส่งมอบสำเร็จ';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="bg-white border-2 border-red-300 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header แจ้งเตือนสีแดงเด่นชัด */}
        <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-red-950">
                เลขพัสดุได้ถูกใช้งานแล้ว
              </h2>
              <p className="text-xs text-red-700 font-medium">
                พบเลขพัสดุซ้ำในฐานข้อมูลระบบ ไม่สามารถลงทะเบียนซ้ำได้
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างแจ้งเตือน"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {/* แถบแจ้งเตือนเลขพัสดุที่ซ้ำ */}
          <div className="p-3.5 bg-red-100/70 border border-red-300 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-red-900">เลขพัสดุที่ซ้ำ:</span>
              <span className="font-mono text-base font-black text-red-950 bg-white px-2.5 py-0.5 rounded-lg border border-red-300">
                {parcel.trackingNumber}
              </span>
            </div>
            <span className="text-xs font-semibold text-red-800">
              ขนส่ง: <strong className="text-red-950">{parcel.courier}</strong>
            </span>
          </div>

          {/* การ์ดแสดงข้อมูลพัสดุที่มีอยู่เดิมในระบบ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-500" />
                <span>ข้อมูลที่ผูกกับเลขพัสดุชิ้นนี้ในระบบ:</span>
              </h3>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                  isDelivered
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : isLegalHold
                    ? 'bg-red-600 text-white'
                    : isMedicalHold
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                สถานะ: {parcel.status}
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              {/* ข้อมูลผู้รับ */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  ผู้รับพัสดุ:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-slate-900">
                    {parcel.studentFullName || '-'}
                  </span>
                  {parcel.nickname && (
                    <span className="text-xs text-slate-600 font-medium">
                      ({parcel.nickname})
                    </span>
                  )}
                  {parcel.studentCode && parcel.studentCode !== 'UNKNOWN' && (
                    <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-700">
                      รหัส {formatStudentCode(parcel.studentCode)}
                    </span>
                  )}
                  {parcel.gradeRoom && parcel.gradeRoom !== '-' && (
                    <span className="font-mono text-xs text-slate-600">
                      ชั้น {parcel.gradeRoom}
                    </span>
                  )}
                </div>
              </div>

              {/* หอพักและห้อง */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${dormTheme.bgClass} ${dormTheme.borderClass}`}
                  style={{ borderColor: dormTheme.hexColor }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: dormTheme.hexColor }}
                    />
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">หอพัก:</span>
                      <span className={`text-sm font-extrabold ${dormTheme.textClass}`}>
                        {parcel.dormitory || '-'}
                      </span>
                    </div>
                  </div>
                  {dormTheme.basketCode && (
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-white/90 text-slate-900 border border-slate-200">
                      {dormTheme.basketCode}
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">ห้องพักหอ:</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      ห้อง {parcel.dormRoom || '-'}
                    </span>
                  </div>
                  <Building2 className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* วันที่รับเข้า & ข้อมูลสิ่งของ */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    วันที่รับเข้า: <strong>{formatThaiSlashDate(parcel.receivedDate || extractParcelLocalYMD(parcel))}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    หมวดหมู่: <strong>{parcel.category || '-'}</strong>
                  </span>
                </div>
              </div>

              {/* หมายเหตุ / ข้อมูลเซ็นรับ */}
              {parcel.note && parcel.note.trim() && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">หมายเหตุ:</span>{' '}
                  <span className="text-slate-800">{parcel.note}</span>
                </div>
              )}

              {isDelivered && parcel.deliveredDate && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    เซ็นรับสำเร็จแล้วเมื่อวันที่: {formatThaiSlashDate(parcel.deliveredDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onClearTracking && (
              <button
                type="button"
                onClick={() => {
                  onClearTracking();
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-bold text-red-700 hover:text-red-900 hover:bg-red-50 border border-red-300 rounded-xl transition-colors cursor-pointer"
              >
                ล้างเลขพัสดุนี้ออก
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenEdit && canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit(parcel);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูลพัสดุชิ้นนี้</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              รับทราบ / ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
