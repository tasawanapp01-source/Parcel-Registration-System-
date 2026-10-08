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
  Database,
  Trash2,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { useParcelSystem } from '../context/ParcelSystemContext';
import {
  getDormitoryTheme,
  getAvailableDormitories,
  getRelativeDateString,
  WEEKLY_PARCEL_WARNING_LIMIT,
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
    openWeeklyWarningPopup,
    quotaMetrics,
    pendingWrites,
    clearAllLocalData,
  } = useParcelSystem();

  const sortedStudentStats = useMemo(() => {
    return [...allStudentParcelStats]
      .filter((s) => s.totalCount > 0 || students.length <= 50)
      .sort(
        (a, b) =>
          b.weekCount - a.weekCount ||
          b.dayCount - a.dayCount ||
          b.monthCount - a.monthCount ||
          a.studentCode.localeCompare(b.studentCode, 'th', { numeric: true })
      );
  }, [allStudentParcelStats, students.length]);

  const todayStr = getRelativeDateString(0);

  // 1. คำนวณตัวเลข KPI หลัก
  const kpiStats = useMemo(() => {
    let inboundToday = 0;
    let pendingDelivery = 0;
    let legalHold = 0;
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
    }

    const deliveryRate =
      parcels.length > 0 ? Math.round((delivered / parcels.length) * 100) : 0;

    return {
      inboundToday,
      pendingDelivery,
      legalHold,
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

        {(students.length > 0 || parcels.length > 0) && (
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

      {/* ตัวเลขสรุป KPI 4+1 กล่อง (Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-500">พัสดุรับเข้าวันนี้</span>
          <div className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
            {kpiStats.inboundToday}
          </div>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            วันที่ {todayStr} · จากทั้งหมด {parcels.length} ชิ้น
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <span className="text-xs font-semibold text-slate-500">พัสดุค้างจ่าย (รอนำส่ง/รอรับ)</span>
          <div className="text-3xl font-mono font-extrabold text-amber-600 tabular-nums">
            {kpiStats.pendingDelivery}
          </div>
          <p className="text-xs text-slate-500">
            รอการส่งมอบและเซ็นรับพัสดุประจำหอพัก
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700">พัสดุติดนิติการ</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-red-600 tabular-nums">
            {kpiStats.legalHold}
          </div>
          <p className="text-xs text-slate-500">
            รอครูประจำหอพักและนักเรียนเปิดตรวจสอบร่วมกัน
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">ส่งมอบสำเร็จแล้ว</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-emerald-700 tabular-nums">
            {kpiStats.delivered}{' '}
            <span className="text-sm font-semibold text-slate-500">({kpiStats.deliveryRate}%)</span>
          </div>
          <p className="text-xs text-slate-500">
            นักเรียนลงชื่อรับพัสดุที่หอพักเรียบร้อยแล้ว
          </p>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">ประหยัดโควตา Firebase</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-mono font-extrabold text-white tabular-nums">
            {quotaMetrics.localLookupsSaved}
          </div>
          <p className="text-xs text-slate-300 font-mono tabular-nums">
            Reads ที่ประหยัดได้ · รอ Batch {pendingWrites.length} รายการ
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-800" />
              <span>
                สรุปการนับจำนวนพัสดุของนักเรียนแต่ละคน (วัน / สัปดาห์ / เดือน)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เรียงลำดับตามจำนวนพัสดุรายสัปดาห์ (เกณฑ์เฝ้าระวัง: เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้นต่อสัปดาห์ แสดงแจ้งเตือน Popup)
            </p>
          </div>

          {overWeeklyLimitStudents.length > 0 && (
            <button
              type="button"
              onClick={() => openWeeklyWarningPopup(overWeeklyLimitStudents[0], 'manual')}
              className="min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                เปิดดู Popup นักเรียนเกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์ ({overWeeklyLimitStudents.length} คน)
              </span>
            </button>
          )}
        </div>

        {sortedStudentStats.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500">
            ยังไม่มีข้อมูลนักเรียนหรือรายการพัสดุในระบบ
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-3 px-4">รหัสนักเรียน</th>
                  <th className="py-3 px-4">ชื่อ-นามสกุล (ชื่อเล่น)</th>
                  <th className="py-3 px-4">ระดับชั้น/ห้อง</th>
                  <th className="py-3 px-4">หอพัก / ห้อง</th>
                  <th className="py-3 px-4 text-right">รายวัน (วันนี้)</th>
                  <th className="py-3 px-4 text-right">รายสัปดาห์ (7 วัน)</th>
                  <th className="py-3 px-4 text-right">รายเดือน (เดือนนี้)</th>
                  <th className="py-3 px-4 text-center">สถานะเฝ้าระวัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedStudentStats.map((st) => {
                  const theme = getDormitoryTheme(st.dormitory);
                  return (
                    <tr
                      key={st.studentKey}
                      className={`transition-colors ${
                        st.isOverWeeklyLimit
                          ? 'bg-red-50/70 hover:bg-red-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                        {st.studentCode}
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
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {st.dayCount} ชิ้น
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-extrabold tabular-nums ${
                          st.isOverWeeklyLimit ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {st.weekCount} ชิ้น
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {st.monthCount} ชิ้น
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {st.isOverWeeklyLimit ? (
                          <button
                            type="button"
                            onClick={() => openWeeklyWarningPopup(st, 'manual')}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>เกิน {WEEKLY_PARCEL_WARNING_LIMIT} ชิ้น/สัปดาห์</span>
                          </button>
                        ) : (
                          <span className="text-slate-500">ปกติ</span>
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
