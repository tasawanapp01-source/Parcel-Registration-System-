import React, { useState, useEffect } from 'react';
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
  LogOut,
  ShieldCheck,
  UserCheck,
  UserCog,
  GraduationCap,
} from 'lucide-react';
import { ParcelSystemProvider, useParcelSystem } from './context/ParcelSystemContext';
import { Member, AppMenuKey, APP_MENU_DEFINITIONS } from './types/parcel';
import { InboundView } from './components/InboundView';
import { TrackingView } from './components/TrackingView';
import { ManifestView } from './components/ManifestView';
import { StudentsImportView } from './components/StudentsImportView';
import { DashboardView } from './components/DashboardView';
import { DeliverablesView } from './components/DeliverablesView';
import { MembersAccessView } from './components/MembersAccessView';
import { LoginView } from './components/LoginView';

interface MainWorkspaceProps {
  currentMember: Member;
}

const MainWorkspace: React.FC<MainWorkspaceProps> = ({ currentMember }) => {
  const {
    allowedMenusForCurrentMember,
    logoutMember,
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

  const [activeTab, setActiveTab] = useState<AppMenuKey>('inbound');

  // ปรับ activeTab อัตโนมัติหากผู้ใช้ไม่มีสิทธิ์เข้าถึงหน้านั้นๆ
  useEffect(() => {
    if (
      allowedMenusForCurrentMember.length > 0 &&
      !allowedMenusForCurrentMember.includes(activeTab)
    ) {
      setActiveTab(allowedMenusForCurrentMember[0]);
    }
  }, [allowedMenusForCurrentMember, activeTab]);

  const activePopupStudent =
    weeklyWarningPopup.focusedStudent ||
    (overWeeklyLimitStudents.length > 0 ? overWeeklyLimitStudents[0] : null);

  const isMenuAllowed = (key: AppMenuKey) => allowedMenusForCurrentMember.includes(key);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Top Bar Contract: 3 Zones (1. Wordmark, 2. Text Nav Links, 3. Account, Sync & Logout) */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <a
          href="#inbound"
          onClick={(e) => {
            e.preventDefault();
            if (isMenuAllowed('inbound')) setActiveTab('inbound');
          }}
          className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Parcel Registration System
        </a>

        {/* Desktop Nav Links - กรองเฉพาะเมนูที่ผู้ใช้ปัจจุบันได้รับอนุญาต */}
        <nav
          aria-label="เมนูหลักของระบบ"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600"
        >
          {isMenuAllowed('inbound') && (
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
          )}

          {isMenuAllowed('tracking') && (
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
          )}

          {isMenuAllowed('manifest') && (
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
          )}

          {isMenuAllowed('students') && (
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
          )}

          {isMenuAllowed('dashboard') && (
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
          )}

          {isMenuAllowed('members') && (
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'members'
                  ? 'text-indigo-700 font-bold underline underline-offset-8 decoration-2'
                  : 'hover:text-indigo-600 hover:underline underline-offset-8'
              }`}
            >
              จัดการสมาชิก & สิทธิ์
            </button>
          )}

          {isMenuAllowed('deliverables') && (
            <button
              type="button"
              onClick={() => setActiveTab('deliverables')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'deliverables'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900 hover:underline underline-offset-8'
              }`}
            >
              ติดตั้งระบบ
            </button>
          )}
        </nav>

        {/* User Info & Actions Zone */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Member Profile Badge */}
          <div className="flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-100/90 border border-slate-200/90 rounded-xl text-xs">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                currentMember.role === 'ผู้ดูแลระบบ'
                  ? 'bg-indigo-600 text-white'
                  : currentMember.role === 'ครู'
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
              title={currentMember.role}
            >
              {currentMember.role === 'ผู้ดูแลระบบ' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : currentMember.role === 'ครู' ? (
                <GraduationCap className="w-3.5 h-3.5" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
            </div>

            <div className="flex flex-col text-left max-w-[120px] sm:max-w-[180px]">
              <span className="font-semibold text-slate-900 truncate leading-tight">
                {currentMember.fullName}
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-none">
                {currentMember.role}
              </span>
            </div>
          </div>

          {/* Sync action (Desktop) */}
          <div className="hidden xl:flex items-center gap-2">
            <button
              type="button"
              onClick={syncPendingToFirebase}
              disabled={isSyncing}
              title="ดึงข้อมูลล่าสุดจากฐานข้อมูล Firestore"
              className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="font-mono tabular-nums">
                {isSyncing ? 'กำลังโหลด...' : 'รีเฟรช Cloud'}
              </span>
            </button>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={logoutMember}
            title="ออกจากระบบ"
            className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      {/* แถบแสดงสถานะการเชื่อมต่อ Firestore โดยตรง (Live Direct Cloud DB) */}
      <div className="no-print hidden xl:block bg-slate-900 text-slate-200 px-4 md:px-8 py-2 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ฐานข้อมูล Firestore โดยตรง ({connectedEmail}):
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
              ชิ้น · บันทึก ลบ และแก้ไขลงฐานข้อมูลสดแบบเรียลไทม์ (ไม่เก็บข้อมูลบนเครื่อง)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
              <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Direct Cloud Database Active</span>
            </div>
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
        {activeTab === 'inbound' && isMenuAllowed('inbound') && <InboundView />}
        {activeTab === 'tracking' && isMenuAllowed('tracking') && <TrackingView />}
        {activeTab === 'manifest' && isMenuAllowed('manifest') && <ManifestView />}
        {activeTab === 'students' && isMenuAllowed('students') && <StudentsImportView />}
        {activeTab === 'dashboard' && isMenuAllowed('dashboard') && <DashboardView />}
        {activeTab === 'members' && isMenuAllowed('members') && <MembersAccessView />}
        {activeTab === 'deliverables' && isMenuAllowed('deliverables') && <DeliverablesView />}
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

      {/* Mobile Fixed Bottom Tab Bar - แสดงตามสิทธิ์ที่อนุญาต */}
      <nav
        aria-label="เมนูนำทางด้านล่างสำหรับมือถือ"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-16 px-1 overflow-x-auto"
      >
        {isMenuAllowed('inbound') && (
          <button
            type="button"
            onClick={() => setActiveTab('inbound')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'inbound' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <PackagePlus className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">รับเข้า</span>
          </button>
        )}

        {isMenuAllowed('tracking') && (
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'tracking' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">ค้นหา</span>
          </button>
        )}

        {isMenuAllowed('manifest') && (
          <button
            type="button"
            onClick={() => setActiveTab('manifest')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'manifest' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Printer className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">ใบนำส่ง</span>
          </button>
        )}

        {isMenuAllowed('students') && (
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'students' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">นักเรียน</span>
          </button>
        )}

        {isMenuAllowed('dashboard') && (
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">สถิติ</span>
          </button>
        )}

        {isMenuAllowed('members') && (
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              activeTab === 'members' ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <UserCog className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">สมาชิก</span>
          </button>
        )}
      </nav>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentMember } = useParcelSystem();
  if (!currentMember) {
    return <LoginView />;
  }
  return <MainWorkspace currentMember={currentMember} />;
};

export default function App() {
  return (
    <ParcelSystemProvider>
      <AppContent />
    </ParcelSystemProvider>
  );
}
