import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  TrendingUp,
  Clock,
  AlertOctagon,
  PackageCheck,
  PackagePlus,
  Trash2,
  AlertTriangle,
  Users,
  HeartHandshake,
  Search,
  CheckCircle2,
  ShieldAlert,
  Filter,
  X,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  getDormitoryTheme,
  getAvailableDormitories,
  getRelativeDateString,
  WEEKLY_PARCEL_WARNING_LIMIT,
  formatStudentCode,
} from '../types/parcel';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const DashboardView: React.FC = () => {
  const {
    parcels,
    students,
    allStudentParcelStats,
    overWeeklyLimitStudents,
    overLimitStudents,
    parcelRateLimitConfig,
    openWeeklyWarningPopup,
    clearAllLocalData,
    currentMember,
  } = useParcelSystem();

  const isAdmin = currentMember?.role === 'ผู้ดูแลระบบ';

  const [studentSearchKeyword, setStudentSearchKeyword] = React.useState<string>('');
  const [watchlistFilter, setWatchlistFilter] = React.useState<
    'all' | 'over_limit' | 'daily' | 'weekly' | 'monthly' | 'normal'
  >('all');

  const sortedStudentStats = useMemo(() => {
    const q = studentSearchKeyword.trim().toLowerCase();
    return [...allStudentParcelStats]
      .filter((s) => {
        // กรองตามคำค้นหา
        if (q) {
          const matchCode = s.studentCode.toLowerCase().includes(q);
          const matchFormatted = formatStudentCode(s.studentCode).toLowerCase().includes(q);
          const matchName = s.studentFullName.toLowerCase().includes(q);
          const matchNick = (s.nickname || '').toLowerCase().includes(q);
          const matchDorm = (s.dormitory || '').toLowerCase().includes(q);
          const matchGrade = (s.gradeRoom || '').toLowerCase().includes(q);
          if (!matchCode && !matchFormatted && !matchName && !matchNick && !matchDorm && !matchGrade) {
            return false;
          }
        }

        // กรองตามสถานะเฝ้าระวัง
        if (watchlistFilter === 'over_limit') return s.isOverLimit;
        if (watchlistFilter === 'daily') return s.isOverDailyLimit;
        if (watchlistFilter === 'weekly') return s.isOverWeeklyLimit;
        if (watchlistFilter === 'monthly') return s.isOverMonthlyLimit;
        if (watchlistFilter === 'normal') return !s.isOverLimit;

        // ค่าเริ่มต้น: แสดงนักเรียนที่มีพัสดุ หรือกรณีนักเรียนน้อยกว่าหรือเท่ากับ 50 คนให้แสดงทั้งหมด
        return s.totalCount > 0 || students.length <= 50;
      })
      .sort((a, b) => {
        // เรียงลำดับนักเรียนที่เกินเกณฑ์ขึ้นก่อน
        if (a.isOverLimit && !b.isOverLimit) return -1;
        if (!a.isOverLimit && b.isOverLimit) return 1;
        return (
          b.weekCount - a.weekCount ||
          b.dayCount - a.dayCount ||
          b.monthCount - a.monthCount ||
          a.studentCode.localeCompare(b.studentCode, 'th', { numeric: true })
        );
      });
  }, [allStudentParcelStats, students.length, studentSearchKeyword, watchlistFilter]);

  const todayStr = getRelativeDateString(0);

  // 1. คำนวณตัวเลข KPI หลัก
  const kpiStats = useMemo(() => {
    let inboundToday = 0;
    let pendingDelivery = 0;
    let legalHold = 0;
    let infirmary = 0;
    let delivered = 0;

    for (const p of parcels) {
      if (p.receivedDate === todayStr) {
        inboundToday += 1;
      }
      if (p.status === 'ส่งมอบสำเร็จ') {
        delivered += 1;
      } else {
        pendingDelivery += 1;
      }
      if (p.status === 'ติดนิติการ') {
        legalHold += 1;
      }
      if (p.status === 'ติดต่องานพยาบาล') {
        infirmary += 1;
      }
    }

    const deliveryRate =
      parcels.length > 0 ? Math.round((delivered / parcels.length) * 100) : 0;

    return {
      inboundToday,
      pendingDelivery,
      legalHold,
      infirmary,
      delivered,
      deliveryRate,
    };
  }, [parcels, todayStr]);

  // 2. ข้อมูลกราฟเส้น (Line Chart) เปรียบเทียบจำนวนพัสดุย้อนหลัง 7 วัน
  const weeklyChartData = useMemo(() => {
    const days: { dateStr: string; label: string; inbound: number; delivered: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dStr = getRelativeDateString(i);
      const parts = dStr.split('-');
      const shortLabel = i === 0 ? `วันนี้ (${parts[2]}/${parts[1]})` : `${parts[2]}/${parts[1]}`;
      days.push({ dateStr: dStr, label: shortLabel, inbound: 0, delivered: 0 });
    }

    for (const p of parcels) {
      const target = days.find((d) => d.dateStr === p.receivedDate);
      if (target) {
        target.inbound += 1;
        if (p.status === 'ส่งมอบสำเร็จ') {
          target.delivered += 1;
        }
      }
    }

    return {
      labels: days.map((d) => d.label),
      datasets: [
        {
          label: 'พัสดุรับเข้าทั้งหมด (ชิ้น)',
          data: days.map((d) => d.inbound),
          borderColor: '#0F172A',
          backgroundColor: 'rgba(15, 23, 42, 0.08)',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#0F172A',
        },
        {
          label: 'ส่งมอบสำเร็จแล้ว (ชิ้น)',
          data: days.map((d) => d.delivered),
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.05)',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: '#059669',
        },
      ],
    };
  }, [parcels]);

  // 3. วิเคราะห์ "ช่วงเวลาพีคสุด (Peak Hours)" ตั้งแต่ 08:00 - 19:00 น.
  const peakHoursAnalysis = useMemo(() => {
    const hoursRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const countsByHour: Record<number, number> = {};
    for (const h of hoursRange) countsByHour[h] = 0;

    for (const p of parcels) {
      const hr = Number(p.receivedHour);
      if (countsByHour[hr] !== undefined) {
        countsByHour[hr] += 1;
      } else if (hr < 8) {
        countsByHour[8] += 1;
      } else {
        countsByHour[18] += 1;
      }
    }

    let maxHour = 13;
    let maxCount = 0;
    for (const h of hoursRange) {
      if (countsByHour[h] > maxCount) {
        maxCount = countsByHour[h];
        maxHour = h;
      }
    }

    const barColors = hoursRange.map((h) =>
      maxCount > 0 && h === maxHour
        ? '#DC2626'
        : maxCount > 0 && countsByHour[h] >= Math.max(1, maxCount - 1)
        ? '#D97706'
        : '#334155'
    );

    return {
      maxHour,
      maxHourWindow:
        maxCount > 0
          ? `${String(maxHour).padStart(2, '0')}:00 - ${String(maxHour + 1).padStart(2, '0')}:00 น.`
          : 'ยังไม่มีข้อมูลพัสดุรับเข้า',
      maxCount,
      chartData: {
        labels: hoursRange.map((h) => `${String(h).padStart(2, '0')}:00`),
        datasets: [
          {
            label: 'จำนวนพัสดุรับเข้าตามช่วงเวลา (ชิ้น)',
            data: hoursRange.map((h) => countsByHour[h]),
            backgroundColor: barColors,
            borderRadius: 6,
          },
        ],
      },
    };
  }, [parcels]);

  // 4. สรุปจำนวนพัสดุแยกตามหอพักที่มีอยู่จริงในระบบ
  const dormitoryBreakdown = useMemo(() => {
    const dormNames = getAvailableDormitories(students, parcels);
    return dormNames.map((dormKey) => {
      const theme = getDormitoryTheme(dormKey);
      const dormParcels = parcels.filter((p) => p.dormitory === dormKey);
      const pending = dormParcels.filter((p) => p.status !== 'ส่งมอบสำเร็จ').length;
      const legal = dormParcels.filter((p) => p.status === 'ติดนิติการ').length;
      const done = dormParcels.filter((p) => p.status === 'ส่งมอบสำเร็จ').length;
      const dormStudents = students.filter((s) => s.dormitory === dormKey).length;

      return {
        dormKey,
        theme,
        total: dormParcels.length,
        pending,
        legal,
        done,
        dormStudents,
      };
    });
  }, [parcels, students]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-500">
            ระบบวิเคราะห์ปริมาณพัสดุหอพัก · Chart.js Analytics & Peak Hours Intelligence
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            แดชบอร์ดสรุปสถิติและวิเคราะห์ช่วงเวลาพีคสุด (Analytics Dashboard)
          </h1>
        </div>

        {isAdmin && (students.length > 0 || parcels.length > 0) && (
          <button
            type="button"
            onClick={clearAllLocalData}
            className="min-h-[44px] px-4 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 self-start md:self-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>ล้างข้อมูลในเครื่องทั้งหมด</span>
          </button>
        )}
      </div>

      {/* ตัวเลขสรุป KPI รวมสถานะพัสดุ (Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* 1. พัสดุรับเข้าวันนี้: โทนสีฟ้า-น้ำเงิน */}
        <div className="bg-white border border-sky-300 rounded-2xl p-5 space-y-2 bg-gradient-to-b from-sky-50/60 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-900">พัสดุรับเข้าวันนี้</span>
            <PackagePlus className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-sky-700 tabular-nums">
            {kpiStats.inboundToday}
          </div>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            วันที่ {todayStr} · จากทั้งหมด {parcels.length} ชิ้น
          </p>
        </div>

        {/* 2. พัสดุค้างจ่าย (รอนำส่ง/รอรับ): โทนสีเทา-ดำ */}
        <div className="bg-white border border-slate-400/80 rounded-2xl p-5 space-y-2 bg-gradient-to-b from-slate-100 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">พัสดุค้างจ่าย (รอนำส่ง/รอรับ)</span>
            <Clock className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
            {kpiStats.pendingDelivery}
          </div>
          <p className="text-xs text-slate-500">
            รอการส่งมอบและเซ็นรับพัสดุประจำหอพัก
          </p>
        </div>

        {/* 3. พัสดุติดต่องานพยาบาล: ต้นแบบโทนสีส้มอำพัน */}
        <div className="bg-white border border-amber-300 rounded-2xl p-5 space-y-2 bg-gradient-to-b from-amber-50/60 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">พัสดุติดต่องานพยาบาล</span>
            <HeartHandshake className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-amber-600 tabular-nums">
            {kpiStats.infirmary}
          </div>
          <p className="text-xs text-slate-500">
            พัสดุยารักษาโรค/เวชภัณฑ์ ส่งงานพยาบาล
          </p>
        </div>

        {/* 4. พัสดุติดนิติการ: โทนสีแดง */}
        <div className="bg-white border border-red-300 rounded-2xl p-5 space-y-2 bg-gradient-to-b from-red-50/60 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-900">พัสดุติดนิติการ</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-red-600 tabular-nums">
            {kpiStats.legalHold}
          </div>
          <p className="text-xs text-slate-500">
            รอครูประจำหอพักและนักเรียนเปิดตรวจสอบร่วมกัน
          </p>
        </div>

        {/* 5. ส่งมอบสำเร็จแล้ว: โทนสีเขียว */}
        <div className="bg-white border border-emerald-300 rounded-2xl p-5 space-y-2 bg-gradient-to-b from-emerald-50/60 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">ส่งมอบสำเร็จแล้ว</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-emerald-700 tabular-nums">
            {kpiStats.delivered}{' '}
            <span className="text-sm font-semibold text-emerald-600/80">({kpiStats.deliveryRate}%)</span>
          </div>
          <p className="text-xs text-slate-500">
            นักเรียนลงชื่อรับพัสดุที่หอพักเรียบร้อยแล้ว
          </p>
        </div>
      </div>

      {/* กราฟเส้นเปรียบเทียบรายวัน/สัปดาห์ & กราฟวิเคราะห์ช่วงเวลาพีคสุด (Peak Hours) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                <span>กราฟเส้นเปรียบเทียบจำนวนพัสดุย้อนหลัง 7 วัน (Weekly Trend)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบจำนวนพัสดุรับเข้าใหม่ เทียบกับจำนวนที่ส่งมอบให้นักเรียนสำเร็จในแต่ละวัน
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <Line
              data={weeklyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      font: { family: "'Plus Jakarta Sans', 'Sarabun', sans-serif", size: 12 },
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 },
                  },
                },
              }}
            />
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-600" />
              <span>วิเคราะห์ช่วงเวลาพีคสุด (Peak Hours Analysis)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ช่วงเวลาที่มีรถขนส่งนำพัสดุเข้าจุดคัดแยกมากที่สุดในรอบวัน (08:00 - 18:00 น.)
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-500">
                ช่วงเวลาที่มีพัสดุเข้ามากที่สุด (Peak Window)
              </span>
              <div className="text-lg font-mono font-extrabold text-red-700 mt-0.5 tabular-nums">
                {peakHoursAnalysis.maxHourWindow}
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="block text-2xl font-extrabold text-slate-900 tabular-nums">
                {peakHoursAnalysis.maxCount}
              </span>
              <span className="text-xs text-slate-500">ชิ้น/ชั่วโมง</span>
            </div>
          </div>

          <div className="h-56 w-full">
            <Bar
              data={peakHoursAnalysis.chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, precision: 0 },
                  },
                },
              }}
            />
          </div>
        </section>
      </div>

      {/* ตารางสรุปการนับจำนวนพัสดุของนักเรียนแต่ละคน (วัน, สัปดาห์, เดือน) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>
                  สรุปการนับจำนวนพัสดุของนักเรียนแต่ละคน (วัน / สัปดาห์ / เดือน)
                </span>
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                สถานะเฝ้าระวังปรับตามอัตรากำหนด
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              นับยอดรับลงทะเบียน: รายวัน (วันนี้) · รายสัปดาห์ (จันทร์ - อาทิตย์) · รายเดือน (1 - สิ้นเดือน) และสถานะเฝ้าระวังที่ปรับตามการตั้งค่าอัตราพัสดุ
            </p>
          </div>

          {overLimitStudents.length > 0 && (
            <button
              type="button"
              onClick={() => openWeeklyWarningPopup(overLimitStudents[0], 'manual')}
              className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 self-start lg:self-auto cursor-pointer shadow-xs transition-colors"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                เปิดดู POPUP นักเรียนเกินเกณฑ์เฝ้าระวัง ({overLimitStudents.length} คน)
              </span>
            </button>
          )}
        </div>

        {/* แถบแสดงอัตราโควตาที่เปิดใช้งานอยู่ในระบบปัจจุบัน */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            <span>เกณฑ์อัตราพัสดุที่บังคับใช้อยู่:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold ${
                parcelRateLimitConfig.daily.enabled
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              รายวัน:{' '}
              {parcelRateLimitConfig.daily.enabled
                ? `ไม่เกิน ${parcelRateLimitConfig.daily.limit} ชิ้น/วัน`
                : 'ไม่กำหนด'}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold ${
                parcelRateLimitConfig.weekly.enabled
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              รายสัปดาห์:{' '}
              {parcelRateLimitConfig.weekly.enabled
                ? `ไม่เกิน ${parcelRateLimitConfig.weekly.limit} ชิ้น/สัปดาห์`
                : 'ไม่กำหนด'}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold ${
                parcelRateLimitConfig.monthly.enabled
                  ? 'bg-purple-50 text-purple-900 border-purple-300'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              รายเดือน:{' '}
              {parcelRateLimitConfig.monthly.enabled
                ? `ไม่เกิน ${parcelRateLimitConfig.monthly.limit} ชิ้น/เดือน`
                : 'ไม่กำหนด'}
            </span>
          </div>
        </div>

        {/* ตัวกรองสถานะเฝ้าระวัง และช่องค้นหานักเรียน */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* แถบตัวกรอง */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setWatchlistFilter('all')}
              className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                watchlistFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ทั้งหมด ({allStudentParcelStats.filter((s) => s.totalCount > 0 || students.length <= 50).length})
            </button>

            <button
              type="button"
              onClick={() => setWatchlistFilter('over_limit')}
              className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1 cursor-pointer ${
                watchlistFilter === 'over_limit'
                  ? 'bg-red-600 text-white border-red-600 font-bold'
                  : overLimitStudents.length > 0
                  ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>สถานะเฝ้าระวัง (เกินเกณฑ์: {overLimitStudents.length})</span>
            </button>

            {parcelRateLimitConfig.daily.enabled && (
              <button
                type="button"
                onClick={() => setWatchlistFilter('daily')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  watchlistFilter === 'daily'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                เกินรายวัน ({allStudentParcelStats.filter((s) => s.isOverDailyLimit).length})
              </button>
            )}

            {parcelRateLimitConfig.weekly.enabled && (
              <button
                type="button"
                onClick={() => setWatchlistFilter('weekly')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  watchlistFilter === 'weekly'
                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                เกินรายสัปดาห์ ({allStudentParcelStats.filter((s) => s.isOverWeeklyLimit).length})
              </button>
            )}

            {parcelRateLimitConfig.monthly.enabled && (
              <button
                type="button"
                onClick={() => setWatchlistFilter('monthly')}
                className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  watchlistFilter === 'monthly'
                    ? 'bg-purple-600 text-white border-purple-600 font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                เกินรายเดือน ({allStudentParcelStats.filter((s) => s.isOverMonthlyLimit).length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setWatchlistFilter('normal')}
              className={`px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1 cursor-pointer ${
                watchlistFilter === 'normal'
                  ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ปกติ (ไม่เกินเกณฑ์)</span>
            </button>
          </div>

          {/* ช่องค้นหานักเรียน */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="ค้นหานักเรียนในตารางสถิติ"
              value={studentSearchKeyword}
              onChange={(e) => setStudentSearchKeyword(e.target.value)}
              placeholder="ค้นหารหัส, ชื่อ หรือหอพัก..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
            />
            {studentSearchKeyword && (
              <button
                type="button"
                aria-label="ล้างคำค้นหา"
                onClick={() => setStudentSearchKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {sortedStudentStats.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500">
            {studentSearchKeyword || watchlistFilter !== 'all'
              ? 'ไม่พบข้อมูลนักเรียนที่ตรงกับเงื่อนไขการค้นหา/ตัวกรอง'
              : 'ยังไม่มีข้อมูลนักเรียนหรือรายการพัสดุในระบบ'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-bold shadow-2xs z-10">
                <tr>
                  <th className="py-3 px-4">รหัสนักเรียน</th>
                  <th className="py-3 px-4">ชื่อ-นามสกุล (ชื่อเล่น)</th>
                  <th className="py-3 px-4">ระดับชั้น/ห้อง</th>
                  <th className="py-3 px-4">หอพัก / ห้อง</th>
                  <th className="py-3 px-4 text-center">
                    <div>รายวัน (วันนี้)</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {parcelRateLimitConfig.daily.enabled
                        ? `เกณฑ์: ≤ ${parcelRateLimitConfig.daily.limit}`
                        : 'ไม่จำกัด'}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <div>รายสัปดาห์ (จ.-อา.)</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {parcelRateLimitConfig.weekly.enabled
                        ? `เกณฑ์: ≤ ${parcelRateLimitConfig.weekly.limit}`
                        : 'ไม่จำกัด'}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <div>รายเดือน (1-สิ้นเดือน)</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {parcelRateLimitConfig.monthly.enabled
                        ? `เกณฑ์: ≤ ${parcelRateLimitConfig.monthly.limit}`
                        : 'ไม่จำกัด'}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">ยอดรวมสะสม</th>
                  <th className="py-3 px-4 text-center min-w-[200px]">สถานะเฝ้าระวัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedStudentStats.map((st) => {
                  const theme = getDormitoryTheme(st.dormitory);
                  return (
                    <tr
                      key={st.studentKey}
                      className={`transition-colors ${
                        st.isOverLimit
                          ? 'bg-red-50/70 hover:bg-red-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                        {formatStudentCode(st.studentCode)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {st.studentFullName}{' '}
                        {st.nickname && st.nickname !== '-' && (
                          <span className="font-normal text-slate-500">({st.nickname})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">
                        {st.gradeRoom}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: theme.hexColor }}
                          />
                          <span className="font-medium text-slate-800">
                            {st.dormitory} ({st.dormRoom})
                          </span>
                        </div>
                      </td>

                      {/* 1. รายวัน (วันนี้) */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold tabular-nums ${
                            st.isOverDailyLimit
                              ? 'bg-red-100 text-red-700 font-extrabold ring-1 ring-red-300'
                              : 'text-slate-900'
                          }`}
                        >
                          {st.dayCount} ชิ้น
                        </span>
                        {st.isOverDailyLimit && (
                          <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                            เกินเกณฑ์
                          </div>
                        )}
                      </td>

                      {/* 2. รายสัปดาห์ (จันทร์ - อาทิตย์) */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold tabular-nums ${
                            st.isOverWeeklyLimit
                              ? 'bg-red-100 text-red-700 font-extrabold ring-1 ring-red-300'
                              : 'text-slate-900'
                          }`}
                        >
                          {st.weekCount} ชิ้น
                        </span>
                        {st.isOverWeeklyLimit && (
                          <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                            เกินเกณฑ์
                          </div>
                        )}
                      </td>

                      {/* 3. รายเดือน (1 ถึงวันสุดท้ายของเดือน) */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg font-mono font-bold tabular-nums ${
                            st.isOverMonthlyLimit
                              ? 'bg-red-100 text-red-700 font-extrabold ring-1 ring-red-300'
                              : 'text-slate-900'
                          }`}
                        >
                          {st.monthCount} ชิ้น
                        </span>
                        {st.isOverMonthlyLimit && (
                          <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                            เกินเกณฑ์
                          </div>
                        )}
                      </td>

                      {/* ยอดรวมสะสม */}
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-700 tabular-nums">
                        {st.totalCount} ชิ้น
                      </td>

                      {/* สถานะเฝ้าระวัง ปรับตามอัตราการสั่งพัสดุ ต่อวัน / ต่อสัปดาห์ / ต่อเดือน */}
                      <td className="py-2.5 px-4 text-center">
                        {st.isOverLimit ? (
                          <button
                            type="button"
                            onClick={() => openWeeklyWarningPopup(st, 'manual')}
                            className="w-full max-w-xs px-2.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-xl shadow-xs transition-all cursor-pointer flex flex-col items-center gap-0.5"
                            title="คลิกเพื่อดูรายละเอียดและหน้าต่างเตือน POPUP"
                          >
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                              <span>สถานะเฝ้าระวัง (เกินเกณฑ์)</span>
                            </div>
                            <div className="text-[10px] opacity-90 font-mono">
                              {st.isOverDailyLimit && `วัน ${st.dayCount}/${parcelRateLimitConfig.daily.limit} `}
                              {st.isOverWeeklyLimit && `สัปดาห์ ${st.weekCount}/${parcelRateLimitConfig.weekly.limit} `}
                              {st.isOverMonthlyLimit && `เดือน ${st.monthCount}/${parcelRateLimitConfig.monthly.limit}`}
                            </div>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ปกติ (อยู่ในเกณฑ์)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ตารางสรุปภาระงานแยกตามหอพักและสีตะกร้าคัดแยก */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            ตารางสรุปปริมาณพัสดุแยกตามหอพักและรหัสตะกร้าสี (Dormitory Breakdown)
          </h2>
          <p className="text-xs text-slate-500">
            แสดงจำนวนนักเรียนในทะเบียน พัสดุค้างจ่าย พัสดุติดนิติการ และพัสดุที่ส่งมอบสำเร็จแล้วของแต่ละหอพัก
          </p>
        </div>

        {dormitoryBreakdown.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500">
            ยังไม่มีข้อมูลหอพักในระบบ กรุณานำเข้าข้อมูลนักเรียนในเมนู "ข้อมูลนักเรียน"
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-3 px-4">รหัสตะกร้าคัดแยก</th>
                  <th className="py-3 px-4">ชื่อหอพัก</th>
                  <th className="py-3 px-4">สีประจำหอพัก</th>
                  <th className="py-3 px-4 text-right">จำนวนนักเรียน</th>
                  <th className="py-3 px-4 text-right">พัสดุทั้งหมด</th>
                  <th className="py-3 px-4 text-right">ค้างจ่าย</th>
                  <th className="py-3 px-4 text-right">พัสดุติดนิติการ</th>
                  <th className="py-3 px-4 text-right">ส่งมอบสำเร็จ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dormitoryBreakdown.map((item) => (
                  <tr key={item.dormKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                      {item.theme.basketCode}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.theme.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: item.theme.hexColor }}
                        />
                        <span className="text-slate-700">{item.theme.colorName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {item.dormStudents} คน
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {item.total} ชิ้น
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 tabular-nums">
                      {item.pending} ชิ้น
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                      {item.legal} ชิ้น
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {item.done} ชิ้น
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
