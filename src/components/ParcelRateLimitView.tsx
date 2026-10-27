import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Calendar,
  CalendarDays,
  CalendarRange,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  Eye,
  Info,
  Users,
  Search,
  Package,
  Layers,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  ParcelRateLimitConfig,
  DEFAULT_PARCEL_RATE_LIMIT_CONFIG,
  getWeekRangeYMD,
  getMonthRangeYMD,
  formatThaiSlashDate,
  StudentParcelCountStats,
} from '../types/parcel';

export const ParcelRateLimitView: React.FC = () => {
  const {
    parcelRateLimitConfig,
    updateParcelRateLimitConfig,
    openWeeklyWarningPopup,
    allStudentParcelStats,
    overLimitStudents,
    isSyncing,
    canCurrentMemberEdit,
  } = useParcelSystem();

  // สำเนาค่าคอนฟิกสำหรับแก้ไขในฟอร์ม
  const [formConfig, setFormConfig] = useState<ParcelRateLimitConfig>(() => ({
    daily: { ...parcelRateLimitConfig.daily },
    weekly: { ...parcelRateLimitConfig.weekly },
    monthly: { ...parcelRateLimitConfig.monthly },
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  const weekRange = useMemo(() => getWeekRangeYMD(new Date()), []);
  const monthRange = useMemo(() => getMonthRangeYMD(new Date()), []);

  const hasUnsavedChanges = useMemo(() => {
    return (
      formConfig.daily.enabled !== parcelRateLimitConfig.daily.enabled ||
      formConfig.daily.limit !== parcelRateLimitConfig.daily.limit ||
      formConfig.weekly.enabled !== parcelRateLimitConfig.weekly.enabled ||
      formConfig.weekly.limit !== parcelRateLimitConfig.weekly.limit ||
      formConfig.monthly.enabled !== parcelRateLimitConfig.monthly.enabled ||
      formConfig.monthly.limit !== parcelRateLimitConfig.monthly.limit
    );
  }, [formConfig, parcelRateLimitConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateParcelRateLimitConfig(formConfig);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setFormConfig({
      daily: { ...DEFAULT_PARCEL_RATE_LIMIT_CONFIG.daily },
      weekly: { ...DEFAULT_PARCEL_RATE_LIMIT_CONFIG.weekly },
      monthly: { ...DEFAULT_PARCEL_RATE_LIMIT_CONFIG.monthly },
    });
  };

  // ทดสอบเปิด POPUP แจ้งเตือนตัวอย่าง
  const handleTestPopupPreview = () => {
    // หาตัวอย่างนักเรียนที่มีพัสดุในระบบ หรือสร้าง mock
    const sampleStudent: StudentParcelCountStats = overLimitStudents[0] ||
      allStudentParcelStats[0] || {
        studentKey: 'code:06501',
        studentCode: '06501',
        studentFullName: 'นายสมมุติ ทดสอบระบบ',
        nickname: 'เดโม่',
        gradeRoom: 'ม.5/1',
        dormitory: 'หอพักล้านนา 1',
        dormRoom: '101',
        dayCount: formConfig.daily.enabled ? formConfig.daily.limit + 1 : 2,
        weekCount: formConfig.weekly.enabled ? formConfig.weekly.limit + 2 : 4,
        monthCount: formConfig.monthly.enabled ? formConfig.monthly.limit + 3 : 12,
        totalCount: 15,
        isOverLimit: true,
        isOverDailyLimit: formConfig.daily.enabled,
        isOverWeeklyLimit: formConfig.weekly.enabled,
        isOverMonthlyLimit: formConfig.monthly.enabled,
        exceededReasons: [
          ...(formConfig.daily.enabled
            ? [`รายวัน: รับแล้ว ${formConfig.daily.limit + 1} ชิ้น (กำหนดไม่เกิน ${formConfig.daily.limit} ชิ้น/วัน)`]
            : []),
          ...(formConfig.weekly.enabled
            ? [`รายสัปดาห์: รับแล้ว ${formConfig.weekly.limit + 2} ชิ้น (กำหนดไม่เกิน ${formConfig.weekly.limit} ชิ้น/สัปดาห์)`]
            : []),
          ...(formConfig.monthly.enabled
            ? [`รายเดือน: รับแล้ว ${formConfig.monthly.limit + 3} ชิ้น (กำหนดไม่เกิน ${formConfig.monthly.limit} ชิ้น/เดือน)`]
            : []),
        ],
        dayParcels: [],
        weekParcels: [],
        monthParcels: [],
      };

    openWeeklyWarningPopup(
      sampleStudent,
      'test_preview',
      'ตัวอย่างการแจ้งเตือน POPUP เมื่อสแกนพัสดุเกินอัตราที่กำหนด',
      sampleStudent.exceededReasons.length > 0
        ? sampleStudent.exceededReasons
        : ['ทดสอบการแจ้งเตือน: เกินอัตราการสั่งพัสดุที่กำหนดไว้ในระบบ']
    );
  };

  // กรองรายชื่อนักเรียนที่เกินเกณฑ์
  const filteredOverLimitStudents = useMemo(() => {
    const q = searchStudentQuery.trim().toLowerCase();
    return overLimitStudents.filter((st) => {
      // ตัวกรองตามช่วงเวลา
      if (filterPeriod === 'daily' && !st.isOverDailyLimit) return false;
      if (filterPeriod === 'weekly' && !st.isOverWeeklyLimit) return false;
      if (filterPeriod === 'monthly' && !st.isOverMonthlyLimit) return false;

      // ตัวกรองค้นหาคำ
      if (!q) return true;
      return (
        st.studentCode.toLowerCase().includes(q) ||
        st.studentFullName.toLowerCase().includes(q) ||
        st.nickname.toLowerCase().includes(q) ||
        st.dormitory.toLowerCase().includes(q) ||
        st.gradeRoom.toLowerCase().includes(q)
      );
    });
  }, [overLimitStudents, searchStudentQuery, filterPeriod]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  กำหนดอัตราการสั่งพัสดุ
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                  Rate Limits
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                กำหนดโควตาจำกัดจำนวนการสั่งพัสดุของนักเรียน แยกเป็นรายวัน รายสัปดาห์ และรายเดือน
                พร้อมแจ้งเตือนเป็น POPUP ขณะสแกนรับเข้าพัสดุ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleTestPopupPreview}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ดูตัวอย่างหน้าต่าง POPUP แจ้งเตือนเมื่อสแกนเกินอัตรา"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>ทดสอบ POPUP</span>
            </button>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเซ็ต</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isSyncing || !canCurrentMemberEdit}
              className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              } disabled:opacity-50`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>มีการแก้ไขการตั้งค่าที่ยังไม่ได้บันทึก กรุณากดปุ่ม <strong>"บันทึกการตั้งค่า"</strong> เพื่อให้มีผลในระบบสแกน</span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-bold text-amber-900 underline hover:no-underline cursor-pointer"
            >
              บันทึกทันที
            </button>
          </div>
        )}
      </div>

      {/* Grid 3 การตั้งค่า: รายวัน, รายสัปดาห์, รายเดือน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. กำหนดอัตราต่อวัน (Daily) */}
        <div
          className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
            formConfig.daily.enabled
              ? 'border-indigo-300 ring-2 ring-indigo-500/10'
              : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  formConfig.daily.enabled
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Calendar className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  อัตราพัสดุต่อวัน
                </h3>
                <p className="text-[11px] text-slate-400">รายวัน (Daily Limit)</p>
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                formConfig.daily.enabled
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {formConfig.daily.enabled ? `จำกัด ${formConfig.daily.limit} ชิ้น/วัน` : 'ไม่กำหนด'}
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="text-xs font-semibold text-slate-700">เงื่อนไขการนับ:</div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900">ให้นับยอดรวมที่รับลงทะเบียนในแต่ละวัน</strong>{' '}
              (นับพัสดุที่ลงทะเบียนรับเข้าในวันเดียวกัน ณ วันที่สแกน)
            </div>

            {/* ตัวเลือก: ไม่กำหนด / จำนวน */}
            <div className="space-y-2 pt-1">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  !formConfig.daily.enabled
                    ? 'bg-slate-100/90 border-slate-300 text-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="daily-limit-type"
                    checked={!formConfig.daily.enabled}
                    onChange={() =>
                      setFormConfig((prev) => ({
                        ...prev,
                        daily: { ...prev.daily, enabled: false },
                      }))
                    }
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs">ไม่กำหนด</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">สั่งได้ไม่จำกัด</span>
              </label>

              <label
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                  formConfig.daily.enabled
                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="daily-limit-type"
                      checked={formConfig.daily.enabled}
                      onChange={() =>
                        setFormConfig((prev) => ({
                          ...prev,
                          daily: { ...prev.daily, enabled: true },
                        }))
                      }
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs">จำนวน (ระบุจำนวนที่อนุญาต)</span>
                  </div>
                  {formConfig.daily.enabled && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded font-mono">
                      เปิดใช้งาน
                    </span>
                  )}
                </div>

                {/* ช่องกรอกจำนวน */}
                {formConfig.daily.enabled && (
                  <div className="mt-3 pt-3 border-t border-indigo-200/60 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-700 font-medium">อนุญาตให้สั่งได้ไม่เกิน:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            daily: {
                              ...prev.daily,
                              limit: Math.max(1, prev.daily.limit - 1),
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={formConfig.daily.limit}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFormConfig((prev) => ({
                            ...prev,
                            daily: { ...prev.daily, limit: val },
                          }));
                        }}
                        className="w-16 h-8 text-center font-mono font-bold text-sm bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            daily: {
                              ...prev.daily,
                              limit: prev.daily.limit + 1,
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-600 font-medium ml-1">ชิ้น/วัน</span>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* 2. กำหนดอัตราต่อสัปดาห์ (Weekly) */}
        <div
          className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
            formConfig.weekly.enabled
              ? 'border-indigo-300 ring-2 ring-indigo-500/10'
              : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  formConfig.weekly.enabled
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <CalendarDays className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  อัตราพัสดุต่อสัปดาห์
                </h3>
                <p className="text-[11px] text-slate-400">รายสัปดาห์ (Weekly Limit)</p>
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                formConfig.weekly.enabled
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {formConfig.weekly.enabled ? `จำกัด ${formConfig.weekly.limit} ชิ้น/สัปดาห์` : 'ไม่กำหนด'}
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="text-xs font-semibold text-slate-700">เงื่อนไขการนับ:</div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900">ให้นับยอดรวมที่รับลงทะเบียนในแต่ละสัปดาห์</strong>{' '}
              เริ่มต้นสัปดาห์ถึงท้ายสัปดาห์ (จันทร์ - อาทิตย์)
              <div className="text-[10px] text-indigo-700 font-semibold mt-1">
                รอบสัปดาห์นี้: {weekRange.startThaiDisplay} - {weekRange.endThaiDisplay}
              </div>
            </div>

            {/* ตัวเลือก: ไม่กำหนด / จำนวน */}
            <div className="space-y-2 pt-1">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  !formConfig.weekly.enabled
                    ? 'bg-slate-100/90 border-slate-300 text-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="weekly-limit-type"
                    checked={!formConfig.weekly.enabled}
                    onChange={() =>
                      setFormConfig((prev) => ({
                        ...prev,
                        weekly: { ...prev.weekly, enabled: false },
                      }))
                    }
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs">ไม่กำหนด</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">สั่งได้ไม่จำกัด</span>
              </label>

              <label
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                  formConfig.weekly.enabled
                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="weekly-limit-type"
                      checked={formConfig.weekly.enabled}
                      onChange={() =>
                        setFormConfig((prev) => ({
                          ...prev,
                          weekly: { ...prev.weekly, enabled: true },
                        }))
                      }
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs">จำนวน (ระบุจำนวนที่อนุญาต)</span>
                  </div>
                  {formConfig.weekly.enabled && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded font-mono">
                      เปิดใช้งาน
                    </span>
                  )}
                </div>

                {/* ช่องกรอกจำนวน */}
                {formConfig.weekly.enabled && (
                  <div className="mt-3 pt-3 border-t border-indigo-200/60 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-700 font-medium">อนุญาตให้สั่งได้ไม่เกิน:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            weekly: {
                              ...prev.weekly,
                              limit: Math.max(1, prev.weekly.limit - 1),
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={formConfig.weekly.limit}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFormConfig((prev) => ({
                            ...prev,
                            weekly: { ...prev.weekly, limit: val },
                          }));
                        }}
                        className="w-16 h-8 text-center font-mono font-bold text-sm bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            weekly: {
                              ...prev.weekly,
                              limit: prev.weekly.limit + 1,
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-600 font-medium ml-1">ชิ้น/สัปดาห์</span>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* 3. กำหนดอัตราต่อเดือน (Monthly) */}
        <div
          className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
            formConfig.monthly.enabled
              ? 'border-indigo-300 ring-2 ring-indigo-500/10'
              : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                  formConfig.monthly.enabled
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <CalendarRange className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  อัตราพัสดุต่อเดือน
                </h3>
                <p className="text-[11px] text-slate-400">รายเดือน (Monthly Limit)</p>
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                formConfig.monthly.enabled
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {formConfig.monthly.enabled ? `จำกัด ${formConfig.monthly.limit} ชิ้น/เดือน` : 'ไม่กำหนด'}
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="text-xs font-semibold text-slate-700">เงื่อนไขการนับ:</div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900">ให้นับยอดรวมที่รับลงทะเบียนในแต่ละเดือน</strong>{' '}
              เริ่มจากวันที่ 1 ถึงวันสุดท้ายของเดือน
              <div className="text-[10px] text-indigo-700 font-semibold mt-1">
                รอบเดือน {monthRange.monthNameTh} {monthRange.yearBE}: {monthRange.startThaiDisplay} - {monthRange.endThaiDisplay}
              </div>
            </div>

            {/* ตัวเลือก: ไม่กำหนด / จำนวน */}
            <div className="space-y-2 pt-1">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  !formConfig.monthly.enabled
                    ? 'bg-slate-100/90 border-slate-300 text-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="monthly-limit-type"
                    checked={!formConfig.monthly.enabled}
                    onChange={() =>
                      setFormConfig((prev) => ({
                        ...prev,
                        monthly: { ...prev.monthly, enabled: false },
                      }))
                    }
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs">ไม่กำหนด</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">สั่งได้ไม่จำกัด</span>
              </label>

              <label
                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                  formConfig.monthly.enabled
                    ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="monthly-limit-type"
                      checked={formConfig.monthly.enabled}
                      onChange={() =>
                        setFormConfig((prev) => ({
                          ...prev,
                          monthly: { ...prev.monthly, enabled: true },
                        }))
                      }
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs">จำนวน (ระบุจำนวนที่อนุญาต)</span>
                  </div>
                  {formConfig.monthly.enabled && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded font-mono">
                      เปิดใช้งาน
                    </span>
                  )}
                </div>

                {/* ช่องกรอกจำนวน */}
                {formConfig.monthly.enabled && (
                  <div className="mt-3 pt-3 border-t border-indigo-200/60 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-700 font-medium">อนุญาตให้สั่งได้ไม่เกิน:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            monthly: {
                              ...prev.monthly,
                              limit: Math.max(1, prev.monthly.limit - 1),
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={formConfig.monthly.limit}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFormConfig((prev) => ({
                            ...prev,
                            monthly: { ...prev.monthly, limit: val },
                          }));
                        }}
                        className="w-16 h-8 text-center font-mono font-bold text-sm bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFormConfig((prev) => ({
                            ...prev,
                            monthly: {
                              ...prev.monthly,
                              limit: prev.monthly.limit + 1,
                            },
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-600 font-medium ml-1">ชิ้น/เดือน</span>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* สรุปนโยบายที่เปิดใช้งานในระบบ */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-white">
                สรุปเงื่อนไขการแจ้งเตือน POPUP ขณะทำการสแกน
              </h2>
              <p className="text-[11px] text-slate-400">
                ระบบจะตรวจสอบทันทีขณะสแกนบาร์โค้ด หรือดึงข้อมูลนักเรียนผู้รับ
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>สถานะระบบ: พร้อมตรวจจับและแจ้งเตือน POPUP</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80">
            <div className="text-[11px] text-slate-400">เงื่อนไขรายวัน (วันนี้)</div>
            <div className="text-base font-extrabold text-white mt-1">
              {parcelRateLimitConfig.daily.enabled ? (
                <span className="text-amber-400">ไม่เกิน {parcelRateLimitConfig.daily.limit} ชิ้น/วัน</span>
              ) : (
                <span className="text-slate-400 font-normal">ไม่กำหนด (ไม่จำกัด)</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">นับยอดรับลงทะเบียนในวันนี้</div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80">
            <div className="text-[11px] text-slate-400">เงื่อนไขรายสัปดาห์ (จันทร์ - อาทิตย์)</div>
            <div className="text-base font-extrabold text-white mt-1">
              {parcelRateLimitConfig.weekly.enabled ? (
                <span className="text-indigo-400">ไม่เกิน {parcelRateLimitConfig.weekly.limit} ชิ้น/สัปดาห์</span>
              ) : (
                <span className="text-slate-400 font-normal">ไม่กำหนด (ไม่จำกัด)</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">นับตั้งแต่ต้นสัปดาห์ถึงท้ายสัปดาห์</div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80">
            <div className="text-[11px] text-slate-400">เงื่อนไขรายเดือน (1 ถึงสิ้นเดือน)</div>
            <div className="text-base font-extrabold text-white mt-1">
              {parcelRateLimitConfig.monthly.enabled ? (
                <span className="text-purple-400">ไม่เกิน {parcelRateLimitConfig.monthly.limit} ชิ้น/เดือน</span>
              ) : (
                <span className="text-slate-400 font-normal">ไม่กำหนด (ไม่จำกัด)</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">นับตั้งแต่วันที่ 1 ถึงวันสุดท้ายของเดือน</div>
          </div>
        </div>
      </div>

      {/* ส่วนแสดงรายการนักเรียนที่สั่งพัสดุเกินอัตราที่กำหนด ณ ปัจจุบัน */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>นักเรียนที่มียอดสั่งพัสดุเกินอัตรา ณ ปัจจุบัน</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-red-100 text-red-800">
                  {overLimitStudents.length} คน
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                รายการนักเรียนที่มีจำนวนพัสดุเกินเกณฑ์รายวัน รายสัปดาห์ หรือรายเดือนตามที่ตั้งไว้
              </p>
            </div>
          </div>

          {/* ฟิลเตอร์ช่วงเวลา */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterPeriod('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterPeriod === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              ทั้งหมด ({overLimitStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('daily')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterPeriod === 'daily' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              เกินรายวัน ({overLimitStudents.filter((s) => s.isOverDailyLimit).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('weekly')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterPeriod === 'weekly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              เกินรายสัปดาห์ ({overLimitStudents.filter((s) => s.isOverWeeklyLimit).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('monthly')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterPeriod === 'monthly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              เกินรายเดือน ({overLimitStudents.filter((s) => s.isOverMonthlyLimit).length})
            </button>
          </div>
        </div>

        {/* ช่องค้นหานักเรียนในรายการ */}
        <div className="mt-4 mb-3">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchStudentQuery}
              onChange={(e) => setSearchStudentQuery(e.target.value)}
              placeholder="ค้นหารหัส, ชื่อ-นามสกุล หรือหอพัก..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-slate-900"
            />
          </div>
        </div>

        {filteredOverLimitStudents.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <div className="font-bold text-slate-700">ไม่มีนักเรียนที่สั่งพัสดุเกินอัตราที่กำหนด</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {searchStudentQuery
                ? 'ไม่พบข้อมูลตามคำค้นหา'
                : 'ยอดสั่งพัสดุของนักเรียนทุกคนอยู่ในเกณฑ์ที่อนุญาต'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">รหัสนักเรียน</th>
                  <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                  <th className="py-2.5 px-3">หอพัก/ห้อง</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">
                    รายวัน (วันนี้)
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">
                    รายสัปดาห์ (สัปดาห์นี้)
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">
                    รายเดือน (เดือนนี้)
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">ยอดรวมทั้งหมด</th>
                  <th className="py-2.5 px-3 text-right">การแจ้งเตือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOverLimitStudents.map((st) => (
                  <tr key={st.studentKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {st.studentCode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 leading-tight">
                        {st.studentFullName}
                      </div>
                      {st.nickname && st.nickname !== '-' && (
                        <div className="text-[10px] text-slate-400">({st.nickname})</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{st.dormitory || '-'}</div>
                      {st.dormRoom && st.dormRoom !== '-' && (
                        <div className="text-[10px] text-slate-400">ห้อง {st.dormRoom}</div>
                      )}
                    </td>

                    {/* รายวัน */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                          st.isOverDailyLimit
                            ? 'bg-red-100 text-red-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {st.dayCount} ชิ้น
                      </span>
                      {parcelRateLimitConfig.daily.enabled && (
                        <div className="text-[9px] text-slate-400">
                          (เกณฑ์: {parcelRateLimitConfig.daily.limit})
                        </div>
                      )}
                    </td>

                    {/* รายสัปดาห์ */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                          st.isOverWeeklyLimit
                            ? 'bg-red-100 text-red-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {st.weekCount} ชิ้น
                      </span>
                      {parcelRateLimitConfig.weekly.enabled && (
                        <div className="text-[9px] text-slate-400">
                          (เกณฑ์: {parcelRateLimitConfig.weekly.limit})
                        </div>
                      )}
                    </td>

                    {/* รายเดือน */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                          st.isOverMonthlyLimit
                            ? 'bg-red-100 text-red-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {st.monthCount} ชิ้น
                      </span>
                      {parcelRateLimitConfig.monthly.enabled && (
                        <div className="text-[9px] text-slate-400">
                          (เกณฑ์: {parcelRateLimitConfig.monthly.limit})
                        </div>
                      )}
                    </td>

                    {/* ยอดรวมทั้งหมด */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-semibold">
                      {st.totalCount} ชิ้น
                    </td>

                    {/* ปุ่มดู POPUP */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openWeeklyWarningPopup(st, 'manual')}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                      >
                        เปิดดูเตือน POPUP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
