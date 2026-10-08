/**
 * โครงสร้างข้อมูลหลักสำหรับระบบจัดการและคัดแยกพัสดุนักเรียน
 * (Student Parcel Management & Tracking System - Production Clean State)
 */

export type ParcelCategory =
  | 'ของใช้ส่วนตัว'
  | 'อาหารแห้ง'
  | 'เครื่องเขียน/หนังสือ'
  | 'เสื้อผ้า/เครื่องแต่งกาย'
  | 'อุปกรณ์อิเล็กทรอนิกส์'
  | 'เวชภัณฑ์/ยา'
  | 'เครื่องสำอาง'
  | 'อื่นๆ'
  | (string & {});

export type ParcelStatus =
  | 'ลงทะเบียนรับพัสดุ'
  | 'รับเข้าส่วนกลาง'
  | 'ติดนิติการ'
  | 'พัสดุไม่ทราบเจ้าของ'
  | 'รอการยืนยัน'
  | 'ส่งมอบสำเร็จ';

export interface Student {
  studentCode: string; // รหัสนักเรียน (ใช้เป็น Document ID ใน Firestore)
  seqNo: number;       // เลขที่
  prefix: string;      // คำนำหน้า
  firstName: string;   // ชื่อ
  lastName: string;    // นามสกุล
  nickname: string;    // ชื่อเล่น
  grade: string;       // ระดับชั้น
  room: string;        // ห้องเรียน
  dormitory: string;   // หอพัก
  dormRoom: string;    // ห้องพักหอ
  bed: string;         // เตียง
  ownerId: string;     // UID ผู้บันทึก
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
}

export interface Parcel {
  id: string;              // Document ID (ใช้เลข Tracking)
  trackingNumber: string;  // เลข Tracking จากบาร์โค้ด
  studentCode: string;     // รหัสนักเรียนผู้รับ
  studentFullName: string; // คำนำหน้า + ชื่อ + นามสกุล (Denormalized ลดการ Read ซ้ำ)
  nickname: string;        // ชื่อเล่นนักเรียน
  gradeRoom: string;       // ระดับชั้น/ห้อง
  dormitory: string;       // ชื่อหอพัก
  dormRoom: string;        // ห้องพักหอ
  bed: string;             // เตียง
  category: ParcelCategory;// ประเภทสิ่งของ
  status: ParcelStatus;    // สถานะพัสดุ
  courier: string;         // บริษัทขนส่ง
  note: string;            // หมายเหตุ
  receivedDate: string;    // YYYY-MM-DD
  receivedHour: number;    // 0 - 23 สำหรับวิเคราะห์ Peak Hours
  deliveredDate?: string;  // YYYY-MM-DD วันที่นักเรียนเซ็นรับพัสดุ
  ownerId: string;         // UID เจ้าหน้าที่ผู้สแกนรับ
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}

export interface DormitoryTheme {
  name: string;
  shortName: string;
  basketCode: string;
  colorName: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  accentBgClass: string;
  hexColor: string;
}

export interface PendingWriteItem {
  id: string;
  collection: 'students' | 'parcels';
  docId: string;
  action: 'upsert' | 'delete';
  data?: Student | Parcel;
  queuedAt: string;
}

export interface QuotaMetrics {
  localLookupsSaved: number;   // จำนวนครั้งที่ค้นหาจาก Local Cache แทนการยิง Firestore Read
  batchedWritesQueued: number; // จำนวนรายการที่รอส่งแบบ Batch
  firestoreReadsUsed: number;  // จำนวนการอ่านจาก Firestore จริง
  firestoreWritesUsed: number; // จำนวนการเขียนลง Firestore จริง
  lastSyncedAt: string | null;
}

export const PARCEL_CATEGORIES: ParcelCategory[] = [
  'ของใช้ส่วนตัว',
  'อาหารแห้ง',
  'เครื่องเขียน/หนังสือ',
  'เสื้อผ้า/เครื่องแต่งกาย',
  'อุปกรณ์อิเล็กทรอนิกส์',
  'เวชภัณฑ์/ยา',
  'เครื่องสำอาง',
  'อื่นๆ',
];

export const PARCEL_STATUSES: ParcelStatus[] = [
  'ลงทะเบียนรับพัสดุ',
  'ติดนิติการ',
  'พัสดุไม่ทราบเจ้าของ',
  'รอการยืนยัน',
  'ส่งมอบสำเร็จ',
];

export function isUnknownOwnerParcel(p: Parcel): boolean {
  const code = (p.studentCode || '').trim().toUpperCase();
  const name = (p.studentFullName || '').trim();
  const note = (p.note || '').trim();
  return (
    p.status === 'พัสดุไม่ทราบเจ้าของ' ||
    !code ||
    code === 'UNKNOWN' ||
    code === '-' ||
    !name ||
    name === '-' ||
    name === 'ไม่พบชื่อในทะเบียน' ||
    name.includes('ไม่ทราบเจ้าของ') ||
    note.includes('ไม่ทราบเจ้าของ') ||
    note.includes('ไม่ระบุชื่อผู้รับ')
  );
}

export const COURIER_LIST: string[] = [
  'Flash Express',
  'Kerry Express',
  'ไปรษณีย์ไทย (EMS)',
  'J&T Express',
  'Shopee Xpress (SPX)',
  'Lex Express',
  'ผู้ปกครองฝากส่ง',
];

const COLOR_PALETTE: Omit<DormitoryTheme, 'name' | 'shortName'>[] = [
  {
    basketCode: 'ตะกร้า A1',
    colorName: 'สีเหลืองทอง (Gold)',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-950',
    accentBgClass: 'bg-amber-500 text-slate-950',
    hexColor: '#F59E0B',
  },
  {
    basketCode: 'ตะกร้า A2',
    colorName: 'สีม่วงคราม (Indigo)',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-600',
    textClass: 'text-indigo-950',
    accentBgClass: 'bg-indigo-600 text-white',
    hexColor: '#4F46E5',
  },
  {
    basketCode: 'ตะกร้า B1',
    colorName: 'สีชมพูโรส (Rose)',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-600',
    textClass: 'text-rose-950',
    accentBgClass: 'bg-rose-600 text-white',
    hexColor: '#E11D48',
  },
  {
    basketCode: 'ตะกร้า B2',
    colorName: 'สีเขียวมรกต (Emerald)',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-600',
    textClass: 'text-emerald-950',
    accentBgClass: 'bg-emerald-600 text-white',
    hexColor: '#059669',
  },
  {
    basketCode: 'ตะกร้า B3',
    colorName: 'สีฟ้าคราม (Sky)',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-600',
    textClass: 'text-sky-950',
    accentBgClass: 'bg-sky-600 text-white',
    hexColor: '#0284C7',
  },
  {
    basketCode: 'ตะกร้า C1',
    colorName: 'สีส้มแสด (Orange)',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-600',
    textClass: 'text-orange-950',
    accentBgClass: 'bg-orange-600 text-white',
    hexColor: '#EA580C',
  },
  {
    basketCode: 'ตะกร้า C2',
    colorName: 'สีเขียวอมฟ้า (Teal)',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-600',
    textClass: 'text-teal-950',
    accentBgClass: 'bg-teal-600 text-white',
    hexColor: '#0D9488',
  },
  {
    basketCode: 'ตะกร้า C3',
    colorName: 'สีม่วงไวโอเล็ต (Violet)',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-600',
    textClass: 'text-violet-950',
    accentBgClass: 'bg-violet-600 text-white',
    hexColor: '#7C3AED',
  },
];

/**
 * คืนค่าธีมสีและรหัสตะกร้าประจำหอพักตามชื่อหอพักที่ผู้ใช้นำเข้าหรือกรอกจริง (ไม่มีข้อมูลตัวอย่าง)
 */
export function getDormitoryTheme(dormName: string): DormitoryTheme {
  const normalized = (dormName || '').trim();
  if (!normalized || normalized === '-') {
    return {
      name: 'ยังไม่ระบุหอพัก',
      shortName: 'ยังไม่ระบุหอพัก',
      basketCode: '-',
      colorName: 'สีเทามาตรฐาน (Slate)',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-300',
      textClass: 'text-slate-900',
      accentBgClass: 'bg-slate-700 text-white',
      hexColor: '#475569',
    };
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  const paletteItem = COLOR_PALETTE[hash % COLOR_PALETTE.length];

  return {
    name: normalized,
    shortName: normalized,
    ...paletteItem,
  };
}

/**
 * ดึงรายชื่อหอพักทั้งหมดที่มีอยู่จริงในระบบจากข้อมูลนักเรียนและพัสดุเท่านั้น (ไม่สร้างข้อมูลตัวอย่าง)
 */
export function getAvailableDormitories(students: Student[], parcels: Parcel[]): string[] {
  const set = new Set<string>();
  for (const s of students) {
    if (s.dormitory && s.dormitory.trim() && s.dormitory.trim() !== '-') {
      set.add(s.dormitory.trim());
    }
  }
  for (const p of parcels) {
    if (p.dormitory && p.dormitory.trim() && p.dormitory.trim() !== '-') {
      set.add(p.dormitory.trim());
    }
  }
  return Array.from(set);
}

/**
 * ฟังก์ชันช่วยตรวจจับบริษัทขนส่งอัตโนมัติจากรูปแบบเลข Tracking
 */
export function detectCourierFromTracking(tracking: string): string {
  const upper = tracking.trim().toUpperCase();
  if (upper.startsWith('PRT')) return 'ผู้ปกครองฝากส่ง';
  if (upper.startsWith('TH')) return 'Flash Express';
  if (upper.startsWith('KER') || upper.startsWith('SDOF')) return 'Kerry Express';
  if (upper.startsWith('EMS') || upper.startsWith('EB') || upper.startsWith('ED') || upper.startsWith('JA')) {
    return 'ไปรษณีย์ไทย (EMS)';
  }
  if (upper.startsWith('JT') || /^82\d+/.test(upper)) return 'J&T Express';
  if (upper.startsWith('SPX')) return 'Shopee Xpress (SPX)';
  if (upper.startsWith('LEX')) return 'Lex Express';
  return 'Flash Express';
}

/**
 * สร้างรหัสพัสดุอัตโนมัติสำหรับกรณี "ผู้ปกครองฝากส่ง" โดยตรวจสอบไม่ให้ซ้ำกับข้อมูลที่มีอยู่ในระบบและฐานข้อมูล
 */
export function generateUniqueParentTrackingNumber(existingParcels: Parcel[]): string {
  const existingIds = new Set<string>();
  for (const p of existingParcels) {
    if (p.id) existingIds.add(p.id.trim().toUpperCase());
    if (p.trackingNumber) existingIds.add(p.trackingNumber.trim().toUpperCase());
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;
  const prefix = `PRT-${datePart}-`;

  let seq =
    existingParcels.filter((p) =>
      p.trackingNumber.toUpperCase().startsWith(prefix)
    ).length + 1;

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let candidate = '';

  do {
    const seqStr = String(seq).padStart(3, '0');
    let randomSuffix = '';
    for (let i = 0; i < 3; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    candidate = `${prefix}${seqStr}-${randomSuffix}`;
    seq += 1;
  } while (existingIds.has(candidate.toUpperCase()));

  return candidate;
}

// ฟังก์ชันคืนค่าวันที่ย้อนหลัง N วัน ในรูปแบบ YYYY-MM-DD (ตามเวลาท้องถิ่น)
export function getRelativeDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * แปลงวันที่ YYYY-MM-DD หรือ ISO String เป็นรูปแบบ วว/ดด/ปปปป (พ.ศ.) เช่น 06/10/2569
 */
export function formatThaiSlashDate(dateStr?: string): string {
  if (!dateStr) return '..../...../.....';
  const trimmed = dateStr.trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymdMatch) {
    const yearBE = parseInt(ymdMatch[1], 10) + 543;
    const month = ymdMatch[2];
    const day = ymdMatch[3];
    return `${day}/${month}/${yearBE}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yearBE = parsed.getFullYear() + 543;
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${day}/${month}/${yearBE}`;
  }
  return trimmed;
}

/**
 * ข้อมูลเริ่มต้นเป็นค่าว่างทั้งหมด (ไม่ใช้ข้อมูลตัวอย่างตามคำสั่งผู้ใช้)
 */
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_PARCELS: Parcel[] = [];

export const WEEKLY_PARCEL_WARNING_LIMIT = 3; // เกิน 3 ชิ้นต่อสัปดาห์ (ตั้งแต่ 4 ชิ้นขึ้นไป) แสดง Popup เตือน

export interface StudentParcelCountStats {
  studentKey: string;
  studentCode: string;
  studentFullName: string;
  nickname: string;
  gradeRoom: string;
  dormitory: string;
  dormRoom: string;
  dayCount: number;           // จำนวนพัสดุรายวัน (วันนี้)
  weekCount: number;          // จำนวนพัสดุรายสัปดาห์ (7 วันล่าสุด)
  monthCount: number;         // จำนวนพัสดุรายเดือน (เดือนนี้ / 30 วันล่าสุด)
  totalCount: number;         // จำนวนพัสดุสะสมทั้งหมด
  isOverWeeklyLimit: boolean; // true เมื่อ weekCount > 3
  dayParcels: Parcel[];
  weekParcels: Parcel[];
  monthParcels: Parcel[];
}

export function normalizeStudentNameForMatch(fullName?: string): string {
  if (!fullName) return '';
  return fullName
    .replace(/^(นาย|นางสาว|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractParcelLocalYMD(parcel: Parcel, fallbackTodayStr?: string): string {
  const todayStr = fallbackTodayStr || getRelativeDateString(0);
  const rawDate = (parcel.receivedDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }
  if (parcel.createdAt) {
    const parsed = new Date(parcel.createdAt);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return todayStr;
}

function parseYMDToMidnightMs(ymd: string): number {
  const parts = ymd.split('-');
  if (parts.length !== 3) return Date.now();
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
}

/**
 * คำนวณจำนวนพัสดุของนักเรียนรายคน แยกเป็น วัน (วันนี้), สัปดาห์ (7 วันล่าสุด), เดือน (เดือนปัจจุบัน/30 วัน)
 */
export function getStudentParcelCountStats(
  parcels: Parcel[],
  studentCode?: string,
  studentFullName?: string,
  studentMeta?: Partial<Pick<Student, 'prefix' | 'firstName' | 'lastName' | 'nickname' | 'grade' | 'room' | 'dormitory' | 'dormRoom'>>
): StudentParcelCountStats {
  const todayStr = getRelativeDateString(0);
  const todayMs = parseYMDToMidnightMs(todayStr);
  const currentYearMonth = todayStr.slice(0, 7);

  const cleanCode = (studentCode || '').trim();
  const lowerCode = cleanCode.toLowerCase();
  const hasValidCode = Boolean(lowerCode && lowerCode !== 'unknown' && lowerCode !== '-');

  const computedFullName =
    (studentFullName || '').trim() ||
    (studentMeta?.firstName
      ? `${studentMeta.prefix && studentMeta.prefix !== '-' ? studentMeta.prefix : ''}${studentMeta.firstName} ${
          studentMeta.lastName && studentMeta.lastName !== '-' ? studentMeta.lastName : ''
        }`.trim()
      : '');
  const normTargetName = normalizeStudentNameForMatch(computedFullName);

  const matchedParcels = parcels.filter((p) => {
    if (isUnknownOwnerParcel(p)) return false;
    const pCode = (p.studentCode || '').trim().toLowerCase();
    const pHasValidCode = Boolean(pCode && pCode !== 'unknown' && pCode !== '-');

    if (hasValidCode && pHasValidCode) {
      return pCode === lowerCode;
    }
    if (normTargetName) {
      const pNormName = normalizeStudentNameForMatch(p.studentFullName);
      if (pNormName && pNormName === normTargetName) {
        return true;
      }
    }
    return false;
  });

  const dayParcels: Parcel[] = [];
  const weekParcels: Parcel[] = [];
  const monthParcels: Parcel[] = [];

  for (const p of matchedParcels) {
    const pYMD = extractParcelLocalYMD(p, todayStr);
    const pMs = parseYMDToMidnightMs(pYMD);
    const diffDays = Math.round((todayMs - pMs) / 86400000);

    const isDay = pYMD === todayStr;
    const isWeek = diffDays >= 0 && diffDays < 7;
    const isMonth = (diffDays >= 0 && diffDays < 30) || pYMD.slice(0, 7) === currentYearMonth;

    if (isDay) dayParcels.push(p);
    if (isWeek) weekParcels.push(p);
    if (isMonth) monthParcels.push(p);
  }

  const latestParcel = matchedParcels[0];
  const gradeRoomFromMeta =
    studentMeta?.grade && studentMeta.grade !== '-'
      ? `${studentMeta.grade}${studentMeta.room && studentMeta.room !== '-' ? `/${studentMeta.room}` : ''}`
      : '';

  return {
    studentKey: hasValidCode ? `code:${lowerCode}` : `name:${normTargetName || 'unknown'}`,
    studentCode: hasValidCode ? cleanCode : latestParcel?.studentCode || '-',
    studentFullName: computedFullName || latestParcel?.studentFullName || '-',
    nickname:
      (studentMeta?.nickname && studentMeta.nickname !== '-' ? studentMeta.nickname : '') ||
      latestParcel?.nickname ||
      '-',
    gradeRoom: gradeRoomFromMeta || latestParcel?.gradeRoom || '-',
    dormitory:
      (studentMeta?.dormitory && studentMeta.dormitory !== '-' ? studentMeta.dormitory : '') ||
      latestParcel?.dormitory ||
      '-',
    dormRoom:
      (studentMeta?.dormRoom && studentMeta.dormRoom !== '-' ? studentMeta.dormRoom : '') ||
      latestParcel?.dormRoom ||
      '-',
    dayCount: dayParcels.length,
    weekCount: weekParcels.length,
    monthCount: monthParcels.length,
    totalCount: matchedParcels.length,
    isOverWeeklyLimit: weekParcels.length > WEEKLY_PARCEL_WARNING_LIMIT,
    dayParcels,
    weekParcels,
    monthParcels,
  };
}

/**
 * สร้างตารางสรุปสถิติจำนวนพัสดุ (วัน, สัปดาห์, เดือน) ของนักเรียนทุกคนในระบบ
 */
export function buildAllStudentParcelStats(
  students: Student[],
  parcels: Parcel[]
): {
  byStudentCode: Map<string, StudentParcelCountStats>;
  allStats: StudentParcelCountStats[];
  overWeeklyLimitList: StudentParcelCountStats[];
} {
  const byStudentCode = new Map<string, StudentParcelCountStats>();
  const handledKeys = new Set<string>();
  const allStats: StudentParcelCountStats[] = [];

  for (const st of students) {
    const stats = getStudentParcelCountStats(parcels, st.studentCode, undefined, st);
    const codeKey = st.studentCode.trim().toLowerCase();
    if (codeKey) {
      byStudentCode.set(codeKey, stats);
      handledKeys.add(`code:${codeKey}`);
    }
    const normName = normalizeStudentNameForMatch(stats.studentFullName);
    if (normName) {
      handledKeys.add(`name:${normName}`);
    }
    allStats.push(stats);
  }

  // กรณีมีพัสดุของนักเรียนที่ยังไม่ได้เพิ่มเข้าในทะเบียนรายชื่อนักเรียน
  for (const p of parcels) {
    if (isUnknownOwnerParcel(p)) continue;
    const pCode = (p.studentCode || '').trim().toLowerCase();
    const hasCode = Boolean(pCode && pCode !== 'unknown' && pCode !== '-');
    const normName = normalizeStudentNameForMatch(p.studentFullName);

    const codeKey = hasCode ? `code:${pCode}` : '';
    const nameKey = normName ? `name:${normName}` : '';

    if ((codeKey && handledKeys.has(codeKey)) || (!codeKey && nameKey && handledKeys.has(nameKey))) {
      continue;
    }

    const stats = getStudentParcelCountStats(
      parcels,
      hasCode ? p.studentCode : undefined,
      p.studentFullName
    );
    if (hasCode) {
      byStudentCode.set(pCode, stats);
      handledKeys.add(codeKey);
    }
    if (nameKey) {
      handledKeys.add(nameKey);
    }
    allStats.push(stats);
  }

  const overWeeklyLimitList = allStats
    .filter((item) => item.isOverWeeklyLimit)
    .sort((a, b) => b.weekCount - a.weekCount || b.dayCount - a.dayCount || b.monthCount - a.monthCount);

  return {
    byStudentCode,
    allStats,
    overWeeklyLimitList,
  };
}

