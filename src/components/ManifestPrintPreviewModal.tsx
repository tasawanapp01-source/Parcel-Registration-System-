import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Check,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Parcel, DormitoryTheme, formatThaiSlashDate } from '../types/parcel';

export type PrintOrientation = 'portrait' | 'landscape';
export type RowDensity = 'normal' | 'compact';

interface ManifestPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcels: Parcel[];
  dormitory: string;
  activeTheme: DormitoryTheme;
  printDateDisplay: string;
  selectedStatusLabel: string;
  selectedDate?: string;
}

export const ManifestPrintPreviewModal: React.FC<ManifestPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  parcels,
  dormitory,
  activeTheme,
  printDateDisplay,
  selectedDate,
}) => {
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [density, setDensity] = useState<RowDensity>('compact');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // ปิดด้วยปุ่ม Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ล็อค scroll ของ body เมื่อเปิด modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const signedCount = parcels.filter((p) => p.status === 'ส่งมอบสำเร็จ').length;
  const unsignedCount = parcels.length - signedCount;
  const legalHoldCount = parcels.filter((p) => p.status === 'ติดนิติการ').length;
  const infirmaryCount = parcels.filter((p) => p.status === 'ติดต่องานพยาบาล').length;

  const handlePrint = () => {
    window.print();
  };

  const isLandscape = orientation === 'landscape';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="หน้าตัวอย่างการพิมพ์แบบ HTML ขนาด A4"
      className="fixed inset-0 z-50 flex flex-col bg-white modal-print-wrapper overflow-hidden"
    >
      {/* Dynamic @page CSS rule and repeating table header rule for multi-page printouts */}
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 6mm 6mm 6mm 6mm;
          }
          /* 1. พื้นหลังหน้ากระดาษ เอกสาร และพื้นที่ภายนอกตาราง เป็นสีขาวล้วน ไม่ใส่สี */
          html, body {
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            color: #000000 !important;
          }
          .no-print,
          .print-container {
            display: none !important;
          }
          .modal-print-wrapper,
          .print-preview-scroll-area {
            position: static !important;
            inset: auto !important;
            background: #FFFFFF !important;
            background-color: #FFFFFF !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
          }
          .manifest-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            transform: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
          }

          /* 2. ตารางและพื้นหลังตารางปกติไม่ใส่สี (เป็นสีขาวล้วน) */
          table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
          }
          tbody {
            display: table-row-group !important;
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
          }
          tbody tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* พื้นหลังแถวตารางปกติ ไม่ใส่สี (สีขาวล้วน) */
          tbody tr:not(.print-highlight-legal):not(.print-highlight-infirmary),
          tbody tr:not(.print-highlight-legal):not(.print-highlight-infirmary) td {
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
          }

          /* 3. ให้ใส่เฉพาะ: สีหัวตาราง */
          thead, thead tr, thead th {
            display: table-header-group !important;
            background-color: #F1F5F9 !important;
            background: #F1F5F9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          thead tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* 4. ให้ใส่เฉพาะ: สีไฮไลท์แถวตาราง (ติดนิติการ และ ติดต่องานพยาบาล) */
          tbody tr.print-highlight-legal,
          tbody tr.print-highlight-legal td {
            background-color: #FEF1F0 !important;
            background: #FEF1F0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          tbody tr.print-highlight-infirmary,
          tbody tr.print-highlight-infirmary td {
            background-color: #FFFBEB !important;
            background: #FFFBEB !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* ป้ายตะกร้าหอพัก: พื้นหลังสีขาวล้วน ไม่ใส่สีพื้นหลัง */
          .dorm-basket-badge {
            background-color: #FFFFFF !important;
            background: #FFFFFF !important;
          }
        }
      `}</style>

      {/* แถบเครื่องมือควบคุมการพิมพ์ (Toolbar) โทนสว่าง - ซ่อนอัตโนมัติเมื่อพิมพ์ด้วย class no-print */}
      <header className="no-print bg-white border-b border-slate-200 px-4 py-3 shrink-0 text-slate-900 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
          {/* แถวที่ 1: ข้อมูลหัวเรื่อง & สรุป */}
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                    ตัวอย่างการพิมพ์ใบนำส่งหอพัก (HTML Print Preview A4)
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    A4 {isLandscape ? 'แนวนอน' : 'แนวตั้ง'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {dormitory === 'ALL' ? 'ทุกหอพักรวมกัน' : activeTheme.name} ({activeTheme.basketCode}) · รวม {parcels.length} ชิ้น
                </p>
              </div>
            </div>

            {/* ปุ่มปิดกากบาทแบบรวดเร็ว */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="ปิดหน้าต่างตัวอย่าง"
              title="ปิด (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* แถวที่ 2 (ลงมาอยู่บรรทัดใหม่ จัดชิดขวา): แผงควบคุมทั้งหมด */}
          <div className="flex flex-wrap items-center justify-end gap-2 w-full pt-2 border-t border-slate-100">
            {/* เลือกลักษณะการพิมพ์: แนวตั้ง (Portrait) / แนวนอน (Landscape) */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  !isLandscape
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="พิมพ์แบบแนวตั้ง กระดาษ A4 (210 × 297 มม.) - ปรับความกว้างพอดีหน้ากระดาษ ไม่ล้นขอบ"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                </svg>
                <span>แนวตั้ง (Portrait)</span>
              </button>

              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isLandscape
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="พิมพ์แบบแนวนอน กระดาษ A4 (297 × 210 มม.)"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
                <span>แนวนอน (Landscape)</span>
              </button>
            </div>

            {/* ความหนาแน่นตาราง: ประหยัดหน้า (กะทัดรัด) / ขนาดปกติ */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  density === 'compact'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="โหมดกะทัดรัด (แนะนำ): บรรจุได้ 25-30 รายการต่อหน้า ประหยัดกระดาษ"
              >
                ประหยัดหน้า (กะทัดรัด)
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  density === 'normal'
                    ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="ระยะบรรทัดปกติ"
              >
                ขนาดปกติ
              </button>
            </div>

            {/* ปรับสัดส่วนการมองเห็น: ซูม 100% */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl px-2 py-1 gap-1.5 text-xs text-slate-700">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                disabled={zoomLevel <= 50}
                className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-40 cursor-pointer"
                title="ลดขนาดตัวอย่าง"
                aria-label="ลดขนาดตัวอย่าง"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold w-16 text-center text-slate-800">ซูม {zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                disabled={zoomLevel >= 130}
                className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-40 cursor-pointer"
                title="เพิ่มขนาดตัวอย่าง"
                aria-label="เพิ่มขนาดตัวอย่าง"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-slate-50 rounded text-slate-700 border border-slate-200 cursor-pointer ml-0.5 font-medium shadow-2xs"
                title="รีเซ็ตเป็น 100%"
              >
                100%
              </button>
            </div>

            {/* ปุ่มกดสั่งพิมพ์: สั่งพิมพ์ (Print A4) */}
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[36px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-emerald-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ (Print A4)</span>
            </button>

            {/* ปุ่มปิด */}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <X className="w-4 h-4" />
              <span>ปิด</span>
            </button>
          </div>
        </div>
      </header>

      {/* พื้นที่แสดงตัวอย่างเอกสาร A4 (Interactive Canvas) พื้นหลังสีขาวล้วน */}
      <main className="flex-1 overflow-y-auto print-preview-scroll-area p-3 sm:p-5 lg:p-7 flex justify-center items-start bg-white">
        <div
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out, max-width 0.2s ease',
          }}
          className={`manifest-a4-sheet bg-white text-slate-900 shadow-2xl rounded-sm p-4 sm:p-6 border border-slate-300 w-full box-border ${
            isLandscape ? 'max-w-[1123px]' : 'max-w-[794px]'
          }`}
        >
          {/* Header เอกสาร: กระชับ สะอาด ประหยัดเนื้อที่หัวกระดาษ */}
          <header className="border-b-2 border-slate-900 pb-2 mb-2.5 flex flex-row items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                ใบรายการนำส่งและลงนามรับพัสดุนักเรียนประจำหอพัก
              </h1>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-600 font-mono">
                <span>วันที่พิมพ์: <strong className="text-slate-900">{printDateDisplay}</strong></span>
                {selectedDate && (
                  <span>· รับเข้า: <strong className="text-slate-900">{formatThaiSlashDate(selectedDate)}</strong></span>
                )}
                <span>· รวมทั้งหมด <strong className="text-slate-900">{parcels.length}</strong> รายการ</span>
                <span>(เซ็นแล้ว {signedCount} / รอเซ็น {unsignedCount}{infirmaryCount > 0 ? `, งานพยาบาล ${infirmaryCount}` : ''}{legalHoldCount > 0 ? `, ติดนิติการ ${legalHoldCount}` : ''})</span>
              </div>
            </div>

            {/* ป้ายแสดงหอพักและรหัสตะกร้าสี (พื้นหลังสีขาว ไม่ใส่สีพื้นหลัง) */}
            <div
              className={`dorm-basket-badge border-2 ${activeTheme.borderClass} bg-white rounded-lg px-2.5 py-1 text-right shrink-0 shadow-2xs`}
              style={{
                borderColor: activeTheme.hexColor || undefined,
                backgroundColor: '#FFFFFF',
              }}
            >
              <div className={`text-xs sm:text-sm font-extrabold leading-tight ${activeTheme.textClass}`}>
                {dormitory === 'ALL' ? 'ทุกหอพักรวม' : activeTheme.name}
              </div>
              <div className="text-[10px] font-mono font-bold text-slate-800 flex items-center justify-end gap-1.5 mt-0.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border border-slate-900/20 shrink-0"
                  style={{
                    backgroundColor: activeTheme.hexColor,
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                />
                <span>
                  {activeTheme.basketCode} ({activeTheme.colorName})
                </span>
              </div>
            </div>
          </header>

          {/* ตารางรายการพัสดุสำหรับพิมพ์: กำหนด table-layout: fixed และคำนวณ % กว้างรวม 100% พอดีหน้ากระดาษ A4 ไม่ล้นขอบ */}
          <div className="w-full overflow-hidden">
            {isLandscape ? (
              /* =================== มุมมองแนวนอน (A4 Landscape Layout: 100% Width) =================== */
              <table className="w-full table-fixed border-collapse text-left border border-slate-300 bg-white">
                <thead className="table-header-group border-y-2 border-slate-900 bg-slate-100 text-slate-900 font-bold text-[10.5px]">
                  <tr className="border-y-2 border-slate-900 bg-slate-100">
                    <th className="py-2 px-1 border border-slate-300 text-center w-[4%] bg-slate-100 font-bold text-slate-900">ลำดับ</th>
                    <th className="py-2 px-2 border border-slate-300 w-[18%] bg-slate-100 font-bold text-slate-900">เลขพัสดุ (Tracking)</th>
                    <th className="py-2 px-2 border border-slate-300 w-[11%] bg-slate-100 font-bold text-slate-900">ขนส่ง</th>
                    <th className="py-2 px-1 border border-slate-300 text-center w-[9%] bg-slate-100 font-bold text-slate-900">รหัส นร.</th>
                    <th className="py-2 px-2 border border-slate-300 w-[19%] bg-slate-100 font-bold text-slate-900">
                      ชื่อ-นามสกุลนักเรียน (ชื่อเล่น · ชั้น)
                    </th>
                    <th className="py-2 px-2 border border-slate-300 w-[25%] bg-slate-100 font-bold text-slate-900">ประเภทสิ่งของ</th>
                    <th className="py-2 px-1.5 border border-slate-300 w-[7%] text-center bg-slate-100 font-bold text-slate-900">
                      ลายมือชื่อผู้รับ
                    </th>
                    <th className="py-2 px-1.5 border border-slate-300 w-[7%] text-center bg-slate-100 font-bold text-slate-900">
                      วันที่รับ
                    </th>
                  </tr>
                </thead>
                <tbody className="table-row-group text-[10.5px]">
                  {parcels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 border border-slate-300">
                        ไม่มีรายการพัสดุที่ตรงกับเงื่อนไขในขณะนี้
                      </td>
                    </tr>
                  ) : (
                    parcels.map((p, idx) => {
                      const isSigned = p.status === 'ส่งมอบสำเร็จ';
                      const isLegalHold = p.status === 'ติดนิติการ';
                      const isInfirmary = p.status === 'ติดต่องานพยาบาล';
                      const cellPy = density === 'compact' ? 'py-1' : 'py-1.5';
                      const recordedDate = isSigned
                        ? formatThaiSlashDate(p.deliveredDate || p.receivedDate || p.updatedAt)
                        : '';

                      return (
                        <tr
                          key={p.id}
                          style={
                            isLegalHold
                              ? { backgroundColor: '#FEF1F0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
                              : isInfirmary
                              ? { backgroundColor: '#FFFBEB', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
                              : undefined
                          }
                          className={`border-b break-inside-avoid ${
                            isLegalHold
                              ? 'bg-[#FEF1F0] text-rose-950 font-medium border-rose-300 print-highlight-legal print:bg-[#FEF1F0]'
                              : isInfirmary
                              ? 'bg-amber-50/70 text-amber-950 font-medium border-amber-300 print-highlight-infirmary print:bg-[#FFFBEB]'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          <td className={`${cellPy} px-1 border border-slate-300 text-center font-mono font-semibold tabular-nums text-slate-700`}>
                            {idx + 1}
                          </td>
                          <td className={`${cellPy} px-2 border border-slate-300 font-mono font-bold text-slate-900 tabular-nums truncate`}>
                            {p.trackingNumber}
                          </td>
                          <td className={`${cellPy} px-2 border border-slate-300 text-slate-700 truncate`}>
                            {p.courier}
                          </td>
                          <td className={`${cellPy} px-1 border border-slate-300 text-center font-mono font-semibold text-slate-900 tabular-nums`}>
                            {p.studentCode}
                          </td>
                          {/* ชื่อ-นามสกุลนักเรียนใน 1 บรรทัด ไม่ล้นขอบ */}
                          <td className={`${cellPy} px-2 border border-slate-300 font-bold text-slate-900 truncate`}>
                            <span>{p.studentFullName}</span>
                            {p.nickname && <span className="text-slate-600 font-normal ml-1">({p.nickname})</span>}
                            {p.gradeRoom && <span className="text-slate-500 font-normal text-[10px] ml-1.5">ชั้น {p.gradeRoom}</span>}
                          </td>
                          {/* ประเภทสิ่งของ พร้อมสถานะติดนิติการ/งานพยาบาลต่อท้ายโดยขึ้นบรรทัดใหม่ */}
                          <td className={`${cellPy} px-2 border border-slate-300 leading-tight`}>
                            <div className="font-semibold text-slate-800 truncate">{p.category}</div>
                            {isLegalHold && (
                              <div className="text-[9.5px] font-bold text-red-700 leading-tight">
                                [ติดนิติการ]
                              </div>
                            )}
                            {isInfirmary && (
                              <div className="text-[9.5px] font-bold text-amber-800 leading-tight">
                                [ติดต่องานพยาบาล]
                              </div>
                            )}
                          </td>
                          {/* ลายมือชื่อผู้รับ */}
                          <td className={`${cellPy} px-1 border border-slate-300 text-center`}>
                            {isSigned ? (
                              <div className="text-emerald-700 font-bold text-[9.5px] text-center leading-tight">
                                เซ็นรับแล้ว
                              </div>
                            ) : (
                              <div className="w-12 mx-auto pt-2.5 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
                                ลงชื่อ
                              </div>
                            )}
                          </td>
                          {/* วันที่รับ: ใช้ฟอนต์และสไตล์แบบเดียวกับคอลัมน์ลายมือชื่อผู้รับ */}
                          <td className={`${cellPy} px-1 border border-slate-300 text-center`}>
                            {isSigned ? (
                              <div className="text-emerald-700 font-bold text-[9.5px] text-center leading-tight">
                                {recordedDate}
                              </div>
                            ) : (
                              <div className="w-12 mx-auto pt-2.5 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
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
            ) : (
              /* =================== มุมมองแนวตั้ง (A4 Portrait Layout: 100% Width Perfectly Fit) =================== */
              <table className="w-full table-fixed border-collapse text-left border border-slate-300 bg-white">
                <thead className="table-header-group border-y-2 border-slate-900 bg-slate-100 text-slate-900 font-bold text-[10px]">
                  <tr className="border-y-2 border-slate-900 bg-slate-100">
                    <th className="py-2 px-1 border border-slate-300 text-center w-[5%] bg-slate-100 font-bold text-slate-900">ลำดับ</th>
                    <th className="py-2 px-2 border border-slate-300 w-[15%] bg-slate-100 font-bold text-slate-900">เลขพัสดุ / ขนส่ง</th>
                    <th className="py-2 px-1 border border-slate-300 text-center w-[8%] bg-slate-100 font-bold text-slate-900">รหัส นร.</th>
                    {/* ชื่อ-นามสกุลนักเรียน 19% กำหนด truncate เพื่อให้อยู่ใน 1 บรรทัดและไม่ดันตารางล้นขอบกระดาษ */}
                    <th className="py-2 px-2 border border-slate-300 w-[19%] bg-slate-100 font-bold text-slate-900">
                      ชื่อ-นามสกุลนักเรียน (ชื่อเล่น · ชั้น)
                    </th>
                    {/* ประเภทสิ่งของ auto (33% พื้นที่ที่เหลือ รวมครบ 100%) */}
                    <th className="py-2 px-2 border border-slate-300 w-[33%] bg-slate-100 font-bold text-slate-900">ประเภทสิ่งของ</th>
                    {/* ลายมือชื่อผู้รับ: 10% */}
                    <th className="py-2 px-1 border border-slate-300 w-[10%] text-center bg-slate-100 font-bold text-slate-900">
                      ลายมือชื่อผู้รับ
                    </th>
                    {/* วันที่รับ: 10% ฟอนต์แบบเดียวกับคอลัมน์ลายมือชื่อผู้รับ */}
                    <th className="py-2 px-1 border border-slate-300 w-[10%] text-center bg-slate-100 font-bold text-slate-900">
                      วันที่รับ
                    </th>
                  </tr>
                </thead>
                <tbody className="table-row-group text-[10px]">
                  {parcels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 border border-slate-300">
                        ไม่มีรายการพัสดุที่ตรงกับเงื่อนไขในขณะนี้
                      </td>
                    </tr>
                  ) : (
                    parcels.map((p, idx) => {
                      const isSigned = p.status === 'ส่งมอบสำเร็จ';
                      const isLegalHold = p.status === 'ติดนิติการ';
                      const isInfirmary = p.status === 'ติดต่องานพยาบาล';
                      const cellPy = density === 'compact' ? 'py-1' : 'py-1.5';
                      const recordedDate = isSigned
                        ? formatThaiSlashDate(p.deliveredDate || p.receivedDate || p.updatedAt)
                        : '';

                      return (
                        <tr
                          key={p.id}
                          style={
                            isLegalHold
                              ? { backgroundColor: '#FEF1F0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
                              : isInfirmary
                              ? { backgroundColor: '#FFFBEB', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }
                              : undefined
                          }
                          className={`border-b break-inside-avoid ${
                            isLegalHold
                              ? 'bg-[#FEF1F0] text-rose-950 font-medium border-rose-300 print-highlight-legal print:bg-[#FEF1F0]'
                              : isInfirmary
                              ? 'bg-amber-50/70 text-amber-950 font-medium border-amber-300 print-highlight-infirmary print:bg-[#FFFBEB]'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          <td className={`${cellPy} px-1 border border-slate-300 text-center font-mono font-semibold tabular-nums text-slate-700`}>
                            {idx + 1}
                          </td>
                          <td className={`${cellPy} px-2 border border-slate-300 leading-tight`}>
                            <div className="font-mono font-bold text-slate-900 tabular-nums truncate">
                              {p.trackingNumber}
                            </div>
                            <div className="text-[9px] text-slate-500 truncate">{p.courier}</div>
                          </td>
                          <td className={`${cellPy} px-1 border border-slate-300 text-center font-mono font-semibold text-slate-900 tabular-nums`}>
                            {p.studentCode}
                          </td>
                          {/* ชื่อ-นามสกุลนักเรียนใน 1 บรรทัด กำหนด truncate เพื่อไม่ให้ดันตารางล้นขอบกระดาษ A4 */}
                          <td className={`${cellPy} px-2 border border-slate-300 font-bold text-slate-900 truncate`} title={`${p.studentFullName} ${p.nickname ? `(${p.nickname})` : ''} ชั้น ${p.gradeRoom}`}>
                            <span>{p.studentFullName}</span>
                            {p.nickname && <span className="text-slate-600 font-normal ml-1">({p.nickname})</span>}
                            {p.gradeRoom && <span className="text-slate-500 font-normal text-[9.5px] ml-1">ชั้น {p.gradeRoom}</span>}
                          </td>
                          {/* ประเภทสิ่งของ (auto / 32%) พร้อมสถานะติดนิติการ/งานพยาบาลต่อท้ายโดยขึ้นบรรทัดใหม่ */}
                          <td className={`${cellPy} px-2 border border-slate-300 leading-tight`}>
                            <div className="font-semibold text-slate-800 truncate">{p.category}</div>
                            {isLegalHold && (
                              <div className="text-[9.5px] font-bold text-red-700 leading-tight mt-0.5">
                                [ติดนิติการ]
                              </div>
                            )}
                            {isInfirmary && (
                              <div className="text-[9.5px] font-bold text-amber-800 leading-tight mt-0.5">
                                [ติดต่องานพยาบาล]
                              </div>
                            )}
                          </td>
                          {/* ลายมือชื่อผู้รับ: 10% */}
                          <td className={`${cellPy} px-1 border border-slate-300 text-center`}>
                            {isSigned ? (
                              <div className="text-emerald-700 font-bold text-[9.5px] text-center leading-tight">
                                เซ็นรับแล้ว
                              </div>
                            ) : (
                              <div className="w-14 mx-auto pt-2 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
                                ลงชื่อ
                              </div>
                            )}
                          </td>
                          {/* วันที่รับ: 10% ใช้ฟอนต์และรูปแบบเดียวกับคอลัมน์ลายมือชื่อผู้รับ */}
                          <td className={`${cellPy} px-1 border border-slate-300 text-center`}>
                            {isSigned ? (
                              <div className="text-emerald-700 font-bold text-[9.5px] text-center leading-tight">
                                {recordedDate}
                              </div>
                            ) : (
                              <div className="w-14 mx-auto pt-2 border-b border-dotted border-slate-400 text-[8px] text-slate-400 text-center">
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
            )}
          </div>

          {/* สรุปข้อมูลยอดรวมท้ายตาราง (กะทัดรัด ประหยัดเนื้อที่ ไม่ล้นหน้า) */}
          <div className="mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-600 font-mono">
            <div>
              รวมทั้งสิ้น <strong>{parcels.length}</strong> รายการ (ส่งมอบแล้ว {signedCount} / รอส่งมอบ {unsignedCount}{legalHoldCount > 0 ? ` / ติดนิติการ ${legalHoldCount}` : ''})
            </div>
            <div className="text-[9px] text-slate-400">
              * พิมพ์ซ้ำหัวตารางทุกหน้ากระดาษโดยอัตโนมัติ · ขนาดกระดาษ A4
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
