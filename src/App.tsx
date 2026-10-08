import React, { useState } from 'react';
import {
  PackagePlus,
  Search,
  Printer,
  Users,
  BarChart3,
  BookOpen,
  RefreshCw,
  CloudCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { ParcelSystemProvider, useParcelSystem } from './context/ParcelSystemContext';
import {
  WEEKLY_PARCEL_WARNING_LIMIT,
  getDormitoryTheme,
  formatThaiSlashDate,
} from './types/parcel';
import { InboundView } from './components/InboundView';
import { TrackingView } from './components/TrackingView';
import { ManifestView } from './components/ManifestView';
import { StudentsImportView } from './components/StudentsImportView';
import { DashboardView } from './components/DashboardView';
import { DeliverablesView } from './components/DeliverablesView';

type TabKey = 'inbound' | 'tracking' | 'manifest' | 'students' | 'dashboard' | 'deliverables';

const MainWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('inbound');

  const {
    connectedEmail,
    students,
    parcels,
    overWeeklyLimitStudents,
    weeklyWarningPopup,
    openWeeklyWarningPopup,
    closeWeeklyWarningPopup,
    pendingWrites,
    quotaMetrics,
    syncMode,
    setSyncMode,
    isSyncing,
    syncPendingToFirebase,
    toastMessage,
    clearToast,
  } = useParcelSystem();

  const activePopupStudent =
    weeklyWarningPopup.focusedStudent ||
    (overWeeklyLimitStudents.length > 0 ? overWeeklyLimitStudents[0] : null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Top Bar Contract: 3 Zones (1. Single Wordmark, 2. Clean Text Nav Links, 3. Connected Account & Sync Action) */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <a
          href="#inbound"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('inbound');
          }}
          className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          ParcelSort Dormitory
        </a>

        <nav
          aria-label="เมนูหลักของระบบ"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => setActiveTab('inbound')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'inbound'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            รับเข้าพัสดุ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'tracking'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            ติดตามค้นหา
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manifest')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'manifest'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            ใบนำส่งหอพัก
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'students'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            ข้อมูลนักเรียน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            สถิติแดชบอร์ด
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deliverables')}
            className={`hidden xl:inline-block py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'deliverables'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            คู่มือ & CI/CD
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div
            title={`เชื่อมต่อ Firebase อัตโนมัติภายใต้บัญชี ${connectedEmail}`}
            className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <CloudCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 hidden sm:inline" />
            <span className="font-mono text-[11px] md:text-xs font-bold truncate max-w-[165px] sm:max-w-[220px]">
              {connectedEmail}
            </span>
          </div>

          <button
            type="button"
            onClick={syncPendingToFirebase}
            disabled={isSyncing}
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="font-mono tabular-nums">
              {isSyncing
                ? 'กำลังซิงก์...'
                : pendingWrites.length > 0
                ? `ซิงก์ทันที (${pendingWrites.length})`
                : 'ซิงก์ข้อมูลล่าสุด'}
            </span>
          </button>
        </div>
      </header>

      {/* แถบแสดงสถานะการเชื่อมต่อ Firebase อัตโนมัติภายใต้ Tasawan_app01@pcccr.ac.th */}
      <div className="no-print bg-slate-900 text-slate-200 px-4 md:px-8 py-2.5 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-emerald-400">
              เชื่อมต่อ Firebase อัตโนมัติ ({connectedEmail}):
            </span>
            <span>
              นักเรียนในระบบ{' '}
              <strong className="font-mono text-white tabular-nums">
                {students.length}
              </strong>{' '}
              คน · พัสดุทั้งหมด{' '}
              <strong className="font-mono text-white tabular-nums">
                {parcels.length}
              </strong>{' '}
              ชิ้น · ประหยัดการอ่าน{' '}
              <strong className="font-mono text-emerald-300 tabular-nums">
                {quotaMetrics.localLookupsSaved}
              </strong>{' '}
              Reads
              {pendingWrites.length > 0 && (
                <>
                  {' '}
                  · คิวรอซิงก์{' '}
                  <strong className="font-mono text-amber-300 tabular-nums">
                    {pendingWrites.length}
                  </strong>{' '}
                  รายการ
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setSyncMode('auto_cloud')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  syncMode === 'auto_cloud'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ซิงก์ขึ้น Cloud อัตโนมัติ
              </button>
              <button
                type="button"
                onClick={() => setSyncMode('local_buffer')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  syncMode === 'local_buffer'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                พักในเครื่องก่อน (Batch)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('deliverables')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>ดูโครงสร้างโค้ด & CI/CD</span>
            </button>
          </div>
        </div>
      </div>

      {/* แถบแจ้งเตือนด่วนเมื่อมีนักเรียนรับพัสดุเกิน 3 ชิ้นต่อสัปดาห์ */}
      {overWeeklyLimitStudents.length > 0 && (
        <div className="no-print bg-red-600 text-white px-4 md:px-8 py-2.5 border-b border-red-700">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                แจ้งเตือน: พบนักเรียนที่มีพัสดุเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นต่อสัปดาห์ จำนวน{' '}
                <strong className="font-mono text-sm underline tabular-nums">
                  {overWeeklyLimitStudents.length}
                </strong>{' '}
                คน (สูงสุด {overWeeklyLimitStudents[0]?.weekCount || 0} ชิ้น/สัปดาห์)
              </span>
            </div>
            <button
              type="button"
              onClick={() => openWeeklyWarningPopup(overWeeklyLimitStudents[0], 'manual')}
              className="min-h-[32px] px-3 py-1 bg-white text-red-700 hover:bg-red-50 font-bold rounded-lg transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
            >
              เปิดดูรายละเอียดแจ้งเตือน ({overWeeklyLimitStudents.length} คน)
            </button>
          </div>
        </div>
      )}

      {/* แจ้งเตือนสถานะการทำงาน (Toast Notification) */}
      {toastMessage && (
        <div className="no-print max-w-7xl w-full mx-auto px-4 md:px-8 pt-4">
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : toastMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : toastMessage.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-950'
                : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              type="button"
              aria-label="ปิดข้อความแจ้งเตือน"
              onClick={clearToast}
              className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* พื้นที่แสดงเนื้อหาหลัก (Main Viewport) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 md:py-8">
        {activeTab === 'inbound' && <InboundView />}
        {activeTab === 'tracking' && <TrackingView />}
        {activeTab === 'manifest' && <ManifestView />}
        {activeTab === 'students' && <StudentsImportView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'deliverables' && <DeliverablesView />}
      </main>

      {/* Popup แจ้งเตือนเมื่อพบว่ามีพัสดุนักเรียนเกิน 3 ชิ้นต่อสัปดาห์ */}
      {weeklyWarningPopup.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-parcel-warning-title"
          className="no-print fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border-2 border-red-600 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-red-200 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-700">
                    ระบบเฝ้าระวังปริมาณพัสดุนักเรียน (เกณฑ์กำหนดไม่เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์)
                  </p>
                  <h2
                    id="weekly-parcel-warning-title"
                    className="text-lg md:text-xl font-extrabold text-slate-900 mt-0.5"
                  >
                    แจ้งเตือน! พบพัสดุนักเรียนเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นต่อสัปดาห์
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {weeklyWarningPopup.triggerReason === 'inbound_added'
                      ? 'รายการพัสดุที่เพิ่งบันทึกรับเข้า ทำให้นักเรียนมีจำนวนพัสดุสะสมในรอบสัปดาห์นี้เกิน 3 ชิ้น'
                      : weeklyWarningPopup.triggerReason === 'student_lookup'
                      ? 'นักเรียนที่กำลังเลือกมีจำนวนพัสดุสะสมในรอบสัปดาห์นี้เกิน 3 ชิ้นแล้ว'
                      : `พบนักเรียนที่มีพัสดุรับเข้าเกิน 3 ชิ้นต่อสัปดาห์ จำนวน ${overWeeklyLimitStudents.length} คน`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="ปิดหน้าต่างแจ้งเตือนพัสดุเกินกำหนด"
                onClick={closeWeeklyWarningPopup}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activePopupStudent ? (
              <div className="space-y-4">
                {/* ข้อมูลนักเรียนที่กำลังแสดงใน Popup พร้อมสรุปจำนวนพัสดุ วัน / สัปดาห์ / เดือน */}
                <div className="p-5 bg-red-50/80 border border-red-200 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-red-800">
                        ข้อมูลนักเรียนที่มีพัสดุเกินเกณฑ์รายสัปดาห์:
                      </span>
                      <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {activePopupStudent.studentFullName}{' '}
                        {activePopupStudent.nickname && activePopupStudent.nickname !== '-' && (
                          <span className="font-normal text-sm text-slate-700">
                            ({activePopupStudent.nickname})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-700 font-mono mt-1 tabular-nums">
                        รหัสนักเรียน: <strong>{activePopupStudent.studentCode}</strong> · ชั้น{' '}
                        {activePopupStudent.gradeRoom} · {activePopupStudent.dormitory} ห้อง{' '}
                        {activePopupStudent.dormRoom}
                      </div>
                    </div>

                    <div className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-right shrink-0 self-start sm:self-center">
                      <span className="block text-[11px] font-semibold text-red-100">
                        สถานะเฝ้าระวังรายสัปดาห์
                      </span>
                      <span className="font-mono font-extrabold text-sm tabular-nums">
                        เกินเกณฑ์ ({activePopupStudent.weekCount} / {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น)
                      </span>
                    </div>
                  </div>

                  {/* ตัวเลขแสดงจำนวนพัสดุ วัน, สัปดาห์, เดือน */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center">
                      <span className="block text-xs font-semibold text-slate-600">
                        รายวัน (วันนี้)
                      </span>
                      <span className="block text-2xl font-mono font-extrabold text-slate-900 tabular-nums mt-1">
                        {activePopupStudent.dayCount}
                      </span>
                      <span className="block text-[11px] text-slate-500">ชิ้น</span>
                    </div>

                    <div className="bg-white border-2 border-red-600 rounded-xl p-3.5 text-center">
                      <span className="block text-xs font-bold text-red-700">
                        รายสัปดาห์ (7 วัน)
                      </span>
                      <span className="block text-2xl font-mono font-extrabold text-red-600 tabular-nums mt-1">
                        {activePopupStudent.weekCount}
                      </span>
                      <span className="block text-[11px] font-bold text-red-700">
                        ชิ้น (เกิน 3 ชิ้น/สัปดาห์)
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center">
                      <span className="block text-xs font-semibold text-slate-600">
                        รายเดือน (เดือนนี้)
                      </span>
                      <span className="block text-2xl font-mono font-extrabold text-slate-900 tabular-nums mt-1">
                        {activePopupStudent.monthCount}
                      </span>
                      <span className="block text-[11px] text-slate-500">ชิ้น</span>
                    </div>
                  </div>

                  {/* รายการพัสดุของนักเรียนคนนี้ในรอบสัปดาห์ */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-800">
                      รายการพัสดุในรอบสัปดาห์นี้ของ {activePopupStudent.studentFullName} (
                      {activePopupStudent.weekParcels.length} ชิ้น):
                    </span>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">ลำดับ</th>
                            <th className="py-2 px-3">เลขพัสดุ (Tracking)</th>
                            <th className="py-2 px-3">ขนส่ง</th>
                            <th className="py-2 px-3">ประเภทสิ่งของ</th>
                            <th className="py-2 px-3">วันที่รับเข้า</th>
                            <th className="py-2 px-3">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activePopupStudent.weekParcels.map((p, idx) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold tabular-nums">
                                #{idx + 1}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                                {p.trackingNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{p.courier}</td>
                              <td className="py-2 px-3 text-slate-800 font-medium">{p.category}</td>
                              <td className="py-2 px-3 font-mono tabular-nums">
                                {formatThaiSlashDate(p.receivedDate)}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {p.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* หากมีนักเรียนที่เกิน 3 ชิ้น/สัปดาห์ หลายคน ให้คลิกสลับดูรายคนได้ */}
                {overWeeklyLimitStudents.length > 1 && (
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-slate-800">
                      รายชื่อนักเรียนทั้งหมดที่มีพัสดุเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นต่อสัปดาห์ ({overWeeklyLimitStudents.length} คน) — คลิกเพื่อดูรายละเอียด:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {overWeeklyLimitStudents.map((stStats) => {
                        const isSelected = stStats.studentKey === activePopupStudent.studentKey;
                        const theme = getDormitoryTheme(stStats.dormitory);
                        return (
                          <button
                            key={stStats.studentKey}
                            type="button"
                            onClick={() => openWeeklyWarningPopup(stStats, 'manual')}
                            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-slate-800 border-slate-300 hover:bg-red-50 hover:border-red-300'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: theme.hexColor }}
                            />
                            <span>{stStats.studentFullName}</span>
                            <span className="font-mono font-bold tabular-nums">
                              (วัน {stStats.dayCount} · สัปดาห์ {stStats.weekCount} · เดือน {stStats.monthCount})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-slate-600">
                ยังไม่มีนักเรียนที่รับพัสดุเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นต่อสัปดาห์ในขณะนี้
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                เกณฑ์การแจ้งเตือน: แสดง Popup อัตโนมัติเมื่อจำนวนพัสดุของนักเรียนเกิน 3 ชิ้นต่อสัปดาห์ (ตั้งแต่ชิ้นที่ 4 ขึ้นไป)
              </span>
              <button
                type="button"
                onClick={closeWeeklyWarningPopup}
                className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                รับทราบและปิดหน้าต่างแจ้งเตือน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Tab Bar (Thumb-Zone Ergonomics สำหรับหน้าจอมือถือ) */}
      <nav
        aria-label="เมนูนำทางด้านล่างสำหรับมือถือ"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-16 px-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('inbound')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === 'inbound' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <PackagePlus className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">รับเข้า</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === 'tracking' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">ค้นหา</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manifest')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === 'manifest' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Printer className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">ใบนำส่ง</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === 'students' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">นักเรียน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-lg transition-colors ${
            activeTab === 'dashboard' ? 'text-slate-900 font-bold' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">สถิติ</span>
        </button>
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <ParcelSystemProvider>
      <MainWorkspace />
    </ParcelSystemProvider>
  );
}
