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
  | 'ติดต่องานพยาบาล'
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

export type AppMenuKey =
  | 'inbound'
  | 'tracking'
  | 'manifest'
  | 'students'
  | 'dashboard'
  | 'deliverables'
  | 'members'
  | 'bulk-delete'
  | 'backup-restore';

export type MemberRole = 'ผู้ดูแลระบบ' | 'เจ้าหน้าที่' | 'ครู' | 'ผู้ใช้';

export interface AppMenuDefinition {
  key: AppMenuKey;
  label: string;
  shortLabel: string;
  description: string;
  adminOnly?: boolean;
}

export const APP_MENU_DEFINITIONS: AppMenuDefinition[] = [
  {
    key: 'inbound',
    label: 'รับเข้าพัสดุ',
    shortLabel: 'รับเข้า',
    description: 'สแกนบาร์โค้ด ลงทะเบียนรับเข้าพัสดุ และคัดแยกหอพัก',
  },
  {
    key: 'tracking',
    label: 'ติดตามค้นหา',
    shortLabel: 'ค้นหา',
    description: 'ค้นหาพัสดุ อัปเดตสถานะการส่งมอบ และบันทึกการรับพัสดุ',
  },
  {
    key: 'manifest',
    label: 'ใบนำส่งหอพัก',
    shortLabel: 'ใบนำส่ง',
    description: 'พิมพ์ใบนำส่งพัสดุประจำหอพัก (A4) สำหรับเซ็นรับ',
  },
  {
    key: 'students',
    label: 'ข้อมูลนักเรียน',
    shortLabel: 'นักเรียน',
    description: 'นำเข้า เพิ่ม แก้ไข และจัดการฐานข้อมูลทะเบียนนักเรียน',
  },
  {
    key: 'dashboard',
    label: 'สถิติแดชบอร์ด',
    shortLabel: 'สถิติ',
    description: 'ดูภาพรวมสถิติพัสดุรายวัน รายหอพัก และปริมาณงาน',
  },
  {
    key: 'bulk-delete',
    label: 'ลบพัสดุจำนวนมากออกจากระบบ (Bulk Parcel Deletion)',
    shortLabel: 'ลบพัสดุจำนวนมาก',
    description: 'ลบพัสดุจำนวนมากออกจากระบบ (Bulk Parcel Deletion) ลบทีละหอพัก หรือลบพัสดุทั้งหมด (เฉพาะผู้ดูแลระบบ)',
    adminOnly: true,
  },
  {
    key: 'backup-restore',
    label: 'สำรอง ส่งออก & กู้คืนข้อมูล',
    shortLabel: 'สำรอง/กู้คืน',
    description: 'สำรอง ส่งออก และกู้คืนข้อมูลแบบทั้งหมด และแยกตามข้อมูลนักเรียนหรือสถานะพัสดุ (เฉพาะผู้ดูแลระบบ)',
    adminOnly: true,
  },
  {
    key: 'members',
    label: 'จัดการสมาชิก & สิทธิ์เมนู',
    shortLabel: 'สมาชิก/สิทธิ์',
    description: 'เพิ่ม ลบ แก้ไข สมาชิก (ผู้ดูแลระบบ, เจ้าหน้าที่, ครู) และหน้าอนุญาตการเข้าถึงเมนู',
    adminOnly: true,
  },
  {
    key: 'deliverables',
    label: 'ติดตั้ง GitHub Pages & Action',
    shortLabel: 'ติดตั้งระบบ',
    description: 'คู่มือและไฟล์สำหรับติดตั้งระบบขึ้นใช้งานจริง',
  },
];

export const ALL_MENU_KEYS: AppMenuKey[] = [
  'inbound',
  'tracking',
  'manifest',
  'students',
  'dashboard',
  'bulk-delete',
  'backup-restore',
  'members',
  'deliverables',
];

export const DEFAULT_STAFF_MENU_KEYS: AppMenuKey[] = [
  'inbound',
  'tracking',
  'manifest',
];

export const DEFAULT_TEACHER_MENU_KEYS: AppMenuKey[] = [
  'inbound',
  'tracking',
];

export const DEFAULT_USER_MENU_KEYS: AppMenuKey[] = [
  'inbound',
  'tracking',
  'manifest',
];

export interface Member {
  memberId: string;
  username: string;
  password: string;
  fullName: string;
  role: MemberRole;
  allowedMenus: AppMenuKey[];
  useCustomMenus: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  active: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  roleId: 'admin' | 'staff' | 'teacher' | 'user';
  roleName: MemberRole;
  allowedMenus: AppMenuKey[];
  canEdit?: boolean;
  canDelete?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingWriteItem {
  id: string;
  collection: 'students' | 'parcels' | 'members' | 'role_permissions';
  docId: string;
  action: 'upsert' | 'delete';
  data?: Student | Parcel | Member | RolePermission;
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
  'ติดต่องานพยาบาล',
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

function extractDormNumber(str: string): number {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  let s = str;
  thaiDigits.forEach((td, i) => {
    s = s.replaceAll(td, String(i));
  });
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999999;
}

/**
 * ฟังก์ชันเปรียบเทียบและเรียงลำดับชื่อหอพัก:
 * ให้เรียงหอพักล้านนาขึ้นก่อนจากน้อยไปหามาก (เช่น หอพักล้านนา 1, หอพักล้านนา 2, หอพักล้านนา 3... หอพักล้านนา 10)
 * และตามด้วยหอพักอื่นๆ เรียงลำดับจากน้อยไปหามากเช่นเดียวกัน
 */
export function compareDormitoryNatural(a: string, b: string): number {
  const normA = (a || '').trim();
  const normB = (b || '').trim();
  const aIsLanna = normA.includes('ล้านนา');
  const bIsLanna = normB.includes('ล้านนา');

  if (aIsLanna && !bIsLanna) return -1;
  if (!aIsLanna && bIsLanna) return 1;

  if (aIsLanna && bIsLanna) {
    const numA = extractDormNumber(normA);
    const numB = extractDormNumber(normB);
    if (numA !== numB) {
      return numA - numB;
    }
  } else {
    const numA = extractDormNumber(normA);
    const numB = extractDormNumber(normB);
    if (numA !== 999999 && numB !== 999999 && numA !== numB) {
      return numA - numB;
    }
  }

  // เรียงแบบ natural numeric ภาษาไทย เช่น ล้านนา 1 < ล้านนา 2 < ล้านนา 10
  return normA.localeCompare(normB, 'th', { numeric: true });
}

/**
 * ดึงรายชื่อหอพักทั้งหมดที่มีอยู่จริงในระบบจากข้อมูลนักเรียนและพัสดุเท่านั้น (ไม่สร้างข้อมูลตัวอย่าง)
 * เรียงลำดับจากหอพักล้านนา จากน้อยไปหามาก
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
  return Array.from(set).sort(compareDormitoryNatural);
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
 * จัดรูปแบบรหัสนักเรียน: กำหนดให้รหัสนักเรียนมีจำนวนไม่น้อยกว่า 5 หลัก
 * หากไม่ครบ 5 หลัก ให้เพิ่ม 0 นำหน้าให้ครบ 5 หลัก (เช่น 123 -> 00123)
 */
export function formatStudentCode(rawCode: string | number | undefined | null): string {
  if (rawCode === undefined || rawCode === null) return '';
  let trimmed = String(rawCode).trim();
  if (!trimmed || trimmed === '-' || trimmed.toUpperCase() === 'UNKNOWN') return trimmed;

  // หากเป็นตัวเลขทศนิยมที่อ่านมาจากไฟล์ Excel เช่น "12345.0"
  if (/^\d+\.0+$/.test(trimmed)) {
    trimmed = trimmed.split('.')[0];
  }

  // หากความยาวน้อยกว่า 5 หลัก ให้เพิ่ม 0 นำหน้าจนครบ 5 หลัก (เช่น 123 -> 00123)
  if (trimmed.length < 5) {
    return trimmed.padStart(5, '0');
  }
  return trimmed;
}

/**
 * สร้างรหัสพัสดุอัตโนมัติสำหรับกรณี "ผู้ปกครองฝากส่ง" โดยตรวจสอบไม่ให้ซ้ำกับข้อมูลที่มีอยู่ในระบบและฐานข้อมูล
 * มีการเพิ่มข้อความ "-RD" ต่อท้ายเลขบาร์โค้ดที่สุ่ม
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
    candidate = `${prefix}${seqStr}-${randomSuffix}-RD`;
    seq += 1;
  } while (existingIds.has(candidate.toUpperCase()));

  return candidate;
}

/**
 * สร้างรหัสพัสดุอัตโนมัติ/สุ่มเลขพัสดุตามบริษัทขนส่งที่เลือก (ไม่ซ้ำในระบบ)
 * มีการเพิ่มข้อความ "-RD" ต่อท้ายเลขบาร์โค้ดที่สุ่ม
 * สำหรับกรณีไม่สามารถสแกนหรือยิงบาร์โค้ดได้ แต่ยังคงเลือกบริษัทขนส่งได้
 */
export function generateUniqueTrackingNumberForCourier(
  courier: string,
  existingParcels: Parcel[]
): string {
  if (courier === 'ผู้ปกครองฝากส่ง') {
    return generateUniqueParentTrackingNumber(existingParcels);
  }

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

  const randDigits = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += Math.floor(Math.random() * 10).toString();
    }
    return res;
  };

  const randChars = (len: number) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  let candidate = '';
  do {
    if (courier === 'Flash Express') {
      candidate = `TH${datePart}${randDigits(5)}${randChars(1)}-RD`;
    } else if (courier === 'Kerry Express') {
      candidate = `KER${datePart}${randDigits(6)}-RD`;
    } else if (courier === 'ไปรษณีย์ไทย (EMS)') {
      candidate = `ED${randDigits(9)}TH-RD`;
    } else if (courier === 'J&T Express') {
      candidate = `JT${datePart}${randDigits(6)}-RD`;
    } else if (courier === 'Shopee Xpress (SPX)') {
      candidate = `SPXTH${datePart}${randDigits(6)}-RD`;
    } else if (courier === 'Lex Express') {
      candidate = `LEX${datePart}${randDigits(6)}-RD`;
    } else {
      candidate = `PKG-${datePart}-${randDigits(5)}-RD`;
    }
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

export const INITIAL_ROLE_PERMISSIONS: RolePermission[] = [
  {
    roleId: 'admin',
    roleName: 'ผู้ดูแลระบบ',
    allowedMenus: [...ALL_MENU_KEYS],
    canEdit: true,
    canDelete: true,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
  {
    roleId: 'staff',
    roleName: 'เจ้าหน้าที่',
    allowedMenus: [...DEFAULT_STAFF_MENU_KEYS],
    canEdit: true,
    canDelete: false,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
  {
    roleId: 'teacher',
    roleName: 'ครู',
    allowedMenus: [...DEFAULT_TEACHER_MENU_KEYS],
    canEdit: false,
    canDelete: false,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    memberId: 'admin_default',
    username: 'admin',
    password: '213894120',
    fullName: 'ผู้ดูแลระบบหลัก (Admin)',
    role: 'ผู้ดูแลระบบ',
    allowedMenus: [...ALL_MENU_KEYS],
    useCustomMenus: false,
    canEdit: true,
    canDelete: true,
    active: true,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
  {
    memberId: 'staff_default',
    username: 'staff',
    password: '1234',
    fullName: 'เจ้าหน้าที่ห้องพัสดุ',
    role: 'เจ้าหน้าที่',
    allowedMenus: [...DEFAULT_STAFF_MENU_KEYS],
    useCustomMenus: false,
    canEdit: true,
    canDelete: false,
    active: true,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
  {
    memberId: 'teacher_default',
    username: 'teacher',
    password: '1234',
    fullName: 'ครูประจำหอพัก',
    role: 'ครู',
    allowedMenus: [...DEFAULT_TEACHER_MENU_KEYS],
    useCustomMenus: false,
    canEdit: false,
    canDelete: false,
    active: true,
    ownerId: 'tasawan_app01_pcccr_ac_th',
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  },
];

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
      return (
        pCode === lowerCode ||
        formatStudentCode(pCode).toLowerCase() === formatStudentCode(lowerCode).toLowerCase()
      );
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
      const formattedKey = formatStudentCode(codeKey).toLowerCase();
      if (formattedKey !== codeKey) {
        byStudentCode.set(formattedKey, stats);
      }
      handledKeys.add(`code:${codeKey}`);
      handledKeys.add(`code:${formattedKey}`);
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

