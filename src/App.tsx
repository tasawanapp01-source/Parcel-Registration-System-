import React, { useState, useEffect, useRef } from 'react';
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
  Settings,
  ChevronDown,
  Boxes,
  PackageCheck,
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // ปิดเมนูตั้งค่าเมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ปิดเมนูตั้งค่าเมื่อกด Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsMobileSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const isSettingsActive = ['students', 'members', 'deliverables'].includes(activeTab);
  const hasAnySettingsMenu =
    isMenuAllowed('students') ||
    isMenuAllowed('members') ||
    isMenuAllowed('deliverables');

  const getMemberDisplayName = (member: Member) => {
    const roleLabel =
      member.role === 'ผู้ดูแลระบบ' ? 'ผู้ดูแลระบบหลัก (Admin)' : member.role;
    if (
      !member.fullName ||
      member.fullName === roleLabel ||
      member.fullName === 'ผู้ดูแลระบบหลัก (Admin)' ||
      member.fullName === 'ผู้ดูแลระบบ'
    ) {
      return roleLabel;
    }
    return `${roleLabel}: ${member.fullName}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Top Bar: 2 แถว (แถว 1: ชื่อระบบ & เมนูนำทางรวมถึงเมนูตั้งค่า, แถว 2: ปุ่มผู้ดูแลระบบหลัก (Admin) และปุ่มออกจากระบบ รวมเป็นปุ่มเดียว) */}
      <header className="no-print sticky top-0 z-30 bg-white shadow-xs">
        {/* แถวที่ 1: ชื่อระบบ & เมนูนำทางหลัก */}
        <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <a
            href="#inbound"
            onClick={(e) => {
              e.preventDefault();
              if (isMenuAllowed('inbound')) setActiveTab('inbound');
            }}
            className="text-base md:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              <PackageCheck className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <Boxes className="w-4.5 h-4.5 text-indigo-600 hidden sm:inline-block" />
              <span>ระบบลงทะเบียนพัสดุ</span>
            </div>
          </a>

          {/* Desktop Nav Links - กรองเฉพาะเมนูที่ผู้ใช้ปัจจุบันได้รับอนุญาต */}
          <nav
            aria-label="เมนูหลักของระบบ"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
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

            {/* เมนูตั้งค่า (รวม ข้อมูลนักเรียน, จัดการสมาชิก & สิทธิ์, ติดตั้งระบบ, และปุ่มรีเฟรช Cloud) */}
            {hasAnySettingsMenu && (
              <div className="relative" ref={settingsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isSettingsActive
                      ? 'text-indigo-600 font-bold underline underline-offset-8 decoration-2'
                      : 'hover:text-slate-900 hover:underline underline-offset-8'
                  }`}
                  aria-expanded={isSettingsOpen}
                  aria-haspopup="true"
                >
                  <Settings className="w-4 h-4" />
                  <span>ตั้งค่า</span>
                  {isSettingsActive && (
                    <span className="text-[11px] px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-semibold no-underline">
                      {activeTab === 'students'
                        ? 'ข้อมูลนักเรียน'
                        : activeTab === 'members'
                        ? 'จัดการสมาชิก & สิทธิ์'
                        : 'ติดตั้งระบบ'}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isSettingsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu รายการตั้งค่า */}
                {isSettingsOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                      <span>เมนูตั้งค่าระบบ</span>
                      <span className="text-[9px] font-normal text-emerald-600 font-mono">Live Firestore DB</span>
                    </div>

                    {isMenuAllowed('students') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('students');
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeTab === 'students'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold leading-tight">ข้อมูลนักเรียน</div>
                          <div className="text-[10px] text-slate-400">นำเข้าและจัดการทะเบียนนักเรียน</div>
                        </div>
                      </button>
                    )}

                    {isMenuAllowed('members') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('members');
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeTab === 'members'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <UserCog className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold leading-tight">จัดการสมาชิก & สิทธิ์</div>
                          <div className="text-[10px] text-slate-400">กำหนดสิทธิ์และบัญชีผู้ใช้งาน</div>
                        </div>
                      </button>
                    )}

                    {isMenuAllowed('deliverables') && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('deliverables');
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                          activeTab === 'deliverables'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold leading-tight">ติดตั้งระบบ</div>
                          <div className="text-[10px] text-slate-400">คู่มือและไฟล์ติดตั้ง GitHub Pages</div>
                        </div>
                      </button>
                    )}

                    {/* ปุ่มรีเฟรช Cloud ย้ายมาไว้ในเมนูตั้งค่า */}
                    <div className="mt-1 pt-1.5 border-t border-slate-100 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          syncPendingToFirebase();
                          setIsSettingsOpen(false);
                        }}
                        disabled={isSyncing}
                        className="w-full px-2.5 py-2 text-left text-xs flex items-center justify-between rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 text-slate-700"
                        title="ดึงข้อมูลล่าสุดจากฐานข้อมูล Firestore"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {isSyncing ? 'กำลังซิงค์...' : 'รีเฟรช Cloud'}
                            </div>
                            <div className="text-[10px] text-slate-400">ดึงข้อมูลล่าสุดจาก Firestore</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                          Live DB
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* แถวที่ 2 (วางไว้บรรทัดใหม่): ข้อมูล Direct Cloud DB (แสดงเฉพาะ Desktop ซ่อนบนมือถือและแท็บเล็ต) และปุ่มรวมผู้ดูแลระบบ+ออกจากระบบ */}
        <div className="bg-slate-50/95 border-b border-slate-200/90 px-4 md:px-8 py-2 flex items-center justify-end lg:justify-between gap-2.5 text-xs">
          {/* ข้อมูลการเชื่อมต่อฐานข้อมูล Cloud DB สด - ซ่อนบนหน้าจอมือถือและแท็บเล็ต (hidden บนจอเล็กถึงแท็บเล็ต แสดงเฉพาะ lg ขึ้นไป) */}
          <div className="hidden lg:flex items-center gap-2 text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Direct Cloud DB
            </span>
            <span className="text-slate-500 text-xs">
              ({connectedEmail}): นักเรียน <strong className="text-slate-900 font-mono tabular-nums">{students.length}</strong> คน · พัสดุ <strong className="text-slate-900 font-mono tabular-nums">{parcels.length}</strong> ชิ้น
            </span>
          </div>

          {/* ปุ่มผู้ดูแลระบบหลัก (Admin) และปุ่มออกจากระบบ รวมให้เป็นปุ่มเดียวกัน */}
          <div className="flex items-center ml-auto">
            <div className="inline-flex items-stretch bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs transition-all overflow-hidden">
              {/* ส่วนที่ 1: สถานะผู้ดูแลระบบหลัก / โปรไฟล์ผู้ใช้งาน */}
              <button
                type="button"
                onClick={() => {
                  if (isMenuAllowed('members')) setActiveTab('members');
                }}
                title={isMenuAllowed('members') ? 'คลิกเพื่อจัดการสมาชิก & สิทธิ์' : 'ข้อมูลผู้ใช้งาน'}
                className={`px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                  isMenuAllowed('members')
                    ? 'cursor-pointer hover:bg-slate-50 text-slate-800 hover:text-indigo-600'
                    : 'cursor-default text-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 ${
                    currentMember.role === 'ผู้ดูแลระบบ'
                      ? 'bg-indigo-600'
                      : currentMember.role === 'ครู'
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {currentMember.role === 'ผู้ดูแลระบบ' ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : currentMember.role === 'ครู' ? (
                    <GraduationCap className="w-3.5 h-3.5" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="font-bold tracking-tight">
                  {getMemberDisplayName(currentMember)}
                </span>
              </button>

              {/* เส้นคั่นกลางปุ่ม */}
              <div className="w-px bg-slate-200 self-stretch my-1" />

              {/* ส่วนที่ 2: ปุ่มออกจากระบบ */}
              <button
                type="button"
                onClick={logoutMember}
                title="คลิกเพื่อออกจากระบบ"
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer group"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 transition-colors" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      </header>

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

        {hasAnySettingsMenu && (
          <button
            type="button"
            onClick={() => setIsMobileSettingsOpen(true)}
            className={`min-h-[48px] px-2 flex flex-col items-center justify-center rounded-lg transition-colors ${
              isSettingsActive ? 'text-indigo-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-1 whitespace-nowrap">ตั้งค่า</span>
          </button>
        )}
      </nav>

      {/* เมนูตั้งค่าสำหรับมือถือ (Mobile Settings Modal Sheet) */}
      {isMobileSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูตั้งค่าระบบ"
          onClick={() => setIsMobileSettingsOpen(false)}
          className="no-print lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">เมนูตั้งค่าระบบ</h3>
                  <p className="text-[10px] text-slate-400">เลือกหน้าที่ต้องการตั้งค่า</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="ปิดเมนูตั้งค่า"
                onClick={() => setIsMobileSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {isMenuAllowed('students') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('students');
                    setIsMobileSettingsOpen(false);
                  }}
                  className={`w-full p-3 text-left rounded-xl flex items-center gap-3 transition-colors ${
                    activeTab === 'students'
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">ข้อมูลนักเรียน</div>
                    <div className="text-[10px] text-slate-500 font-normal">นำเข้าและจัดการทะเบียนนักเรียน</div>
                  </div>
                </button>
              )}

              {isMenuAllowed('members') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('members');
                    setIsMobileSettingsOpen(false);
                  }}
                  className={`w-full p-3 text-left rounded-xl flex items-center gap-3 transition-colors ${
                    activeTab === 'members'
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <UserCog className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">จัดการสมาชิก & สิทธิ์</div>
                    <div className="text-[10px] text-slate-500 font-normal">จัดการผู้ใช้และสิทธิ์เข้าถึงเมนู</div>
                  </div>
                </button>
              )}

              {isMenuAllowed('deliverables') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('deliverables');
                    setIsMobileSettingsOpen(false);
                  }}
                  className={`w-full p-3 text-left rounded-xl flex items-center gap-3 transition-colors ${
                    activeTab === 'deliverables'
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">ติดตั้งระบบ</div>
                    <div className="text-[10px] text-slate-500 font-normal">คู่มือและไฟล์ติดตั้ง GitHub Pages</div>
                  </div>
                </button>
              )}

              {/* ปุ่มรีเฟรช Cloud สำหรับมือถือ */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    syncPendingToFirebase();
                    setIsMobileSettingsOpen(false);
                  }}
                  disabled={isSyncing}
                  className="w-full p-3 text-left rounded-xl flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">
                        {isSyncing ? 'กำลังโหลดข้อมูล...' : 'รีเฟรช Cloud'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">ดึงข้อมูลล่าสุดจากฐานข้อมูล Firestore</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 font-semibold">
                    Live Sync
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
