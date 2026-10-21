import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Boxes,
  PackageCheck,
  Clock,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  Parcel,
  ParcelStatus,
  PARCEL_STATUSES,
  getDormitoryTheme,
  compareDormitoryNatural,
  formatThaiSlashDate,
} from '../types/parcel';

export const BulkDeleteParcelsView: React.FC = () => {
  const {
    currentMember,
    parcels,
    bulkDeleteParcels,
    bulkDeleteParcelsByDorm,
    clearAllParcels,
    isSyncing,
    syncProgress,
    canCurrentMemberDelete,
    allowedMenusForCurrentMember,
  } = useParcelSystem();

  const hasAccess =
    currentMember?.role === 'ผู้ดูแลระบบ' ||
    Boolean(canCurrentMemberDelete) ||
    allowedMenusForCurrentMember.includes('bulk-delete');

  // Sub-tabs: 'by-dorm' | 'all' | 'custom'
  const [activeSubTab, setActiveSubTab] = useState<'by-dorm' | 'all' | 'custom'>('by-dorm');

  // Tab 1: By Dormitory state
  const [selectedDorm, setSelectedDorm] = useState<string>('');
  const [dormStatusFilter, setDormStatusFilter] = useState<string>('ALL');
  const [isDormConfirmOpen, setIsDormConfirmOpen] = useState(false);

  // Tab 2: Delete All state
  const [deleteAllScope, setDeleteAllScope] = useState<'completed_only' | 'entire_all'>('completed_only');
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');

  // Tab 3: Custom selection state
  const [customSearch, setCustomSearch] = useState('');
  const [customDormFilter, setCustomDormFilter] = useState('ALL');
  const [customStatusFilter, setCustomStatusFilter] = useState('ALL');
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
  const [isCustomConfirmOpen, setIsCustomConfirmOpen] = useState(false);

  // สรุปสถิติหอพักที่มีพัสดุ
  const dormStats = useMemo(() => {
    const map = new Map<string, { total: number; delivered: number; pending: number }>();
    for (const p of parcels) {
      const dorm = (p.dormitory || 'ไม่ระบุหอ').trim();
      const current = map.get(dorm) || { total: 0, delivered: 0, pending: 0 };
      current.total += 1;
      if (p.status === 'ส่งมอบสำเร็จ') {
        current.delivered += 1;
      } else {
        current.pending += 1;
      }
      map.set(dorm, current);
    }
    const entries = Array.from(map.entries()).sort((a, b) => compareDormitoryNatural(a[0], b[0]));
    return entries;
  }, [parcels]);

  // ตั้งค่าหอพักเริ่มต้นถ้ายังไม่ได้เลือก
  React.useEffect(() => {
    if (!selectedDorm && dormStats.length > 0) {
      setSelectedDorm(dormStats[0][0]);
    }
  }, [dormStats, selectedDorm]);

  // พัสดุในหอพักที่เลือก
  const dormFilteredParcels = useMemo(() => {
    if (!selectedDorm) return [];
    return parcels.filter((p) => {
      const dormMatch = (p.dormitory || 'ไม่ระบุหอ').trim() === selectedDorm;
      if (!dormMatch) return false;
      if (dormStatusFilter !== 'ALL' && p.status !== dormStatusFilter) return false;
      return true;
    });
  }, [parcels, selectedDorm, dormStatusFilter]);

  // พัสดุสำหรับการเลือกตามเงื่อนไข (Tab 3)
  const customFilteredParcels = useMemo(() => {
    const q = customSearch.trim().toLowerCase();
    return parcels.filter((p) => {
      if (customDormFilter !== 'ALL' && (p.dormitory || 'ไม่ระบุหอ').trim() !== customDormFilter) {
        return false;
      }
      if (customStatusFilter !== 'ALL' && p.status !== customStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.trackingNumber.toLowerCase().includes(q) ||
        p.studentCode.toLowerCase().includes(q) ||
        p.studentFullName.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.courier.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q)
      );
    });
  }, [parcels, customSearch, customDormFilter, customStatusFilter]);

  // สรุปสถิติภาพรวม
  const deliveredCount = useMemo(() => parcels.filter((p) => p.status === 'ส่งมอบสำเร็จ').length, [parcels]);
  const pendingCount = parcels.length - deliveredCount;

  // Handler: ลบทีละหอพัก
  const handleDeleteByDorm = async () => {
    if (!selectedDorm) return;
    setIsDormConfirmOpen(false);
    await bulkDeleteParcelsByDorm(selectedDorm, dormStatusFilter);
  };

  // Handler: ลบทั้งหมด
  const handleDeleteAll = async () => {
    setIsDeleteAllConfirmOpen(false);
    setConfirmInputText('');
    if (deleteAllScope === 'completed_only') {
      const completedIds = parcels
        .filter((p) => p.status === 'ส่งมอบสำเร็จ')
        .map((p) => p.id || p.trackingNumber);
      if (completedIds.length === 0) return;
      await bulkDeleteParcels(completedIds, 'เฉพาะที่ส่งมอบสำเร็จแล้ว');
    } else {
      await clearAllParcels();
    }
  };

  // Handler: ลบรายการที่เลือก (Custom)
  const handleDeleteCustomSelected = async () => {
    const ids = Array.from(selectedParcelIds);
    if (ids.length === 0) return;
    setIsCustomConfirmOpen(false);
    await bulkDeleteParcels(ids, 'รายการที่ผู้ใช้เลือกเอง');
    setSelectedParcelIds(new Set());
  };

  // Toggle select all in Tab 3
  const handleToggleSelectAllCustom = () => {
    if (selectedParcelIds.size === customFilteredParcels.length) {
      setSelectedParcelIds(new Set());
    } else {
      setSelectedParcelIds(new Set(customFilteredParcels.map((p) => p.id || p.trackingNumber)));
    }
  };

  const handleToggleParcelSelection = (id: string) => {
    setSelectedParcelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-xl mx-auto shadow-sm space-y-4">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">จำกัดสิทธิ์เฉพาะผู้ดูแลระบบหรือผู้ได้รับอนุญาต</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          เมนูการลบพัสดุจำนวนมากและการจัดการข้อมูลเชิงลึกนี้สงวนไว้สำหรับการดูแลของผู้ดูแลระบบหลัก (Admin) หรือสมาชิกที่ได้รับสิทธิ์ลบพัสดุเท่านั้น
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                การดูแลของผู้ดูแลระบบ
              </span>
              <span className="text-xs text-slate-400">Direct Live Firestore</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Trash2 className="w-7 h-7 text-red-400 shrink-0" />
              <span>ลบพัสดุจำนวนมากออกจากระบบ (Bulk Parcel Deletion)</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              จัดการลบประวัติพัสดุออกจากฐานข้อมูลแบบกลุ่ม ไม่ว่าจะเป็นการลบทีละหอพัก ล้างพัสดุทั้งหมด หรือเลือกลบตามช่วงเวลาและสถานะ
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10 text-center min-w-[100px]">
              <div className="text-[11px] text-slate-300 font-medium">พัสดุทั้งหมด</div>
              <div className="text-2xl font-black font-mono text-white tabular-nums">{parcels.length}</div>
              <div className="text-[10px] text-slate-400">ชิ้นในระบบ</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10 text-center min-w-[100px]">
              <div className="text-[11px] text-slate-300 font-medium">ส่งมอบแล้ว</div>
              <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">{deliveredCount}</div>
              <div className="text-[10px] text-slate-400">ชิ้นที่เซ็นรับแล้ว</div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/10 text-center min-w-[100px]">
              <div className="text-[11px] text-slate-300 font-medium">ยังค้างรับ</div>
              <div className="text-2xl font-black font-mono text-amber-400 tabular-nums">{pendingCount}</div>
              <div className="text-[10px] text-slate-400">ชิ้นรอรับ</div>
            </div>
          </div>
        </div>

        {/* Progress bar when syncing */}
        {isSyncing && syncProgress && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                กำลังดำเนินการลบพัสดุออกจาก Firestore...
              </span>
              <span className="font-mono tabular-nums">
                {syncProgress.completed} / {syncProgress.total} รายการ ({Math.round((syncProgress.completed / Math.max(1, syncProgress.total)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-200"
                style={{ width: `${(syncProgress.completed / Math.max(1, syncProgress.total)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveSubTab('by-dorm')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'by-dorm'
              ? 'bg-white text-red-700 border-t-2 border-x border-slate-200 border-t-red-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-red-600" />
          <span>ลบทีละหอพัก</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-50 text-red-700 font-mono">
            {dormStats.length} หอ
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('all')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'all'
              ? 'bg-white text-red-700 border-t-2 border-x border-slate-200 border-t-red-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>ลบพัสดุทั้งหมด</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-100 text-red-800 font-mono font-bold">
            Danger Zone
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('custom')}
          className={`px-5 py-3 rounded-t-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'custom'
              ? 'bg-white text-red-700 border-t-2 border-x border-slate-200 border-t-red-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>เลือกรายการลบตามเงื่อนไข</span>
          {selectedParcelIds.size > 0 && (
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-600 text-white font-mono font-bold">
              เลือก {selectedParcelIds.size}
            </span>
          )}
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: ลบทีละหอพัก */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'by-dorm' && (
        <div className="space-y-6">
          {/* หอพัก Selection Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <span>เลือกหอพักที่ต้องการลบพัสดุ</span>
                </h3>
                <p className="text-xs text-slate-500">
                  คลิกเลือกหอพักเพื่อตรวจสอบรายการพัสดุ และลบออกจากฐานข้อมูล
                </p>
              </div>
              <div className="text-xs text-slate-500">
                รวมทั้งหมด <strong className="text-slate-900 font-mono">{dormStats.length}</strong> หอพักที่มีพัสดุ
              </div>
            </div>

            {dormStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                ขณะนี้ไม่มีพัสดุในระบบเลย
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {dormStats.map(([dormName, stats]) => {
                  const theme = getDormitoryTheme(dormName);
                  const isSelected = selectedDorm === dormName;
                  return (
                    <button
                      key={dormName}
                      type="button"
                      onClick={() => setSelectedDorm(dormName)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-900 truncate" title={dormName}>
                          {dormName}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-mono font-black text-slate-900 tabular-nums">
                          {stats.total}
                        </span>
                        <span className="text-[10px] text-slate-500">ชิ้น</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span>ส่งมอบ {stats.delivered}</span>
                        <span>ค้าง {stats.pending}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dormitory Details & Delete Controls */}
          {selectedDorm && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                      หอพักที่เลือก
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">{selectedDorm}</h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    มีพัสดุตรงกับเงื่อนไขจำนวน{' '}
                    <strong className="text-red-600 font-mono text-sm">{dormFilteredParcels.length}</strong> ชิ้น
                  </p>
                </div>

                {/* Filter and Action button */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="dorm-status-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">กรองสถานะ:</label>
                    <select
                      id="dorm-status-select"
                      aria-label="กรองสถานะพัสดุหอพัก"
                      value={dormStatusFilter}
                      onChange={(e) => setDormStatusFilter(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                    >
                      <option value="ALL">ทุกสถานะ ({dormFilteredParcels.length})</option>
                      <option value="ส่งมอบสำเร็จ">เฉพาะ 'ส่งมอบสำเร็จ' แล้ว</option>
                      <option value="ลงทะเบียนรับพัสดุ">เฉพาะ 'ลงทะเบียนรับพัสดุ'</option>
                      <option value="รับเข้าส่วนกลาง">เฉพาะ 'รับเข้าส่วนกลาง'</option>
                      <option value="ติดต่องานพยาบาล">เฉพาะ 'ติดต่องานพยาบาล'</option>
                      <option value="ติดนิติการ">เฉพาะ 'ติดนิติการ'</option>
                      <option value="พัสดุไม่ทราบเจ้าของ">เฉพาะ 'ไม่ทราบเจ้าของ'</option>
                      <option value="รอการยืนยัน">เฉพาะ 'รอการยืนยัน'</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDormConfirmOpen(true)}
                    disabled={dormFilteredParcels.length === 0 || isSyncing}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ลบพัสดุของหอพักนี้ ({dormFilteredParcels.length} ชิ้น)</span>
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">เลขพัสดุ (Tracking)</th>
                      <th className="py-2.5 px-3">รหัส/ชื่อผู้รับ</th>
                      <th className="py-2.5 px-3">ห้อง/เตียง</th>
                      <th className="py-2.5 px-3">ขนส่ง</th>
                      <th className="py-2.5 px-3">วันที่รับเข้า</th>
                      <th className="py-2.5 px-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dormFilteredParcels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          ไม่พบรายการพัสดุตามเงื่อนไขที่เลือก
                        </td>
                      </tr>
                    ) : (
                      dormFilteredParcels.slice(0, 50).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{p.studentFullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.studentCode}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {p.dormRoom !== '-' ? `ห้อง ${p.dormRoom}` : ''} {p.bed !== '-' ? `เตียง ${p.bed}` : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{p.courier}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono">{formatThaiSlashDate(p.receivedDate)}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                p.status === 'ส่งมอบสำเร็จ'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {dormFilteredParcels.length > 50 && (
                <div className="text-center text-xs text-slate-500">
                  แสดงตัวอย่าง 50 จาก {dormFilteredParcels.length} รายการ (การลบจะลบครบทั้ง {dormFilteredParcels.length} รายการ)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: ลบพัสดุทั้งหมด (Danger Zone) */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'all' && (
        <div className="bg-white rounded-3xl border-2 border-red-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1 flex-1">
              <h2 className="text-lg md:text-xl font-extrabold text-red-950">
                โซนอันตราย: ลบพัสดุทั้งหมดออกจากระบบ (System Bulk Cleanse)
              </h2>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                ฟังก์ชันนี้จะทำการลบข้อมูลพัสดุออกจากฐานข้อมูล Firebase Firestore ถาวร ข้อมูลจะไม่สามารถกู้คืนได้ ยกเว้นท่านได้ทำการสำรองข้อมูลไว้แล้ว
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                deleteAllScope === 'completed_only'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="deleteAllScope"
                  checked={deleteAllScope === 'completed_only'}
                  onChange={() => setDeleteAllScope('completed_only')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                    <span>ลบเฉพาะพัสดุที่ 'ส่งมอบสำเร็จ' แล้ว</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                      แนะนำ (ปลอดภัย)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ล้างเฉพาะพัสดุที่นักเรียนเซ็นรับของเรียบร้อยแล้วจำนวน{' '}
                    <strong className="text-emerald-700 font-mono">{deliveredCount}</strong> ชิ้น
                    โดยจะยังคงเก็บพัสดุที่กำลังดำเนินการอีก{' '}
                    <strong className="text-slate-900 font-mono">{pendingCount}</strong> ชิ้นไว้
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                deleteAllScope === 'entire_all'
                  ? 'border-red-600 bg-red-50/60 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="deleteAllScope"
                  checked={deleteAllScope === 'entire_all'}
                  onChange={() => setDeleteAllScope('entire_all')}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="font-bold text-red-950 text-sm flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>ลบพัสดุทั้งหมดทุกสถานะ (100%)</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-900 text-[10px] font-mono font-bold">
                      ล้างเกลี้ยง
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ลบพัสดุทุกรายการทั้งที่ส่งมอบแล้วและยังไม่ได้รับ รวม{' '}
                    <strong className="text-red-700 font-mono">{parcels.length}</strong> ชิ้น
                    ออกจากฐานข้อมูล Firestore ให้กลับเป็น 0
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Action Trigger */}
          <div className="bg-red-50/80 rounded-2xl border border-red-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-red-900 leading-relaxed">
              <span className="font-bold">สรุปรายการที่จะถูกลบ: </span>
              {deleteAllScope === 'completed_only' ? (
                <span>
                  พัสดุที่ส่งมอบสำเร็จแล้วจำนวน <strong className="font-mono text-sm">{deliveredCount}</strong> ชิ้น
                </span>
              ) : (
                <span>
                  พัสดุทั้งหมดทุกสถานะจำนวน <strong className="font-mono text-sm">{parcels.length}</strong> ชิ้น
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmInputText('');
                setIsDeleteAllConfirmOpen(true);
              }}
              disabled={parcels.length === 0 || isSyncing}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>เริ่มขั้นตอนยืนยันการลบ</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: เลือกลบตามเงื่อนไข (Custom Filter & Selection) */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'custom' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-5">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาเลข Tracking, ชื่อ, รหัส..."
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <select
                aria-label="กรองตามหอพัก"
                value={customDormFilter}
                onChange={(e) => setCustomDormFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="ALL">ทุกหอพัก</option>
                {dormStats.map(([d]) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                aria-label="กรองตามสถานะพัสดุ"
                value={customStatusFilter}
                onChange={(e) => setCustomStatusFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="ALL">ทุกสถานะ</option>
                {PARCEL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action header with selection controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSelectAllCustom}
                className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-indigo-600 cursor-pointer"
              >
                {selectedParcelIds.size > 0 && selectedParcelIds.size === customFilteredParcels.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedParcelIds.size === customFilteredParcels.length && customFilteredParcels.length > 0
                    ? 'ยกเลิกเลือกทั้งหมด'
                    : 'เลือกทั้งหมดตามที่กรอง'}
                </span>
              </button>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">
                เลือกแล้ว <strong className="text-indigo-600 font-mono font-bold">{selectedParcelIds.size}</strong> จาก{' '}
                <strong className="text-slate-900 font-mono">{customFilteredParcels.length}</strong> รายการ
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCustomConfirmOpen(true)}
              disabled={selectedParcelIds.size === 0 || isSyncing}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 text-xs shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบรายการที่เลือก ({selectedParcelIds.size} ชิ้น)</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">เลือก</th>
                  <th className="py-2.5 px-3">เลขพัสดุ (Tracking)</th>
                  <th className="py-2.5 px-3">ชื่อนักเรียน</th>
                  <th className="py-2.5 px-3">หอพัก/ห้อง</th>
                  <th className="py-2.5 px-3">ขนส่ง</th>
                  <th className="py-2.5 px-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customFilteredParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      ไม่พบข้อมูลพัสดุตามเงื่อนไขที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  customFilteredParcels.slice(0, 100).map((p) => {
                    const isChecked = selectedParcelIds.has(p.id || p.trackingNumber);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleToggleParcelSelection(p.id || p.trackingNumber)}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? 'bg-red-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleParcelSelection(p.id || p.trackingNumber)}
                            className="rounded-sm text-red-600 focus:ring-red-500"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{p.studentFullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.studentCode}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-800">{p.dormitory}</div>
                          <div className="text-[10px] text-slate-400">
                            {p.dormRoom !== '-' ? `ห้อง ${p.dormRoom}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{p.courier}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.status === 'ส่งมอบสำเร็จ'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {customFilteredParcels.length > 100 && (
            <div className="text-center text-xs text-slate-500">
              แสดง 100 จาก {customFilteredParcels.length} รายการ (ใช้ช่องค้นหาเพื่อเจาะจงรายการเพิ่มเติม)
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: Confirm Delete By Dorm */}
      {/* --------------------------------------------------------------------- */}
      {isDormConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200">
            <div className="flex items-center gap-3 border-b border-red-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">ยืนยันการลบพัสดุหอพัก</h3>
                <p className="text-xs text-slate-500">โปรดตรวจสอบก่อนดำเนินการ</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="bg-red-50 p-3 rounded-xl border border-red-200 space-y-1">
                <div>
                  หอพัก: <strong className="text-red-900 text-sm font-bold">{selectedDorm}</strong>
                </div>
                <div>
                  เงื่อนไขสถานะ:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {dormStatusFilter === 'ALL' ? 'ทุกสถานะ' : dormStatusFilter}
                  </strong>
                </div>
                <div>
                  จำนวนที่จะถูกลบ:{' '}
                  <strong className="text-red-600 font-mono text-base font-black">
                    {dormFilteredParcels.length}
                  </strong>{' '}
                  ชิ้น
                </div>
              </div>
              <p className="text-slate-500">
                พัสดุเหล่านี้จะถูกลบออกจากฐานข้อมูล Firebase Firestore แบบถาวรทันที
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDormConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteByDorm}
                disabled={isSyncing}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบพัสดุ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: Confirm Delete All (Typing Guard) */}
      {/* --------------------------------------------------------------------- */}
      {isDeleteAllConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl border-2 border-red-500">
            <div className="flex items-center gap-3.5 border-b border-red-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-red-950 text-lg">ยืนยันการล้างข้อมูลพัสดุ</h3>
                <p className="text-xs text-red-600 font-semibold">การกระทำนี้มีผลถาวร ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200 space-y-2">
                <div className="font-bold text-red-900 text-sm">
                  {deleteAllScope === 'completed_only'
                    ? `ลบเฉพาะพัสดุที่ 'ส่งมอบสำเร็จ' แล้ว (${deliveredCount} ชิ้น)`
                    : `ลบพัสดุทั้งหมดทุกสถานะในระบบ (${parcels.length} ชิ้น)`}
                </div>
                <p className="text-slate-600">
                  ระบบจะทำการลบเอกสารพัสดุออกจากคอลเลกชัน Firestore โดยตรง กรุณาตรวจสอบให้แน่ใจว่าได้ทำการดาวน์โหลดไฟล์สำรองข้อมูลไว้แล้ว
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="font-bold text-slate-900">
                  พิมพ์คำว่า <span className="text-red-600 font-mono font-black">DELETE ALL</span> เพื่อปลดล็อกปุ่มลบ:
                </label>
                <input
                  type="text"
                  placeholder="พิมพ์ DELETE ALL ตรงนี้"
                  value={confirmInputText}
                  onChange={(e) => setConfirmInputText(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl focus:border-red-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteAllConfirmOpen(false);
                  setConfirmInputText('');
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={confirmInputText.trim().toUpperCase() !== 'DELETE ALL' || isSyncing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันล้างข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: Confirm Custom Selected Deletion */}
      {/* --------------------------------------------------------------------- */}
      {isCustomConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200">
            <div className="flex items-center gap-3 border-b border-red-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">ยืนยันการลบรายการที่เลือก</h3>
                <p className="text-xs text-slate-500">ลบเฉพาะรายการที่คุณทำเครื่องหมาย</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                จำนวนรายการที่เลือก:{' '}
                <strong className="text-red-600 font-mono text-base font-black">
                  {selectedParcelIds.size}
                </strong>{' '}
                ชิ้น
              </div>
              <p className="text-slate-500">
                ต้องการลบพัสดุเหล่านี้ออกจากฐานข้อมูลอย่างถาวรหรือไม่?
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomConfirmOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomSelected}
                disabled={isSyncing}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบ ({selectedParcelIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
