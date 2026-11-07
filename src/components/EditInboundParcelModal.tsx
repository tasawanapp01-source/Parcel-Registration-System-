import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  UserCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Search,
  CheckCircle2,
  Edit3,
  Package,
} from 'lucide-react';
import {
  Parcel,
  ParcelStatus,
  ParcelCategory,
  PARCEL_CATEGORIES,
  PARCEL_STATUSES,
  COURIER_LIST,
  Student,
  formatStudentCode,
  formatThaiSlashDate,
  getDormitoryTheme,
  getRelativeDateString,
  extractParcelLocalYMD,
} from '../types/parcel';
import { useParcelSystem } from '../context/ParcelSystemContext';

interface EditInboundParcelModalProps {
  isOpen: boolean;
  parcel: Parcel | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const EditInboundParcelModal: React.FC<EditInboundParcelModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onSaved,
}) => {
  const {
    students,
    availableDormitories = [],
    updateParcelDetails,
    currentMember,
    user,
  } = useParcelSystem() as any;

  // รายการหอพัก
  const dormList = useMemo(() => {
    const list = availableDormitories && availableDormitories.length > 0
      ? availableDormitories
      : [
          'หอพักล้านนา',
          'หอพักสุโขทัย',
          'หอพักอยุธยา',
          'หอพักธนบุรี',
          'หอพักรัตนโกสินทร์',
        ];
    return Array.from(new Set(list)) as string[];
  }, [availableDormitories]);

  // ฟอร์มข้อมูลผู้รับพัสดุ
  const [studentCode, setStudentCode] = useState<string>('');
  const [studentFullName, setStudentFullName] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [gradeRoom, setGradeRoom] = useState<string>('');
  const [dormitory, setDormitory] = useState<string>('');
  const [dormRoom, setDormRoom] = useState<string>('');

  // ฟอร์มสถานะและรายละเอียดพัสดุ
  const [status, setStatus] = useState<ParcelStatus>('ลงทะเบียนรับพัสดุ');
  const [category, setCategory] = useState<ParcelCategory>('ของใช้ส่วนตัว');
  const [courier, setCourier] = useState<string>('Flash Express');
  const [note, setNote] = useState<string>('');
  const [deliveredDate, setDeliveredDate] = useState<string>('');
  const [legalReason, setLegalReason] = useState<'สั่งของเกินกำหนด' | 'ของผิดระเบียบ' | 'อื่นๆ' | ''>('');
  const [customLegalNote, setCustomLegalNote] = useState<string>('');

  // ค้นหานักเรียนเพื่อเปลี่ยนผู้รับใน Modal (ต้องกรอกครบ 6 ตัว หรือค้นหาชื่อ)
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');
  const [isSearchingStudent, setIsSearchingStudent] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const todayIso = useMemo(() => getRelativeDateString(0), []);

  // ตรวจสอบสิทธิ์การแก้ไข:
  // เงื่อนไข: ให้ทุกคนแก้ไขได้เฉพาะพัสดุที่รับเข้าเฉพาะวันนี้เท่านั้น ส่วนเจ้าหน้าที่ ผู้ดูแล แก้ไขได้ตลอด
  const isReceivedToday = useMemo(() => {
    if (!parcel) return false;
    const ymd = extractParcelLocalYMD(parcel);
    return ymd === todayIso || parcel.receivedDate === todayIso;
  }, [parcel, todayIso]);

  const isStaffOrAdmin = useMemo(() => {
    const role = currentMember?.role;
    return role === 'ผู้ดูแลระบบ' || role === 'เจ้าหน้าที่';
  }, [currentMember]);

  const canEdit = isStaffOrAdmin || isReceivedToday;

  // โหลดข้อมูลพัสดุเข้าสู่ State
  useEffect(() => {
    if (parcel && isOpen) {
      setStudentCode(parcel.studentCode || '');
      setStudentFullName(parcel.studentFullName || '');
      setNickname(parcel.nickname || '');
      setGradeRoom(parcel.gradeRoom || '');
      setDormitory(parcel.dormitory || '');
      setDormRoom(parcel.dormRoom || '');
      setStatus(parcel.status || 'ลงทะเบียนรับพัสดุ');
      setCategory(parcel.category || 'ของใช้ส่วนตัว');
      setCourier(parcel.courier || 'Flash Express');
      setNote(parcel.note || '');
      setDeliveredDate(parcel.deliveredDate || (parcel.status === 'ส่งมอบสำเร็จ' ? todayIso : ''));
      setSearchStudentQuery('');
      setIsSearchingStudent(false);
      setFormError(null);

      if (parcel.status === 'ติดนิติการ') {
        const n = parcel.note || '';
        if (n.includes('สั่งของเกินกำหนด')) {
          setLegalReason('สั่งของเกินกำหนด');
        } else if (n.includes('ของผิดระเบียบ')) {
          setLegalReason('ของผิดระเบียบ');
        } else if (n) {
          setLegalReason('อื่นๆ');
          setCustomLegalNote(n);
        } else {
          setLegalReason('');
        }
      } else {
        setLegalReason('');
        setCustomLegalNote('');
      }
    }
  }, [parcel, isOpen, todayIso]);

  // ค้นหารายชื่อนักเรียนแนะนำใน Modal:
  // เมื่อกรอกตัวเลข ต้องกรอกครบ 5 ตัวจึงค่อยทำการค้นหา
  const filteredSuggestions = useMemo<Student[]>(() => {
    const q = searchStudentQuery.trim().toLowerCase();
    if (!q) return [];

    const isNumericOnly = /^\d+$/.test(q);
    if (isNumericOnly && q.length < 5) {
      return [];
    }

    return (students || [])
      .filter((s: Student) => {
        const rawCode = s.studentCode.toLowerCase();
        const formattedCode = formatStudentCode(s.studentCode).toLowerCase();
        const fullName = `${s.prefix || ''}${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        const nickname = (s.nickname || '').toLowerCase();
        const dorm = (s.dormitory || '').toLowerCase();

        if (isNumericOnly) {
          return (
            rawCode === q ||
            formattedCode === q ||
            rawCode.endsWith(q) ||
            q.endsWith(rawCode) ||
            rawCode.replace(/^0+/, '') === q.replace(/^0+/, '')
          );
        }

        return (
          fullName.includes(q) ||
          nickname.includes(q) ||
          dorm.includes(q)
        );
      })
      .slice(0, 8);
  }, [students, searchStudentQuery]);

  const handleApplyStudent = (st: Student) => {
    setStudentCode(st.studentCode);
    const fullName = `${st.prefix && st.prefix !== '-' ? st.prefix : ''}${st.firstName} ${
      st.lastName && st.lastName !== '-' ? st.lastName : ''
    }`.trim();
    setStudentFullName(fullName);
    setNickname(st.nickname && st.nickname !== '-' ? st.nickname : '');
    setGradeRoom(
      st.grade && st.grade !== '-'
        ? `${st.grade}${st.room && st.room !== '-' ? `/${st.room}` : ''}`
        : ''
    );
    setDormitory(st.dormitory && st.dormitory !== '-' ? st.dormitory : '');
    setDormRoom(st.dormRoom && st.dormRoom !== '-' ? st.dormRoom : '');
    setIsSearchingStudent(false);
    setSearchStudentQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcel) return;
    if (!canEdit) {
      setFormError('เงื่อนไขการแก้ไข: พัสดุนี้รับเข้าในวันที่ผ่านมาแล้ว เฉพาะเจ้าหน้าที่และผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขได้');
      return;
    }

    const cleanName = studentFullName.trim();
    const cleanCode = studentCode.trim();

    if (status !== 'พัสดุไม่ทราบเจ้าของ' && !cleanName) {
      setFormError('กรุณากรอกชื่อ-นามสกุลผู้รับ หรือเลือกนักเรียน');
      return;
    }

    let finalNote = note.trim();
    if (status === 'ติดนิติการ') {
      if (legalReason === 'สั่งของเกินกำหนด') {
        finalNote = 'สั่งของเกินกำหนด';
      } else if (legalReason === 'ของผิดระเบียบ') {
        finalNote = 'ของผิดระเบียบ';
      } else if (legalReason === 'อื่นๆ') {
        finalNote = customLegalNote.trim() || 'พัสดุติดนิติการ';
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const updates: Partial<Parcel> = {
        studentCode: status === 'พัสดุไม่ทราบเจ้าของ' ? 'UNKNOWN' : formatStudentCode(cleanCode) || 'UNKNOWN',
        studentFullName: status === 'พัสดุไม่ทราบเจ้าของ' ? 'พัสดุไม่ทราบเจ้าของ' : cleanName || '-',
        nickname: nickname.trim(),
        gradeRoom: gradeRoom.trim() || '-',
        dormitory: dormitory.trim() || '-',
        dormRoom: dormRoom.trim() || '-',
        status,
        category,
        courier,
        note: finalNote,
        deliveredDate: status === 'ส่งมอบสำเร็จ' ? (deliveredDate || todayIso) : '',
      };

      await updateParcelDetails(parcel.id, updates);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !parcel) return null;

  const currentDormTheme = getDormitoryTheme(dormitory || parcel.dormitory);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  แก้ไขการรับพัสดุ
                </h2>
                <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-800">
                  {parcel.trackingNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                รับเข้า: {formatThaiSlashDate(parcel.receivedDate || extractParcelLocalYMD(parcel))} · ขนส่ง: {parcel.courier}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Permission Notice Banner */}
        <div className="px-5 py-2.5 bg-indigo-50/70 border-b border-indigo-100 text-xs font-medium text-indigo-900 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              เงื่อนไข: พัสดุที่รับเข้าวันนี้แก้ไขได้ทุกคน · เจ้าหน้าที่/ผู้ดูแลระบบแก้ไขได้ตลอด
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              isReceivedToday
                ? 'bg-emerald-100 text-emerald-800'
                : isStaffOrAdmin
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isReceivedToday
              ? 'พัสดุรับเข้าวันนี้'
              : isStaffOrAdmin
              ? 'สิทธิ์เจ้าหน้าที่/ผู้ดูแล'
              : 'พัสดุวันก่อนหน้า (ล็อก)'}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center justify-between gap-2">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-red-600 hover:text-red-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!canEdit && (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">ไม่สามารถแก้ไขรายการนี้ได้</p>
                <p className="mt-0.5">
                  พัสดุนี้ถูกรับเข้าในวันที่ {formatThaiSlashDate(parcel.receivedDate || extractParcelLocalYMD(parcel))} (ไม่ใช่พัสดุของวันนี้)
                  ตามนโยบายความปลอดภัย เฉพาะเจ้าหน้าที่หรือผู้ดูแลระบบเท่านั้นที่สามารถแก้ไขข้อมูลย้อนหลังได้
                </p>
              </div>
            </div>
          )}

          {/* 1. ส่วนข้อมูลผู้รับพัสดุ */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  1. แก้ไขข้อมูลผู้รับพัสดุ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchingStudent((prev) => !prev)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearchingStudent ? 'ซ่อนค้นหานักเรียน' : 'ค้นหาดึงข้อมูลนักเรียนจากระบบ'}</span>
              </button>
            </div>

            {/* ช่องค้นหานักเรียนเพื่อสลับผู้รับ */}
            {isSearchingStudent && (
              <div className="p-3 bg-white border border-blue-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="modal-search-student-input" className="text-xs font-bold text-blue-950">
                    ค้นหานักเรียน (กรอกรหัสครบ 5 ตัว หรือพิมพ์ชื่อ/หอพัก):
                  </label>
                  {/^\d+$/.test(searchStudentQuery.trim()) && searchStudentQuery.trim().length < 5 && (
                    <span className="text-[11px] font-semibold text-amber-700 font-mono">
                      กรอกรหัสครบ 5 ตัว ({searchStudentQuery.trim().length}/5)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="modal-search-student-input"
                    type="text"
                    value={searchStudentQuery}
                    onChange={(e) => setSearchStudentQuery(e.target.value)}
                    placeholder="กรอกรหัสนักเรียน 5 หลัก หรือพิมพ์ชื่อ นามสกุล..."
                    className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  {searchStudentQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchStudentQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {filteredSuggestions.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      คลิกเพื่อเลือกนำข้อมูลมาใส่ในฟอร์ม:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {filteredSuggestions.map((st: Student) => (
                        <button
                          key={st.studentCode}
                          type="button"
                          onClick={() => handleApplyStudent(st)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-600 hover:text-white rounded-md border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="font-mono font-bold">{formatStudentCode(st.studentCode)}</span>
                          <span>·</span>
                          <span>{st.firstName} {st.lastName && st.lastName !== '-' ? st.lastName : ''}</span>
                          <span className="text-[11px] opacity-80">({st.dormitory})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสนักเรียน
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="เช่น 00123"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุลผู้รับ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={studentFullName}
                  onChange={(e) => setStudentFullName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล..."
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อเล่น
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ชื่อเล่น"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับชั้น/ห้อง
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={gradeRoom}
                  onChange={(e) => setGradeRoom(e.target.value)}
                  placeholder="เช่น ม.4/1"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หอพัก
                </label>
                <input
                  type="text"
                  list="edit-modal-dorm-list"
                  disabled={!canEdit}
                  value={dormitory}
                  onChange={(e) => setDormitory(e.target.value)}
                  placeholder="ชื่อหอพัก..."
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                <datalist id="edit-modal-dorm-list">
                  {dormList.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ห้องพักหอ
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={dormRoom}
                  onChange={(e) => setDormRoom(e.target.value)}
                  placeholder="เช่น 101"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {dormitory && (
              <div className="pt-1 flex items-center gap-2 text-xs">
                <span className="text-slate-500">ธีมสีหอพัก:</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold border ${currentDormTheme.bgClass} ${currentDormTheme.borderClass} ${currentDormTheme.textClass}`}
                  style={{ color: currentDormTheme.hexColor }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentDormTheme.hexColor }}
                  />
                  <span>{dormitory}</span>
                  {currentDormTheme.basketCode && (
                    <span className="font-mono text-[11px] opacity-80">
                      ({currentDormTheme.basketCode})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* 2. ส่วนสถานะพัสดุ */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                2. แก้ไขสถานะพัสดุ
              </h3>
              <p className="text-xs text-slate-500">
                เลือกสถานะที่ต้องการเปลี่ยนสำหรับพัสดุชิ้นนี้
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { val: 'ลงทะเบียนรับพัสดุ', label: 'ลงทะเบียนรับพัสดุ', color: 'border-emerald-500 text-emerald-800 bg-emerald-50' },
                { val: 'ติดต่องานพยาบาล', label: 'ติดต่องานพยาบาล', color: 'border-amber-500 text-amber-900 bg-amber-50' },
                { val: 'ติดนิติการ', label: 'พัสดุติดนิติการ', color: 'border-red-500 text-red-800 bg-red-50' },
                { val: 'พัสดุไม่ทราบเจ้าของ', label: 'พัสดุไม่ทราบเจ้าของ', color: 'border-slate-600 text-slate-800 bg-slate-100' },
                { val: 'ส่งมอบสำเร็จ', label: 'ส่งมอบสำเร็จ', color: 'border-blue-500 text-blue-800 bg-blue-50' },
              ].map((opt) => {
                const active = status === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setStatus(opt.val as ParcelStatus)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-between cursor-pointer ${
                      active
                        ? `${opt.color} ring-2 ring-slate-900/10 shadow-xs`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* รายละเอียดเพิ่มเติมเมื่อเลือก "พัสดุติดนิติการ" */}
            {status === 'ติดนิติการ' && (
              <div className="p-3.5 bg-red-50/90 border-2 border-red-300 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                <label className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>สาเหตุพัสดุติดนิติการ:</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['สั่งของเกินกำหนด', 'ของผิดระเบียบ', 'อื่นๆ'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setLegalReason(r)}
                      className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        legalReason === r
                          ? 'bg-red-600 text-white border-red-700 shadow-xs'
                          : 'bg-white text-red-900 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {legalReason === 'อื่นๆ' && (
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={customLegalNote}
                    onChange={(e) => setCustomLegalNote(e.target.value)}
                    placeholder="ระบุสาเหตุเพิ่มเติม..."
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-red-300 rounded-lg focus:border-red-600 focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* วันที่ส่งมอบเมื่อเลือก "ส่งมอบสำเร็จ" */}
            {status === 'ส่งมอบสำเร็จ' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>วันที่นักเรียนเซ็นรับพัสดุ (ส่งมอบสำเร็จ):</span>
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={deliveredDate || todayIso}
                  onChange={(e) => setDeliveredDate(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-white border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            {/* หมายเหตุทั่วไป */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ระบุหมายเหตุ เช่น ฝากไว้ห้องพยาบาล, กล่องบุบ, ติดต่อครูหอ..."
                className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>

          {/* 3. หมวดหมู่สิ่งของ & บริษัทขนส่ง */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมวดหมู่สิ่งของ
              </label>
              <select
                disabled={!canEdit}
                value={category}
                onChange={(e) => setCategory(e.target.value as ParcelCategory)}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                {PARCEL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                บริษัทขนส่ง
              </label>
              <select
                disabled={!canEdit}
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                {COURIER_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            {canEdit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[42px] px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
