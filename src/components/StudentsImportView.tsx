import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Users,
  Search,
  Plus,
  X,
  ClipboardPaste,
  Trash2,
  GraduationCap,
  Building2,
  ArrowUpDown,
  CheckSquare,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  Student,
  getDormitoryTheme,
  WEEKLY_PARCEL_WARNING_LIMIT,
} from '../types/parcel';

type RawStudentRow = Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>;
type StudentViewMode = 'classroom' | 'dormitory';

/**
 * คืนค่าชื่อห้องเรียนมาตรฐาน เช่น "ม.4/1" จากระดับชั้นและห้องของนักเรียน
 */
function getClassroomKey(st: Pick<Student, 'grade' | 'room'>): string {
  const g = (st.grade || '').trim();
  const r = (st.room || '').trim();
  if (g && g !== '-' && r && r !== '-') {
    if (g.includes('/')) return g;
    return `${g}/${r}`;
  }
  if (g && g !== '-') return g;
  if (r && r !== '-') return `ห้อง ${r}`;
  return 'ไม่ระบุชั้น/ห้อง';
}

/**
 * เปรียบเทียบระดับชั้นและห้องเรียนแบบ Natural Sort (จากน้อยไปหามาก เช่น ม.1/1 -> ม.1/2 -> ม.2/1 -> ม.4/10)
 */
function compareClassroomNatural(a: Pick<Student, 'grade' | 'room'>, b: Pick<Student, 'grade' | 'room'>): number {
  const gradeA = (a.grade || '').trim();
  const gradeB = (b.grade || '').trim();
  const gradeCmp = gradeA.localeCompare(gradeB, 'th', { numeric: true });
  if (gradeCmp !== 0) return gradeCmp;

  const roomA = (a.room || '').trim();
  const roomB = (b.room || '').trim();
  const roomCmp = roomA.localeCompare(roomB, 'th', { numeric: true });
  if (roomCmp !== 0) return roomCmp;

  return getClassroomKey(a).localeCompare(getClassroomKey(b), 'th', { numeric: true });
}

/**
 * เปรียบเทียบเลขที่ (seqNo) จากน้อยไปหามาก
 */
function compareSeqNoAsc(a: Student, b: Student): number {
  const seqDiff = (Number(a.seqNo) || 0) - (Number(b.seqNo) || 0);
  if (seqDiff !== 0) return seqDiff;
  return a.studentCode.localeCompare(b.studentCode, 'th', { numeric: true });
}

/**
 * ฟังก์ชันแปลงแถวจากไฟล์ CSV หรือ Excel (รองรับทั้งหัวคอลัมน์ภาษาไทยและภาษาอังกฤษ)
 */
function mapRowToStudent(row: Record<string, unknown>, index: number): RawStudentRow {
  const getVal = (keys: string[], fallback = '-'): string => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    return fallback;
  };

  const seqRaw = getVal(['เลขที่', 'seqNo', 'ลำดับ', 'no'], String(index + 1));
  const studentCode = getVal(['รหัสนักเรียน', 'studentCode', 'รหัส', 'student_id'], '');
  const prefix = getVal(['คำนำหน้า', 'prefix', 'title'], '-');
  const firstName = getVal(['ชื่อ', 'firstName', 'first_name'], '-');
  const lastName = getVal(['นามสกุล', 'lastName', 'last_name'], '-');
  const nickname = getVal(['ชื่อเล่น', 'nickname', 'nick'], '-');
  const grade = getVal(['ระดับชั้น', 'grade', 'ชั้น'], '-');
  const room = getVal(['ห้อง', 'room', 'class_room'], '-');
  const dormitory = getVal(['หอพัก', 'dormitory', 'dorm'], '-');
  const dormRoom = getVal(['ห้องพักหอ', 'dormRoom', 'dorm_room'], '-');
  const bed = getVal(['เตียง', 'bed', 'bed_no'], '-');

  return {
    seqNo: Number(seqRaw) || index + 1,
    studentCode,
    prefix,
    firstName,
    lastName,
    nickname,
    grade,
    room,
    dormitory,
    dormRoom,
    bed,
  };
}

/**
 * ฟังก์ชันแยกข้อความจากการ Copy & Paste (รองรับทั้ง Tab จาก Excel/Sheets, ลูกน้ำ CSV หรือผสมกัน)
 */
function parsePastedStudentText(rawText: string): RawStudentRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const parsedRows: RawStudentRow[] = [];

  lines.forEach((line, idx) => {
    const cells = line
      .split(/\t\s*,\s*|\s*,\s*\t|\t|,/)
      .map((cell) => cell.replace(/^["']|["']$/g, '').trim());

    if (cells.length < 2) return;

    const firstCell = cells[0] || '';
    const secondCell = cells[1] || '';
    if (
      firstCell.includes('เลขที่') ||
      secondCell.includes('รหัสนักเรียน') ||
      secondCell.toLowerCase().includes('studentcode')
    ) {
      return;
    }

    const studentCode = (cells[1] || '').trim();
    if (!studentCode) return;

    parsedRows.push({
      seqNo: Number(cells[0]) || parsedRows.length + 1 || idx + 1,
      studentCode,
      prefix: cells[2] || '-',
      firstName: cells[3] || '-',
      lastName: cells[4] || '-',
      nickname: cells[5] || '-',
      grade: cells[6] || '-',
      room: cells[7] || '-',
      dormitory: cells[8] || '-',
      dormRoom: cells[9] || '-',
      bed: cells[10] || '-',
    });
  });

  return parsedRows;
}

export const StudentsImportView: React.FC = () => {
  const {
    students,
    bulkImportStudents,
    upsertSingleStudent,
    deleteStudent,
    bulkDeleteStudents,
    clearAllStudents,
    getStudentParcelCounts,
    overWeeklyLimitStudents,
    openWeeklyWarningPopup,
    isSyncing,
    syncProgress,
  } = useParcelSystem();

  const [pastedText, setPastedText] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<RawStudentRow[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  // โหมดการดูรายชื่อนักเรียน: 'classroom' (แบบเป็นห้องเรียน) หรือ 'dormitory' (แบบเป็นหอพัก)
  const [viewMode, setViewMode] = useState<StudentViewMode>('classroom');
  const [selectedClassroom, setSelectedClassroom] = useState<string>('ALL');
  const [selectedDormitory, setSelectedDormitory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyOverWeeklyLimit, setOnlyOverWeeklyLimit] = useState<boolean>(false);

  // ระบบติ๊กเลือกและเลือกล้างข้อมูลนักเรียน
  const [selectedStudentCodes, setSelectedStudentCodes] = useState<string[]>([]);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [pendingConfirmDelete, setPendingConfirmDelete] = useState<{
    codes: string[];
    label: string;
  } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingOriginalCode, setEditingOriginalCode] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<RawStudentRow>({
    seqNo: 1,
    studentCode: '',
    prefix: 'นาย',
    firstName: '',
    lastName: '',
    nickname: '',
    grade: '',
    room: '',
    dormitory: '',
    dormRoom: '',
    bed: '',
  });
  const [singleForm, setSingleForm] = useState<RawStudentRow>({
    seqNo: 1,
    studentCode: '',
    prefix: 'นาย',
    firstName: '',
    lastName: '',
    nickname: '',
    grade: '',
    room: '',
    dormitory: '',
    dormRoom: '',
    bed: '',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // รายชื่อห้องเรียนทั้งหมดที่มีอยู่ในระบบ เรียงจากระดับชั้น/ห้อง น้อยไปหามาก พร้อมจำนวนนักเรียน
  const classroomOptions = useMemo(() => {
    const map = new Map<string, { key: string; sample: Pick<Student, 'grade' | 'room'>; count: number }>();
    for (const s of students) {
      const key = getClassroomKey(s);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, sample: { grade: s.grade, room: s.room }, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => compareClassroomNatural(a.sample, b.sample));
  }, [students]);

  // รายชื่อหอพักทั้งหมดของนักเรียน เรียงจากน้อยไปมาก พร้อมจำนวนนักเรียน
  const dormitoryOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      const d = (s.dormitory || '').trim() || 'ไม่ระบุหอพัก';
      map.set(d, (map.get(d) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }));
  }, [students]);

  // รีเซ็ตตัวกรองหากห้องเรียนหรือหอพักที่เลือกถูกลบออกไปแล้ว
  useEffect(() => {
    if (
      selectedClassroom !== 'ALL' &&
      !classroomOptions.some((c) => c.key === selectedClassroom)
    ) {
      setSelectedClassroom('ALL');
    }
  }, [classroomOptions, selectedClassroom]);

  useEffect(() => {
    if (
      selectedDormitory !== 'ALL' &&
      !dormitoryOptions.some((d) => d.name === selectedDormitory)
    ) {
      setSelectedDormitory('ALL');
    }
  }, [dormitoryOptions, selectedDormitory]);

  // กรองและเรียงลำดับรายชื่อนักเรียนตามโหมดที่เลือก:
  // 1. โหมดห้องเรียน ('classroom'): เรียงตามห้องเรียน และเรียงจาก เลขที่ (seqNo) น้อยไปหามาก
  // 2. โหมดหอพัก ('dormitory'): เรียงตามหอพัก แล้วเรียงจาก ระดับชั้น/ห้อง และ เลขที่ (seqNo) น้อยไปหามาก
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = students.filter((s) => {
      if (onlyOverWeeklyLimit) {
        const stStats = getStudentParcelCounts(s.studentCode, undefined, s);
        if (!stStats.isOverWeeklyLimit) return false;
      }
      if (viewMode === 'classroom' && selectedClassroom !== 'ALL') {
        if (getClassroomKey(s) !== selectedClassroom) return false;
      }
      if (viewMode === 'dormitory' && selectedDormitory !== 'ALL') {
        const dName = (s.dormitory || '').trim() || 'ไม่ระบุหอพัก';
        if (dName !== selectedDormitory) return false;
      }
      if (viewMode === 'classroom' && selectedDormitory !== 'ALL') {
        const dName = (s.dormitory || '').trim() || 'ไม่ระบุหอพัก';
        if (dName !== selectedDormitory) return false;
      }
      if (viewMode === 'dormitory' && selectedClassroom !== 'ALL') {
        if (getClassroomKey(s) !== selectedClassroom) return false;
      }
      if (!q) return true;
      return (
        s.studentCode.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.nickname.toLowerCase().includes(q) ||
        getClassroomKey(s).toLowerCase().includes(q) ||
        s.dormitory.toLowerCase().includes(q) ||
        s.dormRoom.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (viewMode === 'classroom') {
        // หากดูทุกห้องเรียน ให้เรียงห้องเรียนจากน้อยไปมากก่อน แล้วภายในห้องเรียงจาก เลขที่ น้อยไปหามาก
        if (selectedClassroom === 'ALL') {
          const classCmp = compareClassroomNatural(a, b);
          if (classCmp !== 0) return classCmp;
        }
        return compareSeqNoAsc(a, b);
      } else {
        // โหมดดูรายชื่อเป็นหอพัก: เรียงตามหอพัก (กรณีดูทุกหอ) แล้วเรียงจาก ระดับชั้น/ห้อง -> เลขที่ จากน้อยไปหามาก
        if (selectedDormitory === 'ALL') {
          const dormA = (a.dormitory || '').trim() || 'ไม่ระบุหอพัก';
          const dormB = (b.dormitory || '').trim() || 'ไม่ระบุหอพัก';
          const dormCmp = dormA.localeCompare(dormB, 'th', { numeric: true });
          if (dormCmp !== 0) return dormCmp;
        }
        const classCmp = compareClassroomNatural(a, b);
        if (classCmp !== 0) return classCmp;
        return compareSeqNoAsc(a, b);
      }
    });
  }, [
    students,
    viewMode,
    selectedClassroom,
    selectedDormitory,
    searchQuery,
    onlyOverWeeklyLimit,
    getStudentParcelCounts,
  ]);

  // จัดกลุ่มรายชื่อนักเรียนตามโหมดที่เลือก (แยกเป็นกลุ่มห้องเรียน หรือแยกเป็นกลุ่มหอพัก)
  const groupedStudentSections = useMemo(() => {
    const groups = new Map<
      string,
      { groupKey: string; groupTitle: string; subtitle: string; items: Student[] }
    >();

    for (const st of filteredStudents) {
      if (viewMode === 'classroom') {
        const cKey = getClassroomKey(st);
        const existing = groups.get(cKey);
        if (existing) {
          existing.items.push(st);
        } else {
          groups.set(cKey, {
            groupKey: cKey,
            groupTitle: `ห้องเรียน ${cKey}`,
            subtitle: 'เรียงลำดับจาก เลขที่ น้อยไปหามาก',
            items: [st],
          });
        }
      } else {
        const dKey = (st.dormitory || '').trim() || 'ไม่ระบุหอพัก';
        const existing = groups.get(dKey);
        if (existing) {
          existing.items.push(st);
        } else {
          groups.set(dKey, {
            groupKey: dKey,
            groupTitle: dKey,
            subtitle: 'เรียงลำดับจาก ระดับชั้น/ห้อง และ เลขที่ น้อยไปหามาก',
            items: [st],
          });
        }
      }
    }

    return Array.from(groups.values());
  }, [filteredStudents, viewMode]);

  // ล้างรายการที่ติ๊กไว้หากไม่อยู่ในระบบแล้ว
  useEffect(() => {
    const validSet = new Set(students.map((s) => s.studentCode));
    setSelectedStudentCodes((prev) => prev.filter((code) => validSet.has(code)));
  }, [students]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    const selectedSet = new Set(selectedStudentCodes);
    return filteredStudents.every((s) => selectedSet.has(s.studentCode));
  }, [filteredStudents, selectedStudentCodes]);

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredStudents.map((s) => s.studentCode));
      setSelectedStudentCodes((prev) => prev.filter((code) => !filteredSet.has(code)));
    } else {
      const merged = new Set([
        ...selectedStudentCodes,
        ...filteredStudents.map((s) => s.studentCode),
      ]);
      setSelectedStudentCodes(Array.from(merged));
    }
  };

  const handleToggleSelectOne = (studentCode: string) => {
    setSelectedStudentCodes((prev) =>
      prev.includes(studentCode)
        ? prev.filter((c) => c !== studentCode)
        : [...prev, studentCode]
    );
  };

  const requestSelectiveDelete = (codes: string[], label: string) => {
    if (codes.length === 0) return;
    setPendingConfirmDelete({ codes, label });
    setIsClearModalOpen(true);
  };

  const handleConfirmSelectiveDelete = async () => {
    if (!pendingConfirmDelete) return;
    const { codes, label } = pendingConfirmDelete;
    setPendingConfirmDelete(null);
    setIsClearModalOpen(false);
    setSelectedStudentCodes((prev) => prev.filter((c) => !codes.includes(c)));
    if (codes.length === students.length) {
      await clearAllStudents();
    } else {
      await bulkDeleteStudents(codes, label);
    }
  };

  // จัดการเมื่อผู้ใช้พิมพ์หรือวางข้อมูลในช่อง Copy & Paste
  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    setParseError(null);

    if (!text.trim()) {
      setPreviewRows([]);
      setSourceLabel('');
      return;
    }

    const rows = parsePastedStudentText(text);
    if (rows.length === 0) {
      setPreviewRows([]);
      setParseError(
        'ยังไม่พบแถวข้อมูลนักเรียนที่ถูกต้อง กรุณาตรวจสอบว่ามีคอลัมน์ เลขที่ และ รหัสนักเรียน คั่นด้วย Tab หรือเครื่องหมายจุลภาค (,)'
      );
    } else {
      setPreviewRows(rows);
      setSourceLabel(`ข้อมูลจากการ Copy & Paste (${rows.length} รายการ)`);
    }
  };

  // อ่านไฟล์ CSV ด้วย PapaParse หรือ Excel (.xlsx/.xls) ด้วย SheetJS
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setSourceLabel(`ไฟล์: ${file.name}`);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            setParseError('ไม่พบข้อมูลในไฟล์ CSV กรุณาตรวจสอบหัวตาราง');
            return;
          }
          const mapped = results.data
            .map((r, i) => mapRowToStudent(r, i))
            .filter((r) => r.studentCode !== '');
          setPreviewRows(mapped);
        },
        error: (err) => {
          setParseError(`เกิดข้อผิดพลาดในการอ่าน CSV: ${err.message}`);
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
          if (jsonRows.length === 0) {
            setParseError('ไม่พบข้อมูลในแผ่นงาน Excel');
            return;
          }
          const mapped = jsonRows
            .map((r, i) => mapRowToStudent(r, i))
            .filter((r) => r.studentCode !== '');
          setPreviewRows(mapped);
        } catch (err) {
          setParseError(
            `ไม่สามารถอ่านไฟล์ Excel ได้: ${err instanceof Error ? err.message : 'Error'}`
          );
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setParseError('กรุณาอัปโหลดไฟล์นามสกุล .csv, .xlsx หรือ .xls เท่านั้น');
    }
  };

  // ดาวน์โหลดไฟล์โครงสร้างหัวตาราง CSV เปล่า
  const handleDownloadHeaderTemplateCsv = () => {
    const headers = [
      'เลขที่',
      'รหัสนักเรียน',
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
    const csvContent = '\uFEFF' + headers.join(',') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_header_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmBulkImport = async (syncCloudImmediately: boolean) => {
    if (previewRows.length === 0) return;
    await bulkImportStudents(previewRows, syncCloudImmediately);
    setPreviewRows([]);
    setPastedText('');
    setSourceLabel('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenEditStudentModal = (st: Student) => {
    setEditingOriginalCode(st.studentCode);
    setSingleForm({
      seqNo: Number(st.seqNo) || 1,
      studentCode: st.studentCode,
      prefix: st.prefix && st.prefix !== '-' ? st.prefix : 'นาย',
      firstName: st.firstName && st.firstName !== '-' ? st.firstName : '',
      lastName: st.lastName && st.lastName !== '-' ? st.lastName : '',
      nickname: st.nickname && st.nickname !== '-' ? st.nickname : '',
      grade: st.grade && st.grade !== '-' ? st.grade : '',
      room: st.room && st.room !== '-' ? st.room : '',
      dormitory: st.dormitory && st.dormitory !== '-' ? st.dormitory : '',
      dormRoom: st.dormRoom && st.dormRoom !== '-' ? st.dormRoom : '',
      bed: st.bed && st.bed !== '-' ? st.bed : '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenAddModalWithPreset = (presetGrade = '', presetRoom = '', presetDorm = '') => {
    const matchingClassStudents = students.filter(
      (s) =>
        (!presetGrade || s.grade === presetGrade) &&
        (!presetRoom || s.room === presetRoom)
    );
    const maxSeq = matchingClassStudents.reduce(
      (max, s) => Math.max(max, Number(s.seqNo) || 0),
      0
    );
    setEditingOriginalCode(null);
    setSingleForm({
      seqNo: maxSeq + 1,
      studentCode: '',
      prefix: 'นาย',
      firstName: '',
      lastName: '',
      nickname: '',
      grade: presetGrade,
      room: presetRoom,
      dormitory: presetDorm,
      dormRoom: '',
      bed: '',
    });
    setIsAddModalOpen(true);
  };

  const handleInlineAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineForm.studentCode.trim() || !inlineForm.firstName.trim()) return;
    await upsertSingleStudent({
      ...inlineForm,
      studentCode: inlineForm.studentCode.trim(),
      prefix: inlineForm.prefix.trim() || 'นาย',
      firstName: inlineForm.firstName.trim(),
      lastName: inlineForm.lastName.trim() || '-',
      nickname: inlineForm.nickname.trim() || '-',
      grade: inlineForm.grade.trim() || '-',
      room: inlineForm.room.trim() || '-',
      dormitory: inlineForm.dormitory.trim() || '-',
      dormRoom: inlineForm.dormRoom.trim() || '-',
      bed: inlineForm.bed.trim() || '-',
    });
    // คงค่าระดับชั้น ห้อง และหอพักไว้ เพื่อให้กรอกนักเรียนคนถัดไปในห้อง/หอพักเดียวกันได้ต่อเนื่องทันที
    setInlineForm((prev) => ({
      ...prev,
      seqNo: (Number(prev.seqNo) || 1) + 1,
      studentCode: '',
      firstName: '',
      lastName: '',
      nickname: '',
      bed: '',
    }));
  };

  const handleAddSingleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleForm.studentCode.trim() || !singleForm.firstName.trim()) return;
    const newCode = singleForm.studentCode.trim();
    if (editingOriginalCode && editingOriginalCode !== newCode) {
      await deleteStudent(editingOriginalCode);
    }
    await upsertSingleStudent({
      ...singleForm,
      studentCode: newCode,
      prefix: singleForm.prefix.trim() || 'นาย',
      firstName: singleForm.firstName.trim(),
      lastName: singleForm.lastName.trim() || '-',
      nickname: singleForm.nickname.trim() || '-',
      grade: singleForm.grade.trim() || '-',
      room: singleForm.room.trim() || '-',
      dormitory: singleForm.dormitory.trim() || '-',
      dormRoom: singleForm.dormRoom.trim() || '-',
      bed: singleForm.bed.trim() || '-',
    });
    setIsAddModalOpen(false);
    setEditingOriginalCode(null);
    setSingleForm({
      seqNo: students.length + 2,
      studentCode: '',
      prefix: 'นาย',
      firstName: '',
      lastName: '',
      nickname: '',
      grade: '',
      room: '',
      dormitory: '',
      dormRoom: '',
      bed: '',
    });
  };

  return (
    <div className="space-y-8">
      {/* ส่วนหัวหน้าจัดการข้อมูลนักเรียน */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            รองรับการดูรายชื่อแยกตามห้องเรียน · แยกตามหอพัก · เลือกล้างข้อมูลเฉพาะส่วนได้ · ซิงก์ Firebase อัตโนมัติ
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            ระบบจัดการและนำเข้าข้อมูลนักเรียน (Student Data Management)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadHeaderTemplateCsv}
            className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-700" />
            <span>ดาวน์โหลดเฉพาะหัวตาราง CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingOriginalCode(null);
              setSingleForm({
                seqNo: students.length + 1,
                studentCode: '',
                prefix: 'นาย',
                firstName: '',
                lastName: '',
                nickname: '',
                grade: '',
                room: '',
                dormitory: '',
                dormRoom: '',
                bed: '',
              });
              setIsAddModalOpen(true);
            }}
            className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มนักเรียนรายบุคคล</span>
          </button>
        </div>
      </div>

      {/* วิธีที่ 1: เพิ่มรายชื่อนักเรียนแบบรายบุคคล (กรอกบนหน้าเว็บได้ทันที + ซิงก์ Firebase อัตโนมัติ) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-700" />
              <span>1. เพิ่มรายชื่อนักเรียนแบบรายบุคคล (กรอกข้อมูลและบันทึกขึ้น Firebase ทันที)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              กรอกข้อมูลนักเรียนรายคนด้านล่าง แล้วกดปุ่ม <strong className="text-slate-900">"+ บันทึกเพิ่มรายชื่อนักเรียน"</strong> ระบบจะคงค่าระดับชั้น ห้อง และหอพักไว้ให้เพื่อกรอกคนถัดไปได้อย่างรวดเร็ว
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setInlineForm({
                seqNo: students.length + 1,
                studentCode: '',
                prefix: 'นาย',
                firstName: '',
                lastName: '',
                nickname: '',
                grade: '',
                room: '',
                dormitory: '',
                dormRoom: '',
                bed: '',
              })
            }
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg self-start sm:self-auto cursor-pointer"
          >
            ล้างฟอร์มกรอกรายบุคคล
          </button>
        </div>

        <form onSubmit={handleInlineAddStudentSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                เลขที่ <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={inlineForm.seqNo}
                onChange={(e) => setInlineForm({ ...inlineForm, seqNo: Number(e.target.value) })}
                placeholder="เช่น 1"
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                รหัสนักเรียน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inlineForm.studentCode}
                onChange={(e) => setInlineForm({ ...inlineForm, studentCode: e.target.value })}
                placeholder="เช่น 66101"
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">คำนำหน้า</label>
              <select
                value={inlineForm.prefix}
                onChange={(e) => setInlineForm({ ...inlineForm, prefix: e.target.value })}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-semibold focus:outline-none cursor-pointer"
              >
                <option value="นาย">นาย</option>
                <option value="นางสาว">นางสาว</option>
                <option value="ด.ช.">ด.ช.</option>
                <option value="ด.ญ.">ด.ญ.</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                ชื่อจริง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inlineForm.firstName}
                onChange={(e) => setInlineForm({ ...inlineForm, firstName: e.target.value })}
                placeholder="กรอกชื่อจริง..."
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">นามสกุล</label>
              <input
                type="text"
                value={inlineForm.lastName}
                onChange={(e) => setInlineForm({ ...inlineForm, lastName: e.target.value })}
                placeholder="กรอกนามสกุล..."
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ชื่อเล่น</label>
              <input
                type="text"
                value={inlineForm.nickname}
                onChange={(e) => setInlineForm({ ...inlineForm, nickname: e.target.value })}
                placeholder="ชื่อเล่น..."
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ระดับชั้น</label>
              <input
                type="text"
                list="grade-options-list"
                value={inlineForm.grade}
                onChange={(e) => setInlineForm({ ...inlineForm, grade: e.target.value })}
                placeholder="เช่น ม.4"
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-semibold focus:outline-none"
              />
              <datalist id="grade-options-list">
                <option value="ม.1" />
                <option value="ม.2" />
                <option value="ม.3" />
                <option value="ม.4" />
                <option value="ม.5" />
                <option value="ม.6" />
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ห้องเรียน</label>
              <input
                type="text"
                value={inlineForm.room}
                onChange={(e) => setInlineForm({ ...inlineForm, room: e.target.value })}
                placeholder="เช่น 1, 2..."
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-mono font-bold focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">หอพัก</label>
              <input
                type="text"
                list="dormitory-options-list"
                value={inlineForm.dormitory}
                onChange={(e) => setInlineForm({ ...inlineForm, dormitory: e.target.value })}
                placeholder="ระบุชื่อหอพัก..."
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-semibold focus:outline-none"
              />
              <datalist id="dormitory-options-list">
                {dormitoryOptions.map((d) => (
                  <option key={d.name} value={d.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">ห้องพักหอ</label>
              <input
                type="text"
                value={inlineForm.dormRoom}
                onChange={(e) => setInlineForm({ ...inlineForm, dormRoom: e.target.value })}
                placeholder="เช่น 201"
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">เตียง</label>
              <input
                type="text"
                value={inlineForm.bed}
                onChange={(e) => setInlineForm({ ...inlineForm, bed: e.target.value })}
                placeholder="เช่น A1"
                className="w-full min-h-[42px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-300 focus:border-slate-900 rounded-xl font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกเพิ่มรายชื่อนักเรียน (ซิงก์ Firebase ทันที)</span>
            </button>
          </div>
        </form>
      </section>

      {/* วิธีที่ 2: นำเข้าข้อมูลนักเรียนจำนวนมากด้วยการ Copy & Paste หรือ CSV/Excel */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-slate-900" />
              <span>2. นำเข้าข้อมูลนักเรียนแบบกลุ่มด้วยการ Copy & Paste หรือไฟล์ CSV / Excel</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              ลำดับคอลัมน์ที่รองรับ:{' '}
              <strong className="text-slate-900 font-mono">
                เลขที่ , รหัสนักเรียน , คำนำหน้า , ชื่อ , นามสกุล , ชื่อเล่น , ระดับชั้น , ห้อง , หอพัก , ห้องพักหอ , เตียง
              </strong>
            </p>
          </div>
          {pastedText && (
            <button
              type="button"
              onClick={() => {
                setPastedText('');
                setPreviewRows([]);
                setParseError(null);
              }}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg self-start md:self-auto cursor-pointer"
            >
              ล้างช่องวางข้อมูล
            </button>
          )}
        </div>

        <div>
          <label htmlFor="paste-students-textarea" className="sr-only">
            วางข้อมูลนักเรียนที่คัดลอกมาที่นี่
          </label>
          <textarea
            id="paste-students-textarea"
            rows={5}
            value={pastedText}
            onChange={(e) => handlePastedTextChange(e.target.value)}
            placeholder={
              'คัดลอกข้อมูลจากตาราง Excel / Google Sheets หรือข้อความ CSV แล้วกดวาง (Ctrl+V) ที่นี่...\nรูปแบบคอลัมน์: เลขที่\t,รหัสนักเรียน,\tคำนำหน้า,\tชื่อ,\tนามสกุล,\tชื่อเล่น,\tระดับชั้น,\tห้อง\t,หอพัก\t,ห้องพักหอ,\tเตียง'
            }
            className="w-full p-4 text-xs md:text-sm font-mono text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none leading-relaxed"
          />
        </div>

        {/* วิธีที่ 2: หรือเลือกอัปโหลดเป็นไฟล์ CSV / Excel */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>หรืออัปโหลดเป็นไฟล์เอกสารจากคอมพิวเตอร์ (.CSV, .XLSX, .XLS):</span>
          </div>

          <label className="min-h-[42px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0">
            <Upload className="w-4 h-4" />
            <span>เลือกไฟล์ CSV / Excel</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
        </div>

        {parseError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800">
            {parseError}
          </div>
        )}

        {isSyncing && syncProgress && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900">
              <span>กำลังซิงก์ข้อมูลนักเรียนกับ Firebase Firestore...</span>
              <span className="font-mono tabular-nums">
                {syncProgress.completed} / {syncProgress.total} รายการ
              </span>
            </div>
            <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-transform"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((syncProgress.completed / Math.max(1, syncProgress.total)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ตารางพรีวิวข้อมูลก่อนยืนยันการนำเข้า */}
        {previewRows.length > 0 && (
          <div className="border border-emerald-300 bg-emerald-50/40 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ตรวจสอบข้อมูลก่อนนำเข้า: {sourceLabel} (พร้อมนำเข้า {previewRows.length} รายการ)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  กดปุ่มยืนยันด้านขวาเพื่อบันทึกลงตัวโปรแกรมและซิงก์ขึ้น Firebase Firestore ทันที
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmBulkImport(true)}
                  className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันนำเข้าและซิงก์ขึ้น Firebase ทันที ({previewRows.length} คน)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRows([]);
                    setPastedText('');
                  }}
                  className="min-h-[44px] px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">เลขที่</th>
                    <th className="py-2.5 px-3">รหัสนักเรียน</th>
                    <th className="py-2.5 px-3">คำนำหน้า</th>
                    <th className="py-2.5 px-3">ชื่อ</th>
                    <th className="py-2.5 px-3">นามสกุล</th>
                    <th className="py-2.5 px-3">ชื่อเล่น</th>
                    <th className="py-2.5 px-3">ระดับชั้น</th>
                    <th className="py-2.5 px-3">ห้อง</th>
                    <th className="py-2.5 px-3">หอพัก</th>
                    <th className="py-2.5 px-3">ห้องพักหอ</th>
                    <th className="py-2.5 px-3">เตียง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewRows.map((row, idx) => (
                    <tr key={`${row.studentCode}_${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono tabular-nums">{row.seqNo}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                        {row.studentCode}
                      </td>
                      <td className="py-2 px-3">{row.prefix}</td>
                      <td className="py-2 px-3 font-semibold">{row.firstName}</td>
                      <td className="py-2 px-3 font-semibold">{row.lastName}</td>
                      <td className="py-2 px-3">{row.nickname}</td>
                      <td className="py-2 px-3">{row.grade}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">{row.room}</td>
                      <td className="py-2 px-3">{row.dormitory}</td>
                      <td className="py-2 px-3 font-mono font-bold tabular-nums">{row.dormRoom}</td>
                      <td className="py-2 px-3 font-mono font-bold tabular-nums">{row.bed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ส่วนที่ 2: ทะเบียนนักเรียน (เลือกดูแบบห้องเรียน / แบบหอพัก + เลือกล้างข้อมูลได้) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        {/* แถบบน: ชื่อหัวข้อ + ปุ่มสลับมุมมอง (ดูแบบห้องเรียน vs ดูแบบหอพัก) + ปุ่มเลือกล้างข้อมูล */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-800" />
              <h2 className="text-lg font-bold text-slate-900">
                3. ทะเบียนรายชื่อนักเรียน ({filteredStudents.length} จากทั้งหมด {students.length} คน)
              </h2>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {viewMode === 'classroom'
                  ? 'โหมดดูแบบห้องเรียน: เรียงลำดับจาก เลขที่ (น้อยไปหามาก)'
                  : 'โหมดดูแบบหอพัก: เรียงลำดับจาก ระดับชั้น/ห้อง และ เลขที่ (น้อยไปหามาก)'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* ปุ่มสลับรูปแบบการดูรายชื่อ */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setViewMode('classroom');
                  setSelectedDormitory('ALL');
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'classroom'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>ดูรายชื่อแบบเป็นห้องเรียน</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('dormitory');
                  setSelectedClassroom('ALL');
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'dormitory'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>ดูรายชื่อเป็นหอพัก</span>
              </button>
            </div>

            {students.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPendingConfirmDelete(null);
                  setIsClearModalOpen(true);
                }}
                className="min-h-[40px] px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>เลือกล้างข้อมูลนักเรียน...</span>
              </button>
            )}
          </div>
        </div>

        {/* แถบเลือกห้องเรียน หรือ เลือกหอพัก + ช่องค้นหา + ปุ่มจัดการรายการที่เลือก */}
        {students.length > 0 && (
          <div className="space-y-4">
            {/* ตัวเลือกตามโหมดที่เปิดอยู่ (Select Box สำหรับเลือกห้องเรียน) */}
            {viewMode === 'classroom' ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    <label
                      htmlFor="classroom-select-box"
                      className="text-xs font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <GraduationCap className="w-4 h-4 text-slate-700 shrink-0" />
                      <span>เลือกห้องเรียนที่ต้องการดูรายชื่อ (เรียงจากเลขที่ น้อยไปหามาก):</span>
                    </label>

                    <select
                      id="classroom-select-box"
                      value={selectedClassroom}
                      onChange={(e) => setSelectedClassroom(e.target.value)}
                      className="min-h-[42px] min-w-[240px] px-3.5 py-2 text-xs font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">ทุกห้องเรียน ({students.length} คน)</option>
                      {classroomOptions.map((c) => (
                        <option key={c.key} value={c.key}>
                          ห้องเรียน {c.key} ({c.count} คน)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClassroom !== 'ALL') {
                          const sample = students.find(
                            (s) => getClassroomKey(s) === selectedClassroom
                          );
                          handleOpenAddModalWithPreset(
                            sample && sample.grade !== '-' ? sample.grade : '',
                            sample && sample.room !== '-' ? sample.room : '',
                            ''
                          );
                        } else {
                          handleOpenAddModalWithPreset();
                        }
                      }}
                      className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {selectedClassroom !== 'ALL'
                          ? `เพิ่มนักเรียนรายบุคคล (ห้อง ${selectedClassroom})`
                          : 'เพิ่มนักเรียนรายบุคคล'}
                      </span>
                    </button>

                    {selectedClassroom !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() =>
                          requestSelectiveDelete(
                            students
                              .filter((s) => getClassroomKey(s) === selectedClassroom)
                              .map((s) => s.studentCode),
                            `ห้องเรียน ${selectedClassroom}`
                          )
                        }
                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างข้อมูลห้อง {selectedClassroom}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>เลือกหอพักที่ต้องการดูรายชื่อ (เรียงจากระดับชั้น/ห้อง และเลขที่ น้อยไปหามาก):</span>
                  </span>
                  {selectedDormitory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() =>
                        requestSelectiveDelete(
                          students
                            .filter(
                              (s) =>
                                ((s.dormitory || '').trim() || 'ไม่ระบุหอพัก') ===
                                selectedDormitory
                            )
                            .map((s) => s.studentCode),
                          `หอพัก ${selectedDormitory}`
                        )
                      }
                      className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ล้างข้อมูลหอพัก {selectedDormitory}</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDormitory('ALL')}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      selectedDormitory === 'ALL'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ทุกหอพัก ({students.length} คน)
                  </button>
                  {dormitoryOptions.map((d) => {
                    const theme = getDormitoryTheme(d.name);
                    const isSelected = selectedDormitory === d.name;
                    return (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => setSelectedDormitory(d.name)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: theme.hexColor }}
                        />
                        <span>{d.name}</span>
                        <span className="font-mono opacity-85">({d.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* แถบค้นหา + ตัวกรองเสริม + ปุ่มลบรายการที่ติ๊กเลือก */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="ค้นหาชื่อหรือรหัสนักเรียน"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหารหัส ชื่อ ชื่อเล่น ชั้น/ห้อง หรือห้องพัก..."
                    className="w-full min-h-[42px] pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* ตัวกรองข้ามมิติ (เช่น ดูโหมดหอพักแต่กรองเฉพาะชั้น/ห้อง หรือดูโหมดห้องเรียนแต่กรองเฉพาะหอพัก) */}
                {viewMode === 'classroom' ? (
                  <select
                    aria-label="กรองเพิ่มเติมตามหอพัก"
                    value={selectedDormitory}
                    onChange={(e) => setSelectedDormitory(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="ALL">ทุกหอพัก</option>
                    {dormitoryOptions.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.count} คน)
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    aria-label="กรองเพิ่มเติมตามห้องเรียน"
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="ALL">ทุกระดับชั้น/ห้องเรียน</option>
                    {classroomOptions.map((c) => (
                      <option key={c.key} value={c.key}>
                        ชั้น {c.key} ({c.count} คน)
                      </option>
                    ))}
                  </select>
                )}

                {/* ปุ่มกรองเฉพาะนักเรียนที่รับพัสดุเกิน 3 ชิ้น/สัปดาห์ */}
                <button
                  type="button"
                  onClick={() => setOnlyOverWeeklyLimit((prev) => !prev)}
                  className={`min-h-[42px] px-3.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    onlyOverWeeklyLimit
                      ? 'bg-red-600 text-white border-red-600'
                      : overWeeklyLimitStudents.length > 0
                      ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    พัสดุเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์ ({overWeeklyLimitStudents.length} คน)
                  </span>
                </button>
              </div>

              {/* แถบจัดการรายการที่ติ๊กเลือก */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAllFiltered}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-slate-700" />
                  <span>
                    {isAllFilteredSelected
                      ? 'ยกเลิกเลือกทั้งหมดในหน้านี้'
                      : `เลือกทั้งหมดที่แสดง (${filteredStudents.length})`}
                  </span>
                </button>

                {selectedStudentCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      requestSelectiveDelete(
                        selectedStudentCodes,
                        `รายการที่เลือก ${selectedStudentCodes.length} คน`
                      )
                    }
                    className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ล้างข้อมูลที่ติ๊กเลือก ({selectedStudentCodes.length} คน)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ตารางแสดงข้อมูลนักเรียน แยกตามกลุ่มห้องเรียน หรือ กลุ่มหอพัก */}
        {students.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-bold text-slate-800">ยังไม่มีข้อมูลนักเรียนในระบบ</p>
            <p className="text-xs text-slate-500">
              สามารถกรอกเพิ่มรายชื่อนักเรียนแบบรายบุคคลที่ส่วนที่ 1 ด้านบน หรือกดปุ่มด้านล่าง หรือนำเข้าแบบกลุ่มด้วย Copy & Paste / CSV / Excel
            </p>
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={() => handleOpenAddModalWithPreset()}
                className="min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรายชื่อนักเรียนรายบุคคล</span>
              </button>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-bold text-slate-800">
              ไม่พบรายชื่อนักเรียนที่ตรงกับตัวกรอง
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedClassroom('ALL');
                setSelectedDormitory('ALL');
                setOnlyOverWeeklyLimit(false);
              }}
              className="min-h-[38px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              แสดงรายชื่อทั้งหมด
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedStudentSections.map((group) => {
              const groupTheme =
                viewMode === 'dormitory' ? getDormitoryTheme(group.groupKey) : null;
              const groupCodes = group.items.map((item) => item.studentCode);

              return (
                <div
                  key={group.groupKey}
                  className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
                >
                  {/* หัวกลุ่มของแต่ละห้องเรียน หรือ แต่ละหอพัก พร้อมปุ่มล้างเฉพาะกลุ่มนั้น */}
                  <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {viewMode === 'dormitory' && groupTheme ? (
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: groupTheme.hexColor }}
                        />
                      ) : (
                        <GraduationCap className="w-4 h-4 text-slate-800 shrink-0" />
                      )}
                      <span className="text-sm font-extrabold text-slate-900">
                        {group.groupTitle}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-900 text-white rounded-md tabular-nums">
                        {group.items.length} คน
                      </span>
                      <span className="text-xs text-slate-500">
                        · {group.subtitle}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sample = group.items[0];
                          if (viewMode === 'classroom' && sample) {
                            handleOpenAddModalWithPreset(
                              sample.grade !== '-' ? sample.grade : '',
                              sample.room !== '-' ? sample.room : '',
                              ''
                            );
                          } else if (viewMode === 'dormitory' && sample) {
                            handleOpenAddModalWithPreset(
                              '',
                              '',
                              sample.dormitory !== '-' ? sample.dormitory : ''
                            );
                          } else {
                            handleOpenAddModalWithPreset();
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มนักเรียนเข้า{group.groupTitle}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          requestSelectiveDelete(groupCodes, group.groupTitle)
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          ล้างข้อมูล{group.groupTitle} ({group.items.length} คน)
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-3 px-3 w-10 text-center">เลือก</th>
                          <th className="py-3 px-3">ระดับชั้น/ห้อง</th>
                          <th className="py-3 px-3">เลขที่</th>
                          <th className="py-3 px-3">รหัสนักเรียน</th>
                          <th className="py-3 px-3">คำนำหน้า</th>
                          <th className="py-3 px-3">ชื่อ</th>
                          <th className="py-3 px-3">นามสกุล</th>
                          <th className="py-3 px-3">ชื่อเล่น</th>
                          <th className="py-3 px-3">หอพัก</th>
                          <th className="py-3 px-3 text-right">ห้องพักหอ</th>
                          <th className="py-3 px-3 text-right">เตียง</th>
                          <th className="py-3 px-3 text-center">จำนวนพัสดุ (วัน / สัปดาห์ / เดือน)</th>
                          <th className="py-3 px-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {group.items.map((st) => {
                          const theme = getDormitoryTheme(st.dormitory);
                          const isChecked = selectedStudentCodes.includes(st.studentCode);
                          const classLabel = getClassroomKey(st);
                          const parcelStats = getStudentParcelCounts(st.studentCode, undefined, st);

                          return (
                            <tr
                              key={st.studentCode}
                              className={`transition-colors ${
                                parcelStats.isOverWeeklyLimit
                                  ? 'bg-red-50/70 hover:bg-red-50'
                                  : isChecked
                                  ? 'bg-amber-50/70'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`เลือกนักเรียนรหัส ${st.studentCode}`}
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectOne(st.studentCode)}
                                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                                {classLabel}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900 tabular-nums">
                                {st.seqNo}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                                {st.studentCode}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{st.prefix}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {st.firstName}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {st.lastName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{st.nickname}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-sm shrink-0"
                                    style={{ backgroundColor: theme.hexColor }}
                                  />
                                  <span className="font-semibold text-slate-900">
                                    {st.dormitory}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                {st.dormRoom}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                {st.bed}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <div className="font-mono text-xs tabular-nums text-slate-800">
                                    <span>วัน </span>
                                    <strong className="text-slate-900">{parcelStats.dayCount}</strong>
                                    <span className="mx-1 text-slate-300">·</span>
                                    <span>สัปดาห์ </span>
                                    <strong
                                      className={
                                        parcelStats.isOverWeeklyLimit
                                          ? 'text-red-600 font-extrabold'
                                          : 'text-slate-900'
                                      }
                                    >
                                      {parcelStats.weekCount}
                                    </strong>
                                    <span className="mx-1 text-slate-300">·</span>
                                    <span>เดือน </span>
                                    <strong className="text-slate-900">{parcelStats.monthCount}</strong>
                                  </div>
                                  {parcelStats.isOverWeeklyLimit && (
                                    <button
                                      type="button"
                                      onClick={() => openWeeklyWarningPopup(parcelStats, 'manual')}
                                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    title={`แก้ไขข้อมูลนักเรียนรหัส ${st.studentCode}`}
                                    aria-label={`แก้ไขข้อมูลนักเรียนรหัส ${st.studentCode}`}
                                    onClick={() => handleOpenEditStudentModal(st)}
                                    className="min-h-[32px] px-2.5 py-1 inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>แก้ไข</span>
                                  </button>
                                  <button
                                    type="button"
                                    title={`ลบนักเรียนรหัส ${st.studentCode}`}
                                    aria-label={`ลบนักเรียนรหัส ${st.studentCode}`}
                                    onClick={() => deleteStudent(st.studentCode)}
                                    className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* โมดอลเลือกล้างข้อมูลนักเรียน (Selective Data Clear Dialog) */}
      {isClearModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="selective-clear-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                <h3 id="selective-clear-title" className="text-lg font-bold text-slate-900">
                  เลือกล้างข้อมูลนักเรียน (ซิงก์การลบกับ Firebase อัตโนมัติ)
                </h3>
              </div>
              <button
                type="button"
                aria-label="ปิดหน้าต่างเลือกล้างข้อมูล"
                onClick={() => {
                  setIsClearModalOpen(false);
                  setPendingConfirmDelete(null);
                }}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pendingConfirmDelete ? (
              <div className="p-5 bg-red-50 border border-red-200 rounded-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-red-950">
                      ยืนยันการล้างข้อมูล: {pendingConfirmDelete.label}
                    </h4>
                    <p className="text-xs text-red-800 leading-relaxed">
                      ระบบจะลบรายชื่อนักเรียนจำนวน{' '}
                      <strong className="font-mono">{pendingConfirmDelete.codes.length}</strong> คน
                      ออกจากทั้งในโปรแกรมและฐานข้อมูล Firebase Firestore ทันที
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setPendingConfirmDelete(null)}
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSelectiveDelete}
                    className="min-h-[42px] px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>
                      ยืนยันล้างข้อมูล ({pendingConfirmDelete.codes.length} คน)
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* 1. ล้างเฉพาะที่ติ๊กเลือก หรือที่แสดงผลอยู่ */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">
                    1. ล้างตามการเลือกปัจจุบัน
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={selectedStudentCodes.length === 0}
                      onClick={() =>
                        setPendingConfirmDelete({
                          codes: selectedStudentCodes,
                          label: `รายการที่ติ๊กเลือก (${selectedStudentCodes.length} คน)`,
                        })
                      }
                      className="min-h-[40px] px-4 py-2 font-bold bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-950 border border-amber-300 rounded-xl cursor-pointer"
                    >
                      ล้างเฉพาะที่ติ๊กเลือก ({selectedStudentCodes.length} คน)
                    </button>

                    <button
                      type="button"
                      disabled={filteredStudents.length === 0}
                      onClick={() =>
                        setPendingConfirmDelete({
                          codes: filteredStudents.map((s) => s.studentCode),
                          label: `รายการที่กรองแสดงอยู่ปัจจุบัน (${filteredStudents.length} คน)`,
                        })
                      }
                      className="min-h-[40px] px-4 py-2 font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 border border-slate-300 rounded-xl cursor-pointer"
                    >
                      ล้างเฉพาะรายการที่แสดงอยู่ตอนนี้ ({filteredStudents.length} คน)
                    </button>
                  </div>
                </div>

                {/* 2. เลือกล้างข้อมูลรายห้องเรียน */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-slate-900">
                    2. เลือกล้างข้อมูลเฉพาะห้องเรียน (ระดับชั้น/ห้อง)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {classroomOptions.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() =>
                          setPendingConfirmDelete({
                            codes: students
                              .filter((s) => getClassroomKey(s) === c.key)
                              .map((s) => s.studentCode),
                            label: `ห้องเรียน ${c.key}`,
                          })
                        }
                        className="min-h-[38px] px-3.5 py-1.5 font-semibold bg-white hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-300 hover:border-red-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>
                          ล้างห้อง {c.key} ({c.count} คน)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. เลือกล้างข้อมูลรายหอพัก */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <h4 className="font-bold text-slate-900">
                    3. เลือกล้างข้อมูลเฉพาะหอพัก
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {dormitoryOptions.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() =>
                          setPendingConfirmDelete({
                            codes: students
                              .filter(
                                (s) =>
                                  ((s.dormitory || '').trim() || 'ไม่ระบุหอพัก') === d.name
                              )
                              .map((s) => s.studentCode),
                            label: `หอพัก ${d.name}`,
                          })
                        }
                        className="min-h-[38px] px-3.5 py-1.5 font-semibold bg-white hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-300 hover:border-red-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>
                          ล้าง{d.name} ({d.count} คน)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. ล้างข้อมูลนักเรียนทั้งหมด */}
                <div className="space-y-2 border-t border-slate-200 pt-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-red-700">
                      4. ล้างรายชื่อนักเรียนทั้งหมดในระบบ
                    </h4>
                    <p className="text-slate-500">
                      ลบข้อมูลนักเรียนทั้งหมด {students.length} คนออกจากระบบและ Cloud
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirmDelete({
                        codes: students.map((s) => s.studentCode),
                        label: `รายชื่อนักเรียนทั้งหมดในระบบ (${students.length} คน)`,
                      })
                    }
                    className="min-h-[42px] px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ล้างทั้งหมด ({students.length} คน)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* โมดอลเพิ่ม / แก้ไขข้อมูลนักเรียนรายบุคคล */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-student-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleAddSingleStudentSubmit}
            className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="add-student-title" className="text-lg font-bold text-slate-900">
                {editingOriginalCode
                  ? `แก้ไขข้อมูลนักเรียนรายบุคคล (รหัส ${editingOriginalCode})`
                  : 'เพิ่มข้อมูลนักเรียนรายบุคคล'}
              </h3>
              <button
                type="button"
                aria-label="ปิดหน้าต่างจัดการข้อมูลนักเรียน"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingOriginalCode(null);
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">เลขที่</label>
                <input
                  type="number"
                  required
                  value={singleForm.seqNo}
                  onChange={(e) => setSingleForm({ ...singleForm, seqNo: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รหัสนักเรียน</label>
                <input
                  type="text"
                  required
                  value={singleForm.studentCode}
                  onChange={(e) => setSingleForm({ ...singleForm, studentCode: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">คำนำหน้า</label>
                <select
                  value={singleForm.prefix}
                  onChange={(e) => setSingleForm({ ...singleForm, prefix: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold cursor-pointer"
                >
                  <option value="นาย">นาย</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="ด.ช.">ด.ช.</option>
                  <option value="ด.ญ.">ด.ญ.</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อ</label>
                <input
                  type="text"
                  required
                  value={singleForm.firstName}
                  onChange={(e) => setSingleForm({ ...singleForm, firstName: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">นามสกุล</label>
                <input
                  type="text"
                  value={singleForm.lastName}
                  onChange={(e) => setSingleForm({ ...singleForm, lastName: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={singleForm.nickname}
                  onChange={(e) => setSingleForm({ ...singleForm, nickname: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ระดับชั้น</label>
                <input
                  type="text"
                  list="grade-options-list"
                  value={singleForm.grade}
                  onChange={(e) => setSingleForm({ ...singleForm, grade: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ห้อง</label>
                <input
                  type="text"
                  value={singleForm.room}
                  onChange={(e) => setSingleForm({ ...singleForm, room: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">หอพัก</label>
                <input
                  type="text"
                  list="dormitory-options-list"
                  value={singleForm.dormitory}
                  onChange={(e) => setSingleForm({ ...singleForm, dormitory: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ห้องพักหอ</label>
                <input
                  type="text"
                  value={singleForm.dormRoom}
                  onChange={(e) => setSingleForm({ ...singleForm, dormRoom: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">เตียง</label>
                <input
                  type="text"
                  value={singleForm.bed}
                  onChange={(e) => setSingleForm({ ...singleForm, bed: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingOriginalCode(null);
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                {editingOriginalCode ? 'บันทึกการแก้ไขข้อมูลนักเรียน' : 'บันทึกข้อมูลนักเรียน'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
