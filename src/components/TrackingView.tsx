import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  RotateCcw,
  AlertOctagon,
  Clock,
  Trash2,
  X,
  Database,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import { BarcodeCameraScanner, decodeBarcodeFromImageFile } from './BarcodeCameraScanner';
import {
  PARCEL_STATUSES,
  getDormitoryTheme,
  getAvailableDormitories,
  formatThaiSlashDate,
  isUnknownOwnerParcel,
  WEEKLY_PARCEL_WARNING_LIMIT,
} from '../types/parcel';

export const TrackingView: React.FC = () => {
  const {
    students,
    parcels,
    searchParcelsLocal,
    recordLocalSearchSaving,
    updateParcelStatus,
    deleteParcel,
    getStudentParcelCounts,
    openWeeklyWarningPopup,
    quotaMetrics,
  } = useParcelSystem();

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDormitory, setSelectedDormitory] = useState<string>('ALL');
  const [onlyOverWeeklyLimit, setOnlyOverWeeklyLimit] = useState<boolean>(false);

  // สถานะกล้องสแกนค้นหาพัสดุด้วยกล้องหลังมือถือ
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isScanningFile, setIsScanningFile] = useState<boolean>(false);

  const availableDormitories = useMemo(
    () => getAvailableDormitories(students, parcels),
    [students, parcels]
  );

  const handleKeywordChange = useCallback(
    (val: string) => {
      setSearchKeyword(val);
      if (val.trim().length > 0) {
        recordLocalSearchSaving();
      }
    },
    [recordLocalSearchSaving]
  );

  const handleScanFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFile(true);
    try {
      const decoded = await decodeBarcodeFromImageFile(file);
      if (decoded.trim()) {
        handleKeywordChange(decoded.trim());
        setIsScannerOpen(false);
      }
    } catch {
      // ignore if not found
    } finally {
      setIsScanningFile(false);
      e.target.value = '';
    }
  };

  const filteredParcels = useMemo(() => {
    const base = searchParcelsLocal(searchKeyword, selectedStatus, selectedDormitory);
    if (!onlyOverWeeklyLimit) return base;
    return base.filter((p) => {
      if (isUnknownOwnerParcel(p)) return false;
      return getStudentParcelCounts(p.studentCode, p.studentFullName).isOverWeeklyLimit;
    });
  }, [
    searchParcelsLocal,
    searchKeyword,
    selectedStatus,
    selectedDormitory,
    onlyOverWeeklyLimit,
    getStudentParcelCounts,
  ]);

  const overLimitParcelCount = useMemo(() => {
    return parcels.filter((p) => {
      if (isUnknownOwnerParcel(p)) return false;
      return getStudentParcelCounts(p.studentCode, p.studentFullName).isOverWeeklyLimit;
    }).length;
  }, [parcels, getStudentParcelCounts]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: parcels.length };
    for (const s of PARCEL_STATUSES) counts[s] = 0;
    for (const p of parcels) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [parcels]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            ระบบค้นหาด้วยดัชนีในเครื่อง (In-Memory Local Search Index) · ประหยัดโควตา Read ไปแล้ว{' '}
            <span className="font-mono font-bold text-slate-800 tabular-nums">
              {quotaMetrics.localLookupsSaved}
            </span>{' '}
            ครั้ง
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            ติดตามและค้นหาสถานะพัสดุ (Tracking & Search)
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl">
          <Database className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            ค้นหาได้ทันทีจากแคชในเครื่อง (<span className="font-mono font-bold">0</span> Firestore Reads/Keystroke)
          </span>
        </div>
      </div>

      {/* แถบค้นหาขนาดใหญ่ (Mobile-First) และตัวกรองหอพัก */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 flex items-center gap-2">
            <div className="relative flex-1">
              <label htmlFor="tracking-search-input" className="sr-only">
                ค้นหาเลขพัสดุ ชื่อนักเรียน หรือรหัสนักเรียน
              </label>
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                id="tracking-search-input"
                type="text"
                value={searchKeyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="ค้นหาด้วย เลข Tracking, รหัสนักเรียน, ชื่อจริง หรือ ชื่อเล่น..."
                className="w-full min-h-[52px] pl-12 pr-10 py-3 text-base text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
              />
              {searchKeyword && (
                <button
                  type="button"
                  aria-label="ล้างคำค้นหา"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsScannerOpen((prev) => !prev)}
              className="min-h-[52px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>{isScannerOpen ? 'ปิดกล้อง' : 'สแกนค้นหา'}</span>
            </button>
          </div>

          <div className="md:col-span-4">
            <label htmlFor="dorm-filter-select" className="sr-only">
              กรองตามหอพัก
            </label>
            <select
              id="dorm-filter-select"
              value={selectedDormitory}
              onChange={(e) => setSelectedDormitory(e.target.value)}
              className="w-full min-h-[52px] px-4 py-3 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">ทุกหอพัก (ทั้งหมด)</option>
              {availableDormitories.map((dormName) => (
                <option key={dormName} value={dormName}>
                  {dormName} ({getDormitoryTheme(dormName).basketCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        <BarcodeCameraScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onDetected={(decoded) => {
            if (decoded.trim()) {
              handleKeywordChange(decoded.trim());
              setIsScannerOpen(false);
            }
          }}
          onScanFromFile={handleScanFromFile}
          isScanningFile={isScanningFile}
        />

        {/* ปุ่มกรองตามสถานะพัสดุ */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({statusCounts.ALL || 0})
          </button>
          {PARCEL_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatus === st
                  ? st === 'ติดนิติการ'
                    ? 'bg-red-600 text-white'
                    : st === 'พัสดุไม่ทราบเจ้าของ'
                    ? 'bg-slate-600 text-white'
                    : st === 'ลงทะเบียนรับพัสดุ' || st === 'ส่งมอบสำเร็จ'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st === 'ติดนิติการ' ? 'พัสดุติดนิติการ' : st} ({statusCounts[st] || 0})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOnlyOverWeeklyLimit((prev) => !prev)}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              onlyOverWeeklyLimit
                ? 'bg-red-600 text-white'
                : overLimitParcelCount > 0
                ? 'bg-red-50 text-red-800 border border-red-300 hover:bg-red-100'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              พัสดุนักเรียนเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์ ({overLimitParcelCount})
            </span>
          </button>
        </div>
      </div>

      {/* รายการผลลัพธ์การค้นหา */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            พบรายการพัสดุตรงตามเงื่อนไข{' '}
            <strong className="font-mono text-slate-900 tabular-nums">{filteredParcels.length}</strong> รายการ
          </span>
          <span>กดปุ่มด้านขวาของแต่ละรายการเพื่อเปลี่ยนสถานะทันที</span>
        </div>

        {filteredParcels.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <p className="text-base font-bold text-slate-800">
              {parcels.length === 0
                ? 'ยังไม่มีรายการพัสดุในระบบ'
                : `ไม่พบรายการพัสดุที่ตรงกับเงื่อนไขการค้นหา`}
            </p>
            <p className="text-xs text-slate-500">
              {parcels.length === 0
                ? 'เมื่อมีการสแกนรับเข้าพัสดุในหน้า "รับเข้าพัสดุ" รายการทั้งหมดจะแสดงที่นี่'
                : 'ลองล้างตัวกรองสถานะ หรือเปลี่ยนคำค้นหา'}
            </p>
            {(searchKeyword || selectedStatus !== 'ALL' || selectedDormitory !== 'ALL' || onlyOverWeeklyLimit) && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedStatus('ALL');
                  setSelectedDormitory('ALL');
                  setOnlyOverWeeklyLimit(false);
                }}
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
            {filteredParcels.map((parcel) => {
              const dormTheme = getDormitoryTheme(parcel.dormitory);
              const isDelivered = parcel.status === 'ส่งมอบสำเร็จ';
              const isLegalHold = parcel.status === 'ติดนิติการ';
              const studentStats = !isUnknownOwnerParcel(parcel)
                ? getStudentParcelCounts(parcel.studentCode, parcel.studentFullName)
                : null;

              return (
                <div
                  key={parcel.id}
                  className={`p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    studentStats?.isOverWeeklyLimit
                      ? 'bg-red-50/40 hover:bg-red-50/70'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span
                        className="w-3.5 h-3.5 rounded-sm shrink-0"
                        style={{ backgroundColor: dormTheme.hexColor }}
                      />
                      <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                        {parcel.trackingNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-semibold text-slate-700">{parcel.courier}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`text-xs font-bold ${
                          isDelivered || parcel.status === 'ลงทะเบียนรับพัสดุ'
                            ? 'text-emerald-700'
                            : isLegalHold
                            ? 'text-red-700'
                            : parcel.status === 'พัสดุไม่ทราบเจ้าของ'
                            ? 'text-slate-600'
                            : 'text-blue-700'
                        }`}
                      >
                        สถานะ: {parcel.status === 'ติดนิติการ' ? 'พัสดุติดนิติการ' : parcel.status}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      {parcel.studentFullName}{' '}
                      <span className="font-normal text-slate-600">({parcel.nickname})</span>
                      <span className="mx-2 text-slate-300 font-normal">·</span>
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        รหัส {parcel.studentCode}
                      </span>
                      <span className="mx-2 text-slate-300 font-normal">·</span>
                      <span className="text-xs font-normal text-slate-600">ชั้น {parcel.gradeRoom}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {dormTheme.basketCode} ({parcel.dormitory})
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        ห้อง {parcel.dormRoom}
                      </span>
                      <span>·</span>
                      <span>ประเภท: {parcel.category}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        รับเข้า {parcel.receivedDate} เวลา {String(parcel.receivedHour).padStart(2, '0')}:00 น.
                      </span>
                      {parcel.status === 'ส่งมอบสำเร็จ' && (
                        <>
                          <span>·</span>
                          <span className="font-mono font-bold text-emerald-700 tabular-nums">
                            วันที่รับ: {formatThaiSlashDate(parcel.deliveredDate || parcel.receivedDate || parcel.updatedAt)}
                          </span>
                        </>
                      )}
                    </div>

                    {studentStats && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 pt-0.5 font-mono tabular-nums">
                        <span className="font-sans font-semibold text-slate-600">
                          จำนวนพัสดุของนักเรียน:
                        </span>
                        <span>
                          วัน <strong>{studentStats.dayCount}</strong> · สัปดาห์{' '}
                          <strong
                            className={
                              studentStats.isOverWeeklyLimit
                                ? 'text-red-600 font-extrabold'
                                : 'text-slate-900'
                            }
                          >
                            {studentStats.weekCount}
                          </strong>{' '}
                          · เดือน <strong>{studentStats.monthCount}</strong> ชิ้น
                        </span>
                        {studentStats.isOverWeeklyLimit && (
                          <button
                            type="button"
                            onClick={() => openWeeklyWarningPopup(studentStats, 'manual')}
                            className="font-sans px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์ (ดูแจ้งเตือน)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {parcel.note && (
                      <p className="text-xs text-slate-500 pt-0.5">หมายเหตุ: {parcel.note}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {parcel.status === 'ส่งมอบสำเร็จ' && (
                      <button
                        type="button"
                        onClick={() => updateParcelStatus(parcel.id, 'ลงทะเบียนรับพัสดุ', undefined, '')}
                        className="min-h-[44px] px-3.5 py-2 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>ยกเลิกการรับพัสดุ</span>
                      </button>
                    )}

                    {parcel.status !== 'ส่งมอบสำเร็จ' && (
                      <button
                        type="button"
                        onClick={() => updateParcelStatus(parcel.id, 'ส่งมอบสำเร็จ')}
                        className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ส่งมอบสำเร็จ</span>
                      </button>
                    )}

                    {parcel.status !== 'ติดนิติการ' && parcel.status !== 'ส่งมอบสำเร็จ' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateParcelStatus(
                            parcel.id,
                            'ติดนิติการ',
                            'ส่งตรวจห้องนิติการ/ครูหอพักตามระเบียบ'
                          )
                        }
                        className="min-h-[44px] px-3 py-2 bg-red-50 hover:bg-red-700 text-red-800 hover:text-white border border-red-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <AlertOctagon className="w-4 h-4" />
                        <span>พัสดุติดนิติการ</span>
                      </button>
                    )}

                    {parcel.status !== 'รอการยืนยัน' && parcel.status !== 'ส่งมอบสำเร็จ' && (
                      <button
                        type="button"
                        onClick={() => updateParcelStatus(parcel.id, 'รอการยืนยัน')}
                        className="min-h-[44px] px-3 py-2 bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Clock className="w-4 h-4" />
                        <span>รอการยืนยัน</span>
                      </button>
                    )}

                    <button
                      type="button"
                      aria-label={`ลบพัสดุ ${parcel.trackingNumber}`}
                      onClick={() => deleteParcel(parcel.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
