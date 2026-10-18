import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Student,
  Parcel,
  ParcelStatus,
  Member,
  MemberRole,
  RolePermission,
  AppMenuKey,
  ALL_MENU_KEYS,
  INITIAL_MEMBERS,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_STUDENTS,
  INITIAL_PARCELS,
  getRelativeDateString,
  formatStudentCode,
} from '../types/parcel';

// ค่าคงที่สำหรับบัญชีหลักของระบบที่เชื่อมต่ออัตโนมัติ (Tasawan_app01@pcccr.ac.th)
export const AUTO_CLOUD_EMAIL = 'Tasawan_app01@pcccr.ac.th';
export const AUTO_CLOUD_OWNER_ID = 'tasawan_app01_pcccr_ac_th';

// 1. เริ่มต้นการเชื่อมต่อ Firebase SDK ตามโครงสร้างมาตรฐาน
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  login_hint: AUTO_CLOUD_EMAIL,
});

// 2. โครงสร้างการจัดการข้อผิดพลาดมาตรฐานสำหรับ Firestore Security Rules
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || AUTO_CLOUD_OWNER_ID,
      email: auth.currentUser?.email || AUTO_CLOUD_EMAIL,
      emailVerified: auth.currentUser?.emailVerified ?? true,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [{ providerId: 'workspace-auto', email: AUTO_CLOUD_EMAIL }],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 3. ตรวจสอบสถานะการเชื่อมต่อกับ Firestore Server เมื่อเริ่มทำงาน
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// 4. ฟังก์ชันช่วยจัดรูปแบบข้อมูล (Defensive Payload Sanitization) ให้ตรงตาม firebase-blueprint.json
export function sanitizeId(raw: string, maxLen = 64): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return (cleaned || 'ID001').slice(0, maxLen);
}

export function sanitizeString(
  raw: string | undefined | null,
  minLen: number,
  maxLen: number,
  fallback = '-'
): string {
  const val = String(raw ?? '').trim();
  if (val.length < minLen) {
    return fallback.slice(0, maxLen);
  }
  return val.slice(0, maxLen);
}

export function buildValidParcelPayload(p: Parcel, ownerId: string) {
  const validStatuses = [
    'ลงทะเบียนรับพัสดุ',
    'รับเข้าส่วนกลาง',
    'ติดนิติการ',
    'พัสดุไม่ทราบเจ้าของ',
    'รอการยืนยัน',
    'ส่งมอบสำเร็จ',
  ];
  const rawStatus =
    (p.status as string) === 'ระหว่างส่งไปหอ' ? 'ลงทะเบียนรับพัสดุ' : p.status;
  const safeStatus = validStatuses.includes(rawStatus)
    ? rawStatus
    : 'ลงทะเบียนรับพัสดุ';

  const safeStudentCode = sanitizeId(
    p.studentCode === 'UNKNOWN' ? 'UNKNOWN' : formatStudentCode(p.studentCode || 'UNKNOWN'),
    20
  );

  return {
    trackingNumber: sanitizeId(p.trackingNumber || p.id, 64),
    studentCode: safeStudentCode,
    studentFullName: sanitizeString(p.studentFullName, 1, 220, '-'),
    nickname: sanitizeString(p.nickname, 0, 50, ''),
    gradeRoom: sanitizeString(p.gradeRoom, 1, 50, '-'),
    dormitory: sanitizeString(p.dormitory, 1, 80, '-'),
    dormRoom: sanitizeString(p.dormRoom, 1, 30, '-'),
    bed: sanitizeString(p.bed, 1, 20, '-'),
    category: sanitizeString(p.category, 1, 100, 'อื่นๆ'),
    status: safeStatus,
    courier: sanitizeString(p.courier, 1, 50, 'Flash Express'),
    note: sanitizeString(p.note, 0, 300, ''),
    receivedDate: sanitizeString(p.receivedDate, 8, 20, getRelativeDateString(0)),
    receivedHour: Math.max(0, Math.min(23, Math.floor(Number(p.receivedHour) || 12))),
    deliveredDate: sanitizeString(p.deliveredDate || '', 0, 20, ''),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function buildValidStudentPayload(st: Student, ownerId: string) {
  const safeCode = sanitizeId(formatStudentCode(st.studentCode), 20);
  return {
    studentCode: safeCode,
    seqNo: Math.max(1, Math.min(100000, Math.floor(Number(st.seqNo) || 1))),
    prefix: sanitizeString(st.prefix, 1, 30, '-'),
    firstName: sanitizeString(st.firstName, 1, 100, '-'),
    lastName: sanitizeString(st.lastName, 1, 100, '-'),
    nickname: sanitizeString(st.nickname, 0, 50, ''),
    grade: sanitizeString(st.grade, 1, 30, '-'),
    room: sanitizeString(st.room, 1, 20, '-'),
    dormitory: sanitizeString(st.dormitory, 1, 80, '-'),
    dormRoom: sanitizeString(st.dormRoom, 1, 30, '-'),
    bed: sanitizeString(st.bed, 1, 20, '-'),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function sanitizeMenuList(menus: unknown): AppMenuKey[] {
  if (!Array.isArray(menus)) return ['inbound'];
  const validSet = new Set<string>(ALL_MENU_KEYS);
  const filtered = menus
    .map((m) => String(m || '').trim())
    .filter((m): m is AppMenuKey => validSet.has(m));
  return Array.from(new Set(filtered)).slice(0, 10);
}

export function buildValidMemberPayload(m: Member, ownerId: string) {
  const safeId = sanitizeId(m.memberId, 64);
  const safeRole: MemberRole =
    m.role === 'ผู้ดูแลระบบ'
      ? 'ผู้ดูแลระบบ'
      : m.role === 'ครู'
      ? 'ครู'
      : 'เจ้าหน้าที่';

  return {
    memberId: safeId,
    username: sanitizeString(m.username, 1, 80, 'user'),
    password: sanitizeString(m.password, 1, 100, '1234'),
    fullName: sanitizeString(m.fullName, 1, 150, 'ผู้ใช้งานระบบ'),
    role: safeRole,
    allowedMenus: sanitizeMenuList(m.allowedMenus),
    useCustomMenus: Boolean(m.useCustomMenus),
    canEdit: m.canEdit !== undefined ? Boolean(m.canEdit) : safeRole !== 'ครู',
    canDelete: m.canDelete !== undefined ? Boolean(m.canDelete) : safeRole === 'ผู้ดูแลระบบ',
    active: m.active !== false,
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function buildValidRolePermissionPayload(rp: RolePermission, ownerId: string) {
  const safeRoleId =
    rp.roleId === 'admin'
      ? 'admin'
      : rp.roleId === 'teacher'
      ? 'teacher'
      : 'staff';
  const safeRoleName: MemberRole =
    safeRoleId === 'admin'
      ? 'ผู้ดูแลระบบ'
      : safeRoleId === 'teacher'
      ? 'ครู'
      : 'เจ้าหน้าที่';

  return {
    roleId: safeRoleId,
    roleName: safeRoleName,
    allowedMenus: sanitizeMenuList(rp.allowedMenus),
    canEdit: rp.canEdit !== undefined ? Boolean(rp.canEdit) : safeRoleId !== 'teacher',
    canDelete: rp.canDelete !== undefined ? Boolean(rp.canDelete) : safeRoleId === 'admin',
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

// -------------------------------------------------------------
// 5. การดำเนินการกับฐานข้อมูล Firestore โดยตรง (Direct CRUD Functions)
// -------------------------------------------------------------

/**
 * บันทึกพัสดุใหม่ลง Firestore โดยตรง
 */
export async function createParcelDirectly(
  parcel: Parcel,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  const safeId = sanitizeId(parcel.trackingNumber || parcel.id, 64);
  const payload = buildValidParcelPayload(parcel, ownerId);
  const docRef = doc(db, 'parcels', safeId);
  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `parcels/${safeId}`);
  }
}

/**
 * อัปเดตข้อมูลพัสดุใน Firestore โดยตรง
 */
export async function updateParcelDirectly(
  parcelId: string,
  updates: Partial<Parcel>,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  const safeId = sanitizeId(parcelId, 64);
  const docRef = doc(db, 'parcels', safeId);
  try {
    // อ่านเอกสารเดิมเพื่อคงค่า createdAt เดิมไว้ตามกฎ Security Rules
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      // หากยังไม่มีเอกสาร ให้สร้างใหม่ด้วยข้อมูลที่มี
      const fullParcel: Parcel = {
        id: safeId,
        trackingNumber: safeId,
        studentCode: sanitizeId(updates.studentCode || 'UNKNOWN', 20),
        studentFullName: updates.studentFullName || '-',
        nickname: updates.nickname || '',
        gradeRoom: updates.gradeRoom || '-',
        dormitory: updates.dormitory || '-',
        dormRoom: updates.dormRoom || '-',
        bed: updates.bed || '-',
        category: updates.category || 'อื่นๆ',
        status: updates.status || 'ลงทะเบียนรับพัสดุ',
        courier: updates.courier || 'Flash Express',
        note: updates.note || '',
        receivedDate: updates.receivedDate || getRelativeDateString(0),
        receivedHour: updates.receivedHour ?? 12,
        deliveredDate: updates.deliveredDate || '',
        ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, buildValidParcelPayload(fullParcel, ownerId));
      return;
    }

    const currentData = snap.data();
    const mergedPayload = {
      trackingNumber: safeId,
      studentCode: sanitizeId(updates.studentCode ?? currentData.studentCode, 20),
      studentFullName: sanitizeString(updates.studentFullName ?? currentData.studentFullName, 1, 220, '-'),
      nickname: sanitizeString(updates.nickname ?? currentData.nickname, 0, 50, ''),
      gradeRoom: sanitizeString(updates.gradeRoom ?? currentData.gradeRoom, 1, 50, '-'),
      dormitory: sanitizeString(updates.dormitory ?? currentData.dormitory, 1, 80, '-'),
      dormRoom: sanitizeString(updates.dormRoom ?? currentData.dormRoom, 1, 30, '-'),
      bed: sanitizeString(updates.bed ?? currentData.bed, 1, 20, '-'),
      category: sanitizeString(updates.category ?? currentData.category, 1, 100, 'อื่นๆ'),
      status: updates.status ?? currentData.status,
      courier: sanitizeString(updates.courier ?? currentData.courier, 1, 50, 'Flash Express'),
      note: sanitizeString(updates.note ?? currentData.note, 0, 300, ''),
      receivedDate: sanitizeString(updates.receivedDate ?? currentData.receivedDate, 8, 20, getRelativeDateString(0)),
      receivedHour: updates.receivedHour !== undefined ? updates.receivedHour : (currentData.receivedHour ?? 12),
      deliveredDate: sanitizeString(updates.deliveredDate !== undefined ? updates.deliveredDate : currentData.deliveredDate, 0, 20, ''),
      ownerId: currentData.ownerId || ownerId,
      createdAt: currentData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, mergedPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parcels/${safeId}`);
  }
}

/**
 * ลบพัสดุออกจาก Firestore โดยตรง
 */
export async function deleteParcelDirectly(parcelId: string): Promise<void> {
  const safeId = sanitizeId(parcelId, 64);
  const docRef = doc(db, 'parcels', safeId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `parcels/${safeId}`);
  }
}

/**
 * อัปเดตสถานะพัสดุหลายรายการพร้อมกันใน Firestore ด้วย Atomic Batch
 */
export async function bulkUpdateParcelsDirectly(
  parcelIds: string[],
  newStatus: ParcelStatus,
  deliveredDate?: string,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<number> {
  if (parcelIds.length === 0) return 0;
  const CHUNK_SIZE = 400;
  let updatedCount = 0;
  const effectiveDeliveredDate =
    newStatus === 'ส่งมอบสำเร็จ'
      ? (deliveredDate || getRelativeDateString(0)).slice(0, 20)
      : '';

  for (let i = 0; i < parcelIds.length; i += CHUNK_SIZE) {
    const chunk = parcelIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const pid of chunk) {
      const safeId = sanitizeId(pid, 64);
      const docRef = doc(db, 'parcels', safeId);
      batch.update(docRef, {
        status: newStatus,
        deliveredDate: effectiveDeliveredDate,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      updatedCount += chunk.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'parcels/bulk');
    }
  }

  return updatedCount;
}

/**
 * บันทึกหรือแก้ไขข้อมูลนักเรียนรายคนลง Firestore โดยตรง
 */
export async function saveStudentDirectly(
  student: Student | Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  const safeCode = sanitizeId(student.studentCode, 20);
  const docRef = doc(db, 'students', safeCode);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data();
      const payload = {
        ...buildValidStudentPayload(student as Student, ownerId),
        createdAt: current.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, payload);
    } else {
      const payload = buildValidStudentPayload(student as Student, ownerId);
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${safeCode}`);
  }
}

/**
 * ลบข้อมูลนักเรียนออกจาก Firestore โดยตรง
 */
export async function deleteStudentDirectly(studentCode: string): Promise<void> {
  const safeCode = sanitizeId(studentCode, 20);
  const docRef = doc(db, 'students', safeCode);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${safeCode}`);
  }
}

/**
 * ลบข้อมูลนักเรียนหลายคนออกจาก Firestore โดยตรงด้วย Batch
 */
export async function bulkDeleteStudentsDirectly(studentCodes: string[]): Promise<number> {
  if (studentCodes.length === 0) return 0;
  const CHUNK_SIZE = 400;
  let deletedCount = 0;

  for (let i = 0; i < studentCodes.length; i += CHUNK_SIZE) {
    const chunk = studentCodes.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const code of chunk) {
      const safeCode = sanitizeId(code, 20);
      const docRef = doc(db, 'students', safeCode);
      batch.delete(docRef);
    }

    try {
      await batch.commit();
      deletedCount += chunk.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students/bulk_delete');
    }
  }

  return deletedCount;
}

/**
 * นำเข้านักเรียนจำนวนมาก (Bulk Import) ลง Firestore โดยตรง
 */
export async function batchImportStudentsToFirestore(
  students: (Student | Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>)[],
  uid: string = AUTO_CLOUD_OWNER_ID,
  onProgress?: (completed: number, total: number) => void
): Promise<number> {
  if (students.length === 0) return 0;
  const CHUNK_SIZE = 400;
  let totalWritten = 0;
  const effectiveOwnerId = uid || AUTO_CLOUD_OWNER_ID;

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const st of chunk) {
      const payload = buildValidStudentPayload(st as Student, effectiveOwnerId);
      const docRef = doc(db, 'students', payload.studentCode);
      batch.set(docRef, payload);
    }

    try {
      await batch.commit();
      totalWritten += chunk.length;
      if (onProgress) {
        onProgress(totalWritten, students.length);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    }
  }

  return totalWritten;
}

/**
 * บันทึกหรือแก้ไขสมาชิกผู้ใช้ลง Firestore โดยตรง
 */
export async function saveMemberDirectly(
  member: Member,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  const safeId = sanitizeId(member.memberId, 64);
  const docRef = doc(db, 'members', safeId);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data();
      const payload = {
        ...buildValidMemberPayload(member, ownerId),
        createdAt: current.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, payload);
    } else {
      const payload = buildValidMemberPayload(member, ownerId);
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `members/${safeId}`);
  }
}

/**
 * ลบสมาชิกออกจาก Firestore โดยตรง
 */
export async function deleteMemberDirectly(memberId: string): Promise<void> {
  const safeId = sanitizeId(memberId, 64);
  const docRef = doc(db, 'members', safeId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `members/${safeId}`);
  }
}

/**
 * บันทึกหรือแก้ไขสิทธิ์ Role Permission ลง Firestore โดยตรง
 */
export async function saveRolePermissionDirectly(
  rolePermission: RolePermission,
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  const safeRoleId = sanitizeId(rolePermission.roleId, 20);
  const docRef = doc(db, 'role_permissions', safeRoleId);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data();
      const payload = {
        ...buildValidRolePermissionPayload(rolePermission, ownerId),
        createdAt: current.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, payload);
    } else {
      const payload = buildValidRolePermissionPayload(rolePermission, ownerId);
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `role_permissions/${safeRoleId}`);
  }
}

// -------------------------------------------------------------
// 6. การแปลง Document Snapshot และการดึงข้อมูล Real-time
// -------------------------------------------------------------

function formatFirestoreTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function mapDocToStudent(docId: string, d: Record<string, unknown>, fallbackOwnerId: string): Student {
  return {
    studentCode: formatStudentCode(String(d.studentCode || docId)),
    seqNo: Number(d.seqNo || 1),
    prefix: String(d.prefix || ''),
    firstName: String(d.firstName || ''),
    lastName: String(d.lastName || ''),
    nickname: String(d.nickname || ''),
    grade: String(d.grade || ''),
    room: String(d.room || ''),
    dormitory: String(d.dormitory || ''),
    dormRoom: String(d.dormRoom || ''),
    bed: String(d.bed || ''),
    ownerId: String(d.ownerId || fallbackOwnerId),
    createdAt: formatFirestoreTimestamp(d.createdAt),
    updatedAt: formatFirestoreTimestamp(d.updatedAt),
  };
}

function mapDocToParcel(docId: string, d: Record<string, unknown>, fallbackOwnerId: string): Parcel {
  const rawCode = String(d.studentCode || '');
  return {
    id: docId,
    trackingNumber: String(d.trackingNumber || docId),
    studentCode: rawCode === 'UNKNOWN' ? 'UNKNOWN' : formatStudentCode(rawCode),
    studentFullName: String(d.studentFullName || ''),
    nickname: String(d.nickname || ''),
    gradeRoom: String(d.gradeRoom || ''),
    dormitory: String(d.dormitory || ''),
    dormRoom: String(d.dormRoom || ''),
    bed: String(d.bed || ''),
    category: (d.category as string) || 'อื่นๆ',
    status:
      d.status === 'ระหว่างส่งไปหอ'
        ? 'ลงทะเบียนรับพัสดุ'
        : ((d.status as Parcel['status']) || 'ลงทะเบียนรับพัสดุ'),
    courier: String(d.courier || 'Flash Express'),
    note: String(d.note || ''),
    receivedDate: String(d.receivedDate || ''),
    receivedHour: Number(d.receivedHour ?? 12),
    deliveredDate: d.deliveredDate ? String(d.deliveredDate) : '',
    ownerId: String(d.ownerId || fallbackOwnerId),
    createdAt: formatFirestoreTimestamp(d.createdAt),
    updatedAt: formatFirestoreTimestamp(d.updatedAt),
  };
}

function mapDocToMember(docId: string, d: Record<string, unknown>, fallbackOwnerId: string): Member {
  const rawRole = String(d.role || 'เจ้าหน้าที่');
  const role: MemberRole =
    rawRole === 'ผู้ดูแลระบบ'
      ? 'ผู้ดูแลระบบ'
      : rawRole === 'ครู'
      ? 'ครู'
      : 'เจ้าหน้าที่';

  return {
    memberId: String(d.memberId || docId),
    username: String(d.username || ''),
    password: String(d.password || ''),
    fullName: String(d.fullName || ''),
    role,
    allowedMenus: sanitizeMenuList(d.allowedMenus),
    useCustomMenus: Boolean(d.useCustomMenus),
    canEdit: d.canEdit !== undefined ? Boolean(d.canEdit) : role !== 'ครู',
    canDelete: d.canDelete !== undefined ? Boolean(d.canDelete) : role === 'ผู้ดูแลระบบ',
    active: d.active !== false,
    ownerId: String(d.ownerId || fallbackOwnerId),
    createdAt: formatFirestoreTimestamp(d.createdAt),
    updatedAt: formatFirestoreTimestamp(d.updatedAt),
  };
}

function mapDocToRolePermission(
  docId: string,
  d: Record<string, unknown>,
  fallbackOwnerId: string
): RolePermission {
  const rawId = String(d.roleId || docId);
  const roleId: RolePermission['roleId'] =
    rawId === 'admin'
      ? 'admin'
      : rawId === 'teacher'
      ? 'teacher'
      : 'staff';
  const roleName: MemberRole =
    roleId === 'admin'
      ? 'ผู้ดูแลระบบ'
      : roleId === 'teacher'
      ? 'ครู'
      : 'เจ้าหน้าที่';

  return {
    roleId,
    roleName,
    allowedMenus: sanitizeMenuList(d.allowedMenus),
    canEdit: d.canEdit !== undefined ? Boolean(d.canEdit) : roleId !== 'teacher',
    canDelete: d.canDelete !== undefined ? Boolean(d.canDelete) : roleId === 'admin',
    ownerId: String(d.ownerId || fallbackOwnerId),
    createdAt: formatFirestoreTimestamp(d.createdAt),
    updatedAt: formatFirestoreTimestamp(d.updatedAt),
  };
}

/**
 * ตรวจสอบและตั้งค่าข้อมูลสมาชิกและสิทธิ์เริ่มต้นบน Firestore หากฐานข้อมูลยังว่างเปล่า
 */
export async function initializeDefaultCloudDataIfEmpty(
  ownerId: string = AUTO_CLOUD_OWNER_ID
): Promise<void> {
  try {
    // 1. ตรวจสอบ Role Permissions
    const rpQuery = query(collection(db, 'role_permissions'), where('ownerId', '==', ownerId));
    const rpSnap = await getDocs(rpQuery);
    if (rpSnap.empty) {
      const batch = writeBatch(db);
      for (const rp of INITIAL_ROLE_PERMISSIONS) {
        const payload = buildValidRolePermissionPayload(rp, ownerId);
        const ref = doc(db, 'role_permissions', payload.roleId);
        batch.set(ref, payload);
      }
      await batch.commit();
    }

    // 2. ตรวจสอบ Members
    const mQuery = query(collection(db, 'members'), where('ownerId', '==', ownerId));
    const mSnap = await getDocs(mQuery);
    if (mSnap.empty) {
      const batch = writeBatch(db);
      for (const m of INITIAL_MEMBERS) {
        const payload = buildValidMemberPayload(m, ownerId);
        const ref = doc(db, 'members', payload.memberId);
        batch.set(ref, payload);
      }
      await batch.commit();
    }

    // 3. ตรวจสอบ Students
    const stQuery = query(collection(db, 'students'), where('ownerId', '==', ownerId));
    const stSnap = await getDocs(stQuery);
    if (stSnap.empty) {
      await batchImportStudentsToFirestore(INITIAL_STUDENTS, ownerId);
    }

    // 4. ตรวจสอบ Parcels
    const pQuery = query(collection(db, 'parcels'), where('ownerId', '==', ownerId));
    const pSnap = await getDocs(pQuery);
    if (pSnap.empty) {
      const batch = writeBatch(db);
      for (const p of INITIAL_PARCELS) {
        const payload = buildValidParcelPayload(p, ownerId);
        const ref = doc(db, 'parcels', payload.trackingNumber);
        batch.set(ref, payload);
      }
      await batch.commit();
    }
  } catch (error) {
    console.warn('Initial cloud seed note:', error);
  }
}

/**
 * ดึงข้อมูลสดจาก Firestore ทั้งหมดโดยตรง
 */
export async function fetchCloudDataDirectly(
  primaryOwnerId: string = AUTO_CLOUD_OWNER_ID,
  secondaryAuthUid?: string | null
): Promise<{
  students: Student[];
  parcels: Parcel[];
  members: Member[];
  rolePermissions: RolePermission[];
  readsCount: number;
}> {
  let readsCount = 0;
  const studentMap = new Map<string, Student>();
  const parcelMap = new Map<string, Parcel>();
  const memberMap = new Map<string, Member>();
  const rolePermMap = new Map<string, RolePermission>();

  const ownerIdsToFetch = Array.from(
    new Set(
      [primaryOwnerId, AUTO_CLOUD_OWNER_ID, secondaryAuthUid].filter(
        (id): id is string => Boolean(id && id.trim())
      )
    )
  );

  for (const ownerKey of ownerIdsToFetch) {
    try {
      const stQuery = query(collection(db, 'students'), where('ownerId', '==', ownerKey));
      const stSnap = await getDocs(stQuery);
      readsCount += stSnap.size || 1;
      stSnap.forEach((docSnap) => {
        const st = mapDocToStudent(docSnap.id, docSnap.data(), AUTO_CLOUD_OWNER_ID);
        studentMap.set(st.studentCode, st);
      });
    } catch (error) {
      if (ownerKey === AUTO_CLOUD_OWNER_ID) {
        handleFirestoreError(error, OperationType.LIST, 'students');
      }
    }

    try {
      const pQuery = query(collection(db, 'parcels'), where('ownerId', '==', ownerKey));
      const pSnap = await getDocs(pQuery);
      readsCount += pSnap.size || 1;
      pSnap.forEach((docSnap) => {
        const p = mapDocToParcel(docSnap.id, docSnap.data(), AUTO_CLOUD_OWNER_ID);
        parcelMap.set(p.id, p);
      });
    } catch (error) {
      if (ownerKey === AUTO_CLOUD_OWNER_ID) {
        handleFirestoreError(error, OperationType.LIST, 'parcels');
      }
    }

    try {
      const mQuery = query(collection(db, 'members'), where('ownerId', '==', ownerKey));
      const mSnap = await getDocs(mQuery);
      readsCount += mSnap.size || 1;
      mSnap.forEach((docSnap) => {
        const m = mapDocToMember(docSnap.id, docSnap.data(), AUTO_CLOUD_OWNER_ID);
        memberMap.set(m.memberId, m);
      });
    } catch (error) {
      if (ownerKey === AUTO_CLOUD_OWNER_ID) {
        handleFirestoreError(error, OperationType.LIST, 'members');
      }
    }

    try {
      const rpQuery = query(collection(db, 'role_permissions'), where('ownerId', '==', ownerKey));
      const rpSnap = await getDocs(rpQuery);
      readsCount += rpSnap.size || 1;
      rpSnap.forEach((docSnap) => {
        const rp = mapDocToRolePermission(docSnap.id, docSnap.data(), AUTO_CLOUD_OWNER_ID);
        rolePermMap.set(rp.roleId, rp);
      });
    } catch (error) {
      if (ownerKey === AUTO_CLOUD_OWNER_ID) {
        handleFirestoreError(error, OperationType.LIST, 'role_permissions');
      }
    }
  }

  return {
    students: Array.from(studentMap.values()).sort((a, b) => a.seqNo - b.seqNo),
    parcels: Array.from(parcelMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    members: Array.from(memberMap.values()),
    rolePermissions: Array.from(rolePermMap.values()),
    readsCount,
  };
}

/**
 * ติดตามข้อมูลแบบ Real-time Live Sync จาก Firestore โดยตรง
 */
export function subscribeToWorkspaceCloudData(
  ownerId: string = AUTO_CLOUD_OWNER_ID,
  onStudentsSnapshot: (students: Student[]) => void,
  onParcelsSnapshot: (parcels: Parcel[]) => void,
  onMembersSnapshot?: (members: Member[]) => void,
  onRolePermissionsSnapshot?: (rolePermissions: RolePermission[]) => void
): () => void {
  const effectiveOwnerId = ownerId || AUTO_CLOUD_OWNER_ID;
  const stQuery = query(collection(db, 'students'), where('ownerId', '==', effectiveOwnerId));
  const pQuery = query(collection(db, 'parcels'), where('ownerId', '==', effectiveOwnerId));
  const mQuery = query(collection(db, 'members'), where('ownerId', '==', effectiveOwnerId));
  const rpQuery = query(collection(db, 'role_permissions'), where('ownerId', '==', effectiveOwnerId));

  const unsubStudents = onSnapshot(
    stQuery,
    (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        list.push(mapDocToStudent(docSnap.id, docSnap.data(), effectiveOwnerId));
      });
      list.sort((a, b) => a.seqNo - b.seqNo);
      onStudentsSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'students');
      } catch {
        // logged via handleFirestoreError
      }
    }
  );

  const unsubParcels = onSnapshot(
    pQuery,
    (snapshot) => {
      const list: Parcel[] = [];
      snapshot.forEach((docSnap) => {
        list.push(mapDocToParcel(docSnap.id, docSnap.data(), effectiveOwnerId));
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onParcelsSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'parcels');
      } catch {
        // logged via handleFirestoreError
      }
    }
  );

  const unsubMembers = onSnapshot(
    mQuery,
    (snapshot) => {
      if (!onMembersSnapshot) return;
      const list: Member[] = [];
      snapshot.forEach((docSnap) => {
        list.push(mapDocToMember(docSnap.id, docSnap.data(), effectiveOwnerId));
      });
      onMembersSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'members');
      } catch {
        // logged via handleFirestoreError
      }
    }
  );

  const unsubRolePerms = onSnapshot(
    rpQuery,
    (snapshot) => {
      if (!onRolePermissionsSnapshot) return;
      const list: RolePermission[] = [];
      snapshot.forEach((docSnap) => {
        list.push(mapDocToRolePermission(docSnap.id, docSnap.data(), effectiveOwnerId));
      });
      onRolePermissionsSnapshot(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'role_permissions');
      } catch {
        // logged via handleFirestoreError
      }
    }
  );

  return () => {
    unsubStudents();
    unsubParcels();
    unsubMembers();
    unsubRolePerms();
  };
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };
