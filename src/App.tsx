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
          Parcel Registration System
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
            className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'deliverables'
                ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900 hover:underline underline-offset-8'
            }`}
          >
            ติดตั้ง GitHub Pages & Action
          </button>
        </nav>

        {/* ซ่อน email Tasawan และปุ่มซิงก์ข้อมูลล่าสุดเมื่อแสดงบนจอมือถือและไอแพด (แสดงเฉพาะจอใหญ่ xl ขึ้นไป) */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
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

      {/* แถบแสดงสถานะการเชื่อมต่อ Firebase (ซ่อนบนจอมือถือและไอแพด) */}
      <div className="no-print hidden xl:block bg-slate-900 text-slate-200 px-4 md:px-8 py-2.5 border-b border-slate-800">
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
              <span>ไฟล์ติดตั้ง GitHub Pages & Action</span>
            </button>
          </div>
        </div>
      </div>

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

      {/* กล่องแจ้งเตือนเมื่อสแกนพบ แสดงเฉพาะ ชื่อ หอพัก และจำนวนชิ้นรวมปัจจุบัน เตือนแล้วปิดเลย */}
      {weeklyWarningPopup.isOpen && activePopupStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-parcel-warning-title"
          onClick={closeWeeklyWarningPopup}
          className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-2 border-red-600 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-red-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h2
                  id="weekly-parcel-warning-title"
                  className="text-base font-extrabold text-red-700"
                >
                  แจ้งเตือนจำนวนพัสดุ
                </h2>
              </div>
              <button
                type="button"
                aria-label="ปิดกล่องแจ้งเตือน"
                onClick={closeWeeklyWarningPopup}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium shrink-0">ชื่อ</span>
                <span className="font-bold text-slate-900 text-right">
                  {activePopupStudent.studentFullName}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium shrink-0">หอพัก</span>
                <span className="font-bold text-slate-900 text-right">
                  {activePopupStudent.dormitory || '-'}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="text-slate-500 font-medium shrink-0">จำนวนชิ้นรวมปัจจุบัน</span>
                <span className="text-lg font-mono font-extrabold text-red-600 tabular-nums">
                  {activePopupStudent.totalCount} ชิ้น
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={closeWeeklyWarningPopup}
              className="w-full min-h-[44px] py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              ปิด
            </button>
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
