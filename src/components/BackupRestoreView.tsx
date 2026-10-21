import React, { useState, useMemo, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileCheck,
  Info,
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  Student,
  Parcel,
  ParcelStatus,
  PARCEL_STATUSES,
  formatThaiSlashDate,
  formatStudentCode,
} from '../types/parcel';

export const BackupRestoreView: React.FC = () => {
  const {
    currentMember,
    students,
    parcels,
    bulkImportStudents,
    bulkImportParcels,
    fullRestoreSystemBackup,
    isSyncing,
    syncProgress,
  } = useParcelSystem();

  const isAdmin = currentMember?.role === 'ผู้ดูแลระบบ';

  // Sub-tabs: 'all' | 'students' | 'parcels-by-status'
  const [activeTab, setActiveTab] = useState<'all' | 'students' | 'parcels-by-status'>('all');

  // -------------------------------------------------------------------------
  // TAB 1: FULL BACKUP & RESTORE
  // -------------------------------------------------------------------------
  const [fullRestoreFile, setFullRestoreFile] = useState<File | null>(null);
  const [fullRestoreData, setFullRestoreData] = useState<{
    students?: Student[];
    parcels?: Parcel[];
    meta?: Record<string, unknown>;
  } | null>(null);
  const [fullRestoreMode, setFullRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isFullRestoreConfirmOpen, setIsFullRestoreConfirmOpen] = useState(false);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [fullRestoreError, setFullRestoreError] = useState<string | null>(null);
  const fullFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // TAB 2: STUDENTS EXPORT & RESTORE
  // -------------------------------------------------------------------------
  const [studentRestoreFile, setStudentRestoreFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>[] | null>(null);
  const [studentRestoreError, setStudentRestoreError] = useState<string | null>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // TAB 3: PARCELS BY STATUS EXPORT & RESTORE
  // -------------------------------------------------------------------------
  const [selectedExportStatus, setSelectedExportStatus] = useState<string>('ALL');
  const [parcelRestoreFile, setParcelRestoreFile] = useState<File | null>(null);
  const [parsedParcels, setParsedParcels] = useState<Parcel[] | null>(null);
  const [parcelRestoreError, setParcelRestoreError] = useState<string | null>(null);
  const parcelFileInputRef = useRef<HTMLInputElement>(null);

  // Counts by parcel status
  const parcelStatusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of PARCEL_STATUSES) {
      map.set(st, 0);
    }
    for (const p of parcels) {
      const current = map.get(p.status) || 0;
      map.set(p.status, current + 1);
    }
    return map;
  }, [parcels]);

  // Parcels filtered by selected status for Tab 3
  const statusFilteredParcels = useMemo(() => {
    if (selectedExportStatus === 'ALL') return parcels;
    return parcels.filter((p) => p.status === selectedExportStatus);
  }, [parcels, selectedExportStatus]);

  // -------------------------------------------------------------------------
  // HELPER: Download File Function
  // -------------------------------------------------------------------------
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTimestampFilenameStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}`;
  };

  // -------------------------------------------------------------------------
  // TAB 1 ACTIONS: Full Backup Download & File Parsing
  // -------------------------------------------------------------------------
  const handleDownloadFullBackup = () => {
    const now = new Date();
    const backupObj = {
      meta: {
        system: 'Student Parcel Management & Tracking System',
        version: '1.0',
        exportedAt: now.toISOString(),
        exportedAtThai: formatThaiSlashDate(now.toISOString()),
        studentsCount: students.length,
        parcelsCount: parcels.length,
      },
      students,
      parcels,
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const filename = `SPMS_FULL_BACKUP_${getTimestampFilenameStr()}.json`;
    triggerDownload(jsonStr, filename, 'application/json;charset=utf-8');
  };

  const handleFullFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFullRestoreFile(file);
    setFullRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let parsedStudentsList: Student[] = [];
        let parsedParcelsList: Parcel[] = [];

        if (Array.isArray(parsed)) {
          // If the array itself is parcels or students
          if (parsed.length > 0 && 'trackingNumber' in parsed[0]) {
            parsedParcelsList = parsed;
          } else if (parsed.length > 0 && 'studentCode' in parsed[0]) {
            parsedStudentsList = parsed;
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          if (Array.isArray(parsed.students)) {
            parsedStudentsList = parsed.students;
          }
          if (Array.isArray(parsed.parcels)) {
            parsedParcelsList = parsed.parcels;
          }
        }

        if (parsedStudentsList.length === 0 && parsedParcelsList.length === 0) {
          throw new Error('ไม่พบโครงสร้างข้อมูลนักเรียนหรือพัสดุในไฟล์ที่เลือก');
        }

        setFullRestoreData({
          students: parsedStudentsList,
          parcels: parsedParcelsList,
          meta: parsed.meta || {},
        });
      } catch (err) {
        setFullRestoreError(
          `ไม่สามารถอ่านไฟล์ JSON ได้: ${err instanceof Error ? err.message : 'โครงสร้างไฟล์ไม่ถูกต้อง'}`
        );
        setFullRestoreData(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExecuteFullRestore = async () => {
    if (!fullRestoreData) return;
    setIsFullRestoreConfirmOpen(false);
    setRestoreConfirmInput('');

    await fullRestoreSystemBackup(
      {
        students: fullRestoreData.students,
        parcels: fullRestoreData.parcels,
      },
      fullRestoreMode === 'replace'
    );

    setFullRestoreFile(null);
    setFullRestoreData(null);
    if (fullFileInputRef.current) fullFileInputRef.current.value = '';
  };

  // -------------------------------------------------------------------------
  // TAB 2 ACTIONS: Students Export & Restore
  // -------------------------------------------------------------------------
  const handleExportStudentsJson = () => {
    const jsonStr = JSON.stringify(students, null, 2);
    const filename = `students_backup_${getTimestampFilenameStr()}.json`;
    triggerDownload(jsonStr, filename, 'application/json;charset=utf-8');
  };

  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const handleExportStudentsCsv = () => {
    const headers = [
      'รหัสนักเรียน',
      'เลขที่',
      'คำนำหน้า',
      'ชื่อ',
      'นามสกุล',
      'ชื่อเล่น',
      'ระดับชั้น',
      'ห้อง',
      'หอพัก',
      'ห้องพักหอ',
      'เตียง',
    ];
    const rows = students.map((s) => [
      escapeCsv(s.studentCode),
      escapeCsv(s.seqNo),
      escapeCsv(s.prefix),
      escapeCsv(s.firstName),
      escapeCsv(s.lastName),
      escapeCsv(s.nickname),
      escapeCsv(s.grade),
      escapeCsv(s.room),
      escapeCsv(s.dormitory),
      escapeCsv(s.dormRoom),
      escapeCsv(s.bed),
    ]);

    // Add UTF-8 BOM so Excel opens Thai characters cleanly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const filename = `students_export_${getTimestampFilenameStr()}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8');
  };

  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStudentRestoreFile(file);
    setStudentRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed.students;
          if (!Array.isArray(list)) throw new Error('ไม่พบรายการข้อมูลนักเรียน');
          setParsedStudents(list);
        } else {
          // CSV Parser
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) throw new Error('ไฟล์ CSV ไม่มีข้อมูล');
          const dataRows = lines.slice(1);
          const studentList: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>[] = [];

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const cols = row.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 5) {
              studentList.push({
                studentCode: formatStudentCode(cols[0]),
                seqNo: parseInt(cols[1], 10) || i + 1,
                prefix: cols[2] || '',
                firstName: cols[3] || '',
                lastName: cols[4] || '',
                nickname: cols[5] || '',
                grade: cols[6] || '',
                room: cols[7] || '',
                dormitory: cols[8] || '',
                dormRoom: cols[9] || '',
                bed: cols[10] || '',
              });
            }
          }
          if (studentList.length === 0) throw new Error('ไม่พบข้อมูลนักเรียนที่ถูกต้องในไฟล์ CSV');
          setParsedStudents(studentList);
        }
      } catch (err) {
        setStudentRestoreError(
          `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err instanceof Error ? err.message : 'รูปแบบไม่ถูกต้อง'}`
        );
        setParsedStudents(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExecuteStudentsRestore = async () => {
    if (!parsedStudents || parsedStudents.length === 0) return;
    await bulkImportStudents(parsedStudents);
    setStudentRestoreFile(null);
    setParsedStudents(null);
    if (studentFileInputRef.current) studentFileInputRef.current.value = '';
  };

  // -------------------------------------------------------------------------
  // TAB 3 ACTIONS: Parcels by Status Export & Restore
  // -------------------------------------------------------------------------
  const handleExportParcelsJson = () => {
    const jsonStr = JSON.stringify(statusFilteredParcels, null, 2);
    const statusTag = selectedExportStatus === 'ALL' ? 'ALL_STATUSES' : selectedExportStatus.replace(/\s+/g, '_');
    const filename = `parcels_${statusTag}_${getTimestampFilenameStr()}.json`;
    triggerDownload(jsonStr, filename, 'application/json;charset=utf-8');
  };

  const handleExportParcelsCsv = () => {
    const headers = [
      'หมายเลขพัสดุ (Tracking)',
      'รหัสนักเรียน',
      'ชื่อ-นามสกุลผู้รับ',
      'ชื่อเล่น',
      'ชั้น/ห้อง',
      'หอพัก',
      'ห้องหอ',
      'เตียง',
      'ประเภทสิ่งของ',
      'สถานะพัสดุ',
      'บริษัทขนส่ง',
      'วันที่รับเข้า',
      'ชั่วโมงที่รับ',
      'วันที่ส่งมอบ',
      'หมายเหตุ',
    ];

    const rows = statusFilteredParcels.map((p) => [
      escapeCsv(p.trackingNumber),
      escapeCsv(p.studentCode),
      escapeCsv(p.studentFullName),
      escapeCsv(p.nickname),
      escapeCsv(p.gradeRoom),
      escapeCsv(p.dormitory),
      escapeCsv(p.dormRoom),
      escapeCsv(p.bed),
      escapeCsv(p.category),
      escapeCsv(p.status),
      escapeCsv(p.courier),
      escapeCsv(p.receivedDate),
      escapeCsv(p.receivedHour),
      escapeCsv(p.deliveredDate || ''),
      escapeCsv(p.note),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const statusTag = selectedExportStatus === 'ALL' ? 'ALL_STATUSES' : selectedExportStatus.replace(/\s+/g, '_');
    const filename = `parcels_${statusTag}_${getTimestampFilenameStr()}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8');
  };

  const handleParcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParcelRestoreFile(file);
    setParcelRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed.parcels;
          if (!Array.isArray(list)) throw new Error('ไม่พบรายการข้อมูลพัสดุ');
          setParsedParcels(list);
        } else {
          // CSV Parser
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) throw new Error('ไฟล์ CSV ไม่มีข้อมูล');
          const dataRows = lines.slice(1);
          const parcelList: Parcel[] = [];

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const cols = row.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 10) {
              const trackingNumber = cols[0];
              parcelList.push({
                id: trackingNumber,
                trackingNumber,
                studentCode: formatStudentCode(cols[1]),
                studentFullName: cols[2] || '-',
                nickname: cols[3] || '',
                gradeRoom: cols[4] || '-',
                dormitory: cols[5] || '-',
                dormRoom: cols[6] || '-',
                bed: cols[7] || '-',
                category: cols[8] || 'อื่นๆ',
                status: (cols[9] as ParcelStatus) || 'ลงทะเบียนรับพัสดุ',
                courier: cols[10] || 'Flash Express',
                receivedDate: cols[11] || '',
                receivedHour: parseInt(cols[12], 10) || 12,
                deliveredDate: cols[13] || '',
                note: cols[14] || '',
                ownerId: 'tasawan_app01_pcccr_ac_th',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
          if (parcelList.length === 0) throw new Error('ไม่พบข้อมูลพัสดุที่ถูกต้องในไฟล์ CSV');
          setParsedParcels(parcelList);
        }
      } catch (err) {
        setParcelRestoreError(
          `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err instanceof Error ? err.message : 'รูปแบบไม่ถูกต้อง'}`
        );
        setParsedParcels(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExecuteParcelRestore = async () => {
    if (!parsedParcels || parsedParcels.length === 0) return;
    await bulkImportParcels(parsedParcels);
    setParcelRestoreFile(null);
    setParsedParcels(null);
    if (parcelFileInputRef.current) parcelFileInputRef.current.value = '';
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-xl mx-auto shadow-sm space-y-4">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">จำกัดสิทธิ์เฉพาะผู้ดูแลระบบหลัก</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          เมนูการสำรอง ส่งออก และกู้คืนข้อมูลนี้สงวนไว้สำหรับการดูแลของผู้ดูแลระบบหลัก (Admin) เท่านั้น
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                การดูแลของผู้ดูแลระบบ
              </span>
              <span className="text-xs text-slate-400">Direct Firestore Backup & Restore</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Database className="w-7 h-7 text-indigo-400 shrink-0" />
              <span>สำรอง ส่งออก และกู้คืนข้อมูล</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              จัดการสำรองข้อมูลทั้งหมดของระบบ หรือแยกตามหมวดหมู่ข้อมูลนักเรียน และข้อมูลการลงทะเบียนพัสดุตามสถานะ รองรับทั้งไฟล์ JSON มาตรฐาน และ CSV/Excel
            </p>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
              <div className="text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>นักเรียนในระบบ</span>
              </div>
              <div className="text-2xl font-black font-mono text-white tabular-nums">{students.length}</div>
              <div className="text-[10px] text-slate-400">คนพร้อมใช้งาน</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
              <div className="text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>พัสดุในระบบ</span>
              </div>
              <div className="text-2xl font-black font-mono text-white tabular-nums">{parcels.length}</div>
              <div className="text-[10px] text-slate-400">ชิ้นทั้งหมด</div>
            </div>
          </div>
        </div>

        {/* Syncing Progress Bar */}
        {isSyncing && syncProgress && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                กำลังดำเนินการเขียน/กู้คืนข้อมูลลง Firestore...
              </span>
              <span className="font-mono tabular-nums">
                {syncProgress.completed} / {syncProgress.total} รายการ ({Math.round((syncProgress.completed / Math.max(1, syncProgress.total)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-200"
                style={{ width: `${(syncProgress.completed / Math.max(1, syncProgress.total)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-white text-indigo-600 border-t-2 border-x border-slate-200 border-t-indigo-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-600" />
          <span>สำรอง & กู้คืนแบบทั้งหมด</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 font-mono">
            Full System
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'students'
              ? 'bg-white text-indigo-600 border-t-2 border-x border-slate-200 border-t-indigo-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>ข้อมูลนักเรียน</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 font-mono">
            {students.length} คน
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('parcels-by-status')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'parcels-by-status'
              ? 'bg-white text-indigo-600 border-t-2 border-x border-slate-200 border-t-indigo-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4 text-amber-600" />
          <span>ข้อมูลพัสดุแยกตามสถานะ</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-50 text-amber-700 font-mono">
            {parcels.length} ชิ้น
          </span>
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: สำรอง & กู้คืนแบบทั้งหมด (Full Backup & Restore) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: สำรองข้อมูลทั้งหมด (Export All) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">1. สำรองข้อมูลทั้งหมด (Full System Backup)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  ดาวน์โหลดข้อมูลทั้งหมดของระบบลงในไฟล์ JSON ไฟล์เดียว ประกอบด้วยข้อมูลนักเรียน พัสดุทุกรายการ พร้อมเมตาดาต้าและประวัติครบถ้วน
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>เนื้อหาข้อมูลที่จะถูกรวมในไฟล์สำรอง:</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 pl-6 list-disc">
                  <li>
                    ข้อมูลทะเบียนนักเรียนทั้งหมด: <strong className="font-mono text-slate-900">{students.length}</strong> คน
                  </li>
                  <li>
                    ข้อมูลการลงทะเบียนพัสดุทุกสถานะ: <strong className="font-mono text-slate-900">{parcels.length}</strong> ชิ้น
                  </li>
                  <li>โครงสร้างข้อมูล JSON มาตรฐาน พร้อมนำกลับมากู้คืนได้ 100%</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadFullBackup}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบ (.json)</span>
            </button>
          </div>

          {/* Card B: กู้คืนข้อมูลทั้งหมด (Restore All) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">2. กู้คืนข้อมูลจากไฟล์สำรอง (Full System Restore)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  อัปโหลดไฟล์สำรอง JSON เพื่อกู้คืนข้อมูลนักเรียนและพัสดุกลับสู่ฐานข้อมูล Firebase Firestore
                </p>
              </div>

              {/* File Uploader */}
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  ref={fullFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFullFileChange}
                  className="hidden"
                  id="full-backup-upload"
                />
                <label htmlFor="full-backup-upload" className="cursor-pointer block space-y-2">
                  <FileCode className="w-8 h-8 text-indigo-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    {fullRestoreFile ? fullRestoreFile.name : 'คลิกเพื่อเลือกไฟล์สำรอง (.json)'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {fullRestoreFile
                      ? `ขนาดไฟล์ ${(fullRestoreFile.size / 1024).toFixed(1)} KB`
                      : 'รองรับไฟล์ JSON ที่ดาวน์โหลดจากระบบ'}
                  </div>
                </label>
              </div>

              {/* Error Alert */}
              {fullRestoreError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{fullRestoreError}</span>
                </div>
              )}

              {/* Pre-flight Info */}
              {fullRestoreData && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-3 text-xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ตรวจสอบความถูกต้องของไฟล์สำเร็จ:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">ข้อมูลนักเรียนในไฟล์</span>
                      <strong className="text-emerald-700 font-mono text-sm">
                        {fullRestoreData.students?.length || 0} คน
                      </strong>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">ข้อมูลพัสดุในไฟล์</span>
                      <strong className="text-emerald-700 font-mono text-sm">
                        {fullRestoreData.parcels?.length || 0} ชิ้น
                      </strong>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="pt-2 border-t border-emerald-200 space-y-1.5">
                    <div className="font-bold text-slate-800 text-[11px]">รูปแบบการกู้คืนข้อมูล:</div>
                    <div className="space-y-1 text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fullRestoreMode"
                          checked={fullRestoreMode === 'merge'}
                          onChange={() => setFullRestoreMode('merge')}
                          className="text-indigo-600"
                        />
                        <span className="text-xs font-semibold">เพิ่มและอัปเดตข้อมูล (Merge & Upsert) - ปลอดภัย ไม่ลบข้อมูลเดิม</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-red-700">
                        <input
                          type="radio"
                          name="fullRestoreMode"
                          checked={fullRestoreMode === 'replace'}
                          onChange={() => setFullRestoreMode('replace')}
                          className="text-red-600"
                        />
                        <span className="text-xs font-semibold">ล้างฐานข้อมูลเดิมและเขียนทับทั้งหมด (Clean & Replace)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setRestoreConfirmInput('');
                setIsFullRestoreConfirmOpen(true);
              }}
              disabled={!fullRestoreData || isSyncing}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>เริ่มกระบวนการกู้คืนข้อมูลทั้งระบบ</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: ข้อมูลนักเรียน (Students Dataset) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: ส่งออกข้อมูลนักเรียน */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ส่งออกข้อมูลนักเรียน (Export Students)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  ดาวน์โหลดข้อมูลทะเบียนนักเรียนทั้งหมดจำนวน{' '}
                  <strong className="text-emerald-700 font-mono">{students.length}</strong> คน
                  เพื่อนำไปใช้ในโปรแกรม Excel หรือสำรองเก็บไว้
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800">คอลัมน์ข้อมูลที่ส่งออก:</div>
                <p className="text-slate-600 leading-relaxed">
                  รหัสนักเรียน (5 หลัก), เลขที่, คำนำหน้า, ชื่อ, นามสกุล, ชื่อเล่น, ระดับชั้น, ห้องเรียน, ชื่อหอพัก, ห้องพักหอ, หมายเลขเตียง
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleExportStudentsCsv}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ส่งออกเป็น Excel / CSV (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportStudentsJson}
                className="py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>ส่งออกเป็น JSON (.json)</span>
              </button>
            </div>
          </div>

          {/* Card B: กู้คืน / นำเข้าข้อมูลนักเรียน */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">กู้คืน / นำเข้าข้อมูลนักเรียน (Import Students)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  นำเข้าไฟล์ CSV หรือ JSON ข้อมูลนักเรียนลงสู่ฐานข้อมูล Firestore โดยตรง
                </p>
              </div>

              {/* File Uploader */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  ref={studentFileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleStudentFileChange}
                  className="hidden"
                  id="students-file-upload"
                />
                <label htmlFor="students-file-upload" className="cursor-pointer block space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    {studentRestoreFile ? studentRestoreFile.name : 'คลิกเพื่อเลือกไฟล์นักเรียน (.csv หรือ .json)'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {studentRestoreFile
                      ? `ขนาดไฟล์ ${(studentRestoreFile.size / 1024).toFixed(1)} KB`
                      : 'รองรับไฟล์ CSV ที่มีรหัสนักเรียนและชื่อ หรือไฟล์ JSON'}
                  </div>
                </label>
              </div>

              {studentRestoreError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{studentRestoreError}</span>
                </div>
              )}

              {parsedStudents && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>พบข้อมูลนักเรียนพร้อมนำเข้าจำนวน {parsedStudents.length} คน</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    ระบบจะบันทึกลงฐานข้อมูล Firestore ให้เรียบร้อยโดยอัตโนมัติ
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExecuteStudentsRestore}
              disabled={!parsedStudents || parsedStudents.length === 0 || isSyncing}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>เริ่มบันทึกข้อมูลนักเรียนลง Firestore ({parsedStudents?.length || 0} คน)</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: ข้อมูลพัสดุแยกตามสถานะ (Parcels by Status) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'parcels-by-status' && (
        <div className="space-y-6">
          {/* Status Selection Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>เลือกประเภทตามสถานะของพัสดุสำหรับสำรองและส่งออก</span>
                </h3>
                <p className="text-xs text-slate-500">
                  ท่านสามารถเลือกส่งออกเฉพาะพัสดุสถานะใดสถานะหนึ่ง หรือเลือก 'ทุกสถานะ'
                </p>
              </div>
              <div className="text-xs text-slate-600">
                ตรงกับเงื่อนไข: <strong className="text-indigo-600 font-mono font-bold">{statusFilteredParcels.length}</strong> ชิ้น
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedExportStatus('ALL')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedExportStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>ทุกสถานะ</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-white/20">
                  {parcels.length}
                </span>
              </button>

              {PARCEL_STATUSES.map((st) => {
                const count = parcelStatusCounts.get(st) || 0;
                const isSelected = selectedExportStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedExportStatus(st)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{st}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                        isSelected ? 'bg-white/20' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card A: ส่งออกพัสดุตามสถานะ */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ส่งออกข้อมูลพัสดุ: {selectedExportStatus === 'ALL' ? 'ทุกสถานะ' : selectedExportStatus}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ส่งออกรายการพัสดุจำนวน{' '}
                    <strong className="text-indigo-600 font-mono">{statusFilteredParcels.length}</strong> ชิ้น
                    ในรูปแบบ Excel / CSV หรือ JSON
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="font-bold text-slate-800">คอลัมน์ข้อมูลที่ส่งออก:</div>
                  <p className="text-slate-600 leading-relaxed">
                    หมายเลขพัสดุ (Tracking Number), รหัสนักเรียน, ชื่อ-นามสกุล, หอพัก, ห้อง/เตียง, ประเภทสิ่งของ, บริษัทขนส่ง, วันที่และเวลาที่รับเข้า, วันที่ส่งมอบ, หมายเหตุ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportParcelsCsv}
                  disabled={statusFilteredParcels.length === 0}
                  className="py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ส่งออกเป็น Excel / CSV (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportParcelsJson}
                  disabled={statusFilteredParcels.length === 0}
                  className="py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileCode className="w-4 h-4" />
                  <span>ส่งออกเป็น JSON (.json)</span>
                </button>
              </div>
            </div>

            {/* Card B: กู้คืน / นำเข้าข้อมูลพัสดุ */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">กู้คืน / นำเข้าข้อมูลพัสดุ (Import Parcels)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    นำเข้าประวัติการลงทะเบียนพัสดุจากไฟล์ CSV หรือ JSON ลงสู่ฐานข้อมูล Firestore
                  </p>
                </div>

                {/* File Uploader */}
                <div className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
                  <input
                    ref={parcelFileInputRef}
                    type="file"
                    accept=".csv,.json"
                    onChange={handleParcelFileChange}
                    className="hidden"
                    id="parcels-file-upload"
                  />
                  <label htmlFor="parcels-file-upload" className="cursor-pointer block space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-amber-500 mx-auto" />
                    <div className="text-xs font-bold text-slate-800">
                      {parcelRestoreFile ? parcelRestoreFile.name : 'คลิกเพื่อเลือกไฟล์พัสดุ (.csv หรือ .json)'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {parcelRestoreFile
                        ? `ขนาดไฟล์ ${(parcelRestoreFile.size / 1024).toFixed(1)} KB`
                        : 'รองรับไฟล์ CSV ที่ส่งออกจากระบบ หรือไฟล์ JSON'}
                    </div>
                  </label>
                </div>

                {parcelRestoreError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{parcelRestoreError}</span>
                  </div>
                )}

                {parsedParcels && (
                  <div className="p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-xl space-y-1">
                    <div className="font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <span>พบข้อมูลพัสดุพร้อมนำเข้าจำนวน {parsedParcels.length} รายการ</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      ระบบจะทำการตรวจสอบและนำเข้าข้อมูลพัสดุลง Firestore โดยตรง
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleExecuteParcelRestore}
                disabled={!parsedParcels || parsedParcels.length === 0 || isSyncing}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>เริ่มนำเข้าพัสดุลง Firestore ({parsedParcels?.length || 0} ชิ้น)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: Confirm Full System Restore */}
      {/* --------------------------------------------------------------------- */}
      {isFullRestoreConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl border-2 border-indigo-500">
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">ยืนยันการกู้คืนข้อมูลทั้งระบบ</h3>
                <p className="text-xs text-slate-500">Direct Firestore Batch Restore</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 space-y-2">
                <div className="font-bold text-indigo-950 text-sm">
                  ข้อมูลที่จะถูกเขียนลงฐานข้อมูล Firestore:
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    นักเรียน: <strong className="font-mono text-indigo-900 font-bold">{fullRestoreData?.students?.length || 0}</strong> คน
                  </div>
                  <div>
                    พัสดุ: <strong className="font-mono text-indigo-900 font-bold">{fullRestoreData?.parcels?.length || 0}</strong> รายการ
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 pt-1 border-t border-indigo-200">
                  โหมด:{' '}
                  <strong>
                    {fullRestoreMode === 'replace'
                      ? 'ล้างฐานข้อมูลเดิมและเขียนทับทั้งหมด (Clean & Replace)'
                      : 'เพิ่มและอัปเดตข้อมูล (Merge & Upsert)'}
                  </strong>
                </div>
              </div>

              {fullRestoreMode === 'replace' && (
                <div className="space-y-1.5 pt-2">
                  <label className="font-bold text-red-700">
                    พิมพ์คำว่า <span className="font-mono font-black">RESTORE</span> เพื่อยืนยันการล้างและเขียนทับ:
                  </label>
                  <input
                    type="text"
                    placeholder="พิมพ์ RESTORE ตรงนี้"
                    value={restoreConfirmInput}
                    onChange={(e) => setRestoreConfirmInput(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50 border-2 border-red-300 rounded-xl focus:border-red-600 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFullRestoreConfirmOpen(false);
                  setRestoreConfirmInput('');
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteFullRestore}
                disabled={
                  (fullRestoreMode === 'replace' && restoreConfirmInput.trim().toUpperCase() !== 'RESTORE') ||
                  isSyncing
                }
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันเริ่มกู้คืน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
