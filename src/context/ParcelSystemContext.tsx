import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Student,
  Parcel,
  ParcelCategory,
  ParcelStatus,
  Member,
  MemberRole,
  RolePermission,
  AppMenuKey,
  ALL_MENU_KEYS,
  DEFAULT_STAFF_MENU_KEYS,
  DEFAULT_TEACHER_MENU_KEYS,
  INITIAL_MEMBERS,
  INITIAL_ROLE_PERMISSIONS,
  PendingWriteItem,
  QuotaMetrics,
  getRelativeDateString,
  isUnknownOwnerParcel,
  StudentParcelCountStats,
  WEEKLY_PARCEL_WARNING_LIMIT,
  getStudentParcelCountStats,
  buildAllStudentParcelStats,
} from '../types/parcel';
import {
  auth,
  User,
  onAuthStateChanged,
  signInWithGooglePopup,
  signOutFirebaseUser,
  createParcelDirectly,
  updateParcelDirectly,
  deleteParcelDirectly,
  bulkUpdateParcelsDirectly,
  saveStudentDirectly,
  deleteStudentDirectly,
  bulkDeleteStudentsDirectly,
  batchImportStudentsToFirestore,
  saveMemberDirectly,
  deleteMemberDirectly,
  saveRolePermissionDirectly,
  initializeDefaultCloudDataIfEmpty,
  fetchCloudDataDirectly,
  subscribeToWorkspaceCloudData,
  sanitizeId,
  AUTO_CLOUD_EMAIL,
  AUTO_CLOUD_OWNER_ID,
} from '../services/firebase';

// รายการคีย์ LocalStorage ในเครื่องทั้งหมดที่ต้องลบทิ้ง เพื่อยกเลิกการเก็บข้อมูลไว้บนเครื่องอย่างสมบูรณ์
const STORAGE_KEYS_TO_PURGE = [
  'spms_students_cache_v1',
  'spms_parcels_cache_v1',
  'spms_pending_writes_v1',
  'spms_quota_metrics_v1',
  'spms_students_prod_v2',
  'spms_parcels_prod_v2',
  'spms_pending_writes_prod_v2',
  'spms_quota_metrics_prod_v2',
  'spms_sync_mode_clean_v3',
  'spms_students_clean_v3',
  'spms_parcels_clean_v3',
  'spms_members_clean_v1',
  'spms_role_permissions_clean_v1',
  'spms_pending_writes_clean_v3',
  'spms_quota_metrics_clean_v3',
  'spms_sync_mode_auto_v4',
];

// เก็บเฉพาะรหัสสมาชิกที่ล็อกอินค้างไว้ เพื่อไม่ให้ผู้ใช้งานถูกเด้งออกจากระบบทุกครั้งที่รีเฟรชหน้าจอ
const SESSION_MEMBER_KEY = 'spms_session_member_id_v2';

export type SyncMode = 'auto_cloud';

export interface NewParcelInput {
  trackingNumber: string;
  studentCode: string;
  category: ParcelCategory;
  status: ParcelStatus;
  courier: string;
  note: string;
  customStudent?: {
    studentFullName: string;
    nickname: string;
    gradeRoom: string;
    dormitory: string;
    dormRoom: string;
    bed: string;
  };
}

export interface UpsertMemberInput {
  memberId?: string;
  username: string;
  password: string;
  fullName: string;
  role: MemberRole;
  allowedMenus: AppMenuKey[];
  useCustomMenus: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  active: boolean;
}

export interface WeeklyWarningPopupState {
  isOpen: boolean;
  focusedStudent: StudentParcelCountStats | null;
  triggerReason?: 'inbound_added' | 'student_lookup' | 'auto_detect' | 'manual';
}

interface ParcelSystemContextValue {
  user: User | null;
  connectedEmail: string;
  authReady: boolean;
  currentMember: Member | null;
  members: Member[];
  rolePermissions: RolePermission[];
  allowedMenusForCurrentMember: AppMenuKey[];
  canCurrentMemberEdit: boolean;
  canCurrentMemberDelete: boolean;
  loginWithCredentials: (username: string, password: string) => { success: boolean; message: string };
  loginWithGoogleAccount: () => Promise<{ success: boolean; message: string }>;
  logoutMember: () => void;
  upsertMember: (input: UpsertMemberInput) => Promise<Member>;
  deleteMember: (memberId: string) => Promise<void>;
  updateRolePermission: (
    roleId: 'admin' | 'staff' | 'teacher' | 'user',
    allowedMenus: AppMenuKey[],
    canEdit?: boolean,
    canDelete?: boolean
  ) => Promise<void>;
  getEffectiveMemberMenus: (member: Member) => AppMenuKey[];
  students: Student[];
  studentMap: Map<string, Student>;
  parcels: Parcel[];
  studentParcelStatsMap: Map<string, StudentParcelCountStats>;
  allStudentParcelStats: StudentParcelCountStats[];
  overWeeklyLimitStudents: StudentParcelCountStats[];
  getStudentParcelCounts: (
    studentCode?: string,
    studentFullName?: string,
    studentMeta?: Partial<Student>
  ) => StudentParcelCountStats;
  weeklyWarningPopup: WeeklyWarningPopupState;
  openWeeklyWarningPopup: (
    focusedStudent?: StudentParcelCountStats | null,
    reason?: WeeklyWarningPopupState['triggerReason']
  ) => void;
  closeWeeklyWarningPopup: () => void;
  pendingWrites: PendingWriteItem[];
  quotaMetrics: QuotaMetrics;
  syncMode: SyncMode;
  isSyncing: boolean;
  syncProgress: { completed: number; total: number } | null;
  toastMessage: { text: string; type: 'success' | 'info' | 'warning' | 'error' } | null;
  clearToast: () => void;
  setSyncMode: (mode: SyncMode) => void;
  lookupStudentByCode: (code: string) => Student | undefined;
  searchStudentsLocal: (keyword: string) => Student[];
  searchParcelsLocal: (keyword: string, statusFilter?: string, dormFilter?: string, dateFilter?: string) => Parcel[];
  recordLocalSearchSaving: () => void;
  addInboundParcel: (input: NewParcelInput) => Promise<Parcel>;
  updateParcelStatus: (parcelId: string, newStatus: ParcelStatus, note?: string, deliveredDate?: string) => Promise<void>;
  bulkUpdateParcelStatus: (parcelIds: string[], newStatus: ParcelStatus, deliveredDate?: string) => Promise<void>;
  deleteParcel: (parcelId: string) => Promise<void>;
  bulkImportStudents: (newStudents: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>[], commitImmediately?: boolean) => Promise<number>;
  upsertSingleStudent: (student: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteStudent: (studentCode: string) => Promise<void>;
  bulkDeleteStudents: (studentCodes: string[], targetLabel?: string) => Promise<void>;
  clearAllStudents: () => Promise<void>;
  syncPendingToFirebase: () => Promise<void>;
  pullFromFirebaseToLocal: () => Promise<void>;
  clearAllLocalData: () => void;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const ParcelSystemContext = createContext<ParcelSystemContextValue | undefined>(undefined);

// ผู้ใช้ Workspace อัตโนมัติภายใต้บัญชี Tasawan_app01@pcccr.ac.th
const AUTO_BOUND_USER = {
  uid: AUTO_CLOUD_OWNER_ID,
  email: AUTO_CLOUD_EMAIL,
  displayName: AUTO_CLOUD_EMAIL,
  emailVerified: true,
  isAnonymous: false,
} as unknown as User;

function purgeLocalMachineData(): void {
  try {
    for (const key of STORAGE_KEYS_TO_PURGE) {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Local storage purge warning:', err);
  }
}

export const ParcelSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(true);

  const user = useMemo<User>(() => firebaseAuthUser || AUTO_BOUND_USER, [firebaseAuthUser]);
  const connectedEmail = AUTO_CLOUD_EMAIL;

  // ข้อมูลทั้งหมดโหลดโดยตรงจาก Firestore ไม่เก็บไว้ใน LocalStorage บนเครื่อง
  const [students, setStudents] = useState<Student[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>(INITIAL_ROLE_PERMISSIONS);

  // รหัสสมาชิกปัจจุบันสำหรับการล็อกอิน
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_MEMBER_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ completed: number; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'warning' | 'error';
  } | null>(null);
  const [weeklyWarningPopup, setWeeklyWarningPopup] = useState<WeeklyWarningPopupState>({
    isOpen: false,
    focusedStudent: null,
  });

  const [quotaMetrics, setQuotaMetrics] = useState<QuotaMetrics>({
    localLookupsSaved: 0,
    batchedWritesQueued: 0,
    firestoreReadsUsed: 0,
    firestoreWritesUsed: 0,
    lastSyncedAt: new Date().toISOString(),
  });

  // โหมดเชื่อมต่อตรงกับ Cloud เสมอ ไม่พักในเครื่อง
  const syncMode: SyncMode = 'auto_cloud';
  const pendingWrites: PendingWriteItem[] = useMemo(() => [], []);

  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      setToastMessage({ text, type });
    },
    []
  );

  const clearToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ติดตามสถานะ Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseAuthUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // บันทึกเฉพาะ Session ID ของสมาชิกที่ล็อกอินอยู่ (ไม่เก็บข้อมูลพัสดุหรือนักเรียนบนเครื่อง)
  useEffect(() => {
    try {
      if (currentMemberId) {
        localStorage.setItem(SESSION_MEMBER_KEY, currentMemberId);
      } else {
        localStorage.removeItem(SESSION_MEMBER_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentMemberId]);

  // ล้างแคชข้อมูลบนเครื่องทั้งหมดเมื่อเริ่มต้นใช้งาน เพื่อให้ทำงานตรงกับ Firestore 100%
  useEffect(() => {
    purgeLocalMachineData();
  }, []);

  // โหลดข้อมูลโดยตรงจาก Firestore และตั้งค่าเริ่มต้นถ้าว่าง
  const loadDataDirectlyFromFirestore = useCallback(async () => {
    setIsSyncing(true);
    try {
      // ตรวจสอบและตั้งค่าเริ่มต้นหากเป็นฐานข้อมูลใหม่
      await initializeDefaultCloudDataIfEmpty(AUTO_CLOUD_OWNER_ID);

      const data = await fetchCloudDataDirectly(AUTO_CLOUD_OWNER_ID, firebaseAuthUser?.uid);
      setStudents(data.students);
      setParcels(data.parcels);
      if (data.members.length > 0) {
        setMembers(data.members);
      }
      if (data.rolePermissions.length > 0) {
        setRolePermissions(data.rolePermissions);
      }
      setQuotaMetrics((prev) => ({
        ...prev,
        firestoreReadsUsed: prev.firestoreReadsUsed + data.readsCount,
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Failed to load directly from Firestore:', err);
      showToast(
        `เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Firestore: ${err instanceof Error ? err.message : 'Error'}`,
        'error'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseAuthUser?.uid, showToast]);

  // ทำการเชื่อมต่อครั้งแรกเมื่อเปิดโปรแกรม
  useEffect(() => {
    loadDataDirectlyFromFirestore();
  }, [loadDataDirectlyFromFirestore]);

  // เชื่อมต่อ Real-time Live Snapshot จาก Firestore โดยตรง ทุกครั้งที่ข้อมูลในฐานข้อมูลเปลี่ยน UI จะเปลี่ยนทันที
  useEffect(() => {
    const unsubscribe = subscribeToWorkspaceCloudData(
      AUTO_CLOUD_OWNER_ID,
      (cloudStudents) => {
        setStudents(cloudStudents);
      },
      (cloudParcels) => {
        setParcels(cloudParcels);
      },
      (cloudMembers) => {
        if (cloudMembers.length > 0) {
          setMembers(cloudMembers);
        }
      },
      (cloudRolePerms) => {
        if (cloudRolePerms.length > 0) {
          setRolePermissions(cloudRolePerms);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // In-Memory Hash Map สำหรับค้นหาข้อมูลนักเรียนทันที
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(s.studentCode.trim().toLowerCase(), s);
    }
    return map;
  }, [students]);

  // คำนวณสถิติพัสดุของนักเรียน
  const {
    byStudentCode: studentParcelStatsMap,
    allStats: allStudentParcelStats,
    overWeeklyLimitList: overWeeklyLimitStudents,
  } = useMemo(() => buildAllStudentParcelStats(students, parcels), [students, parcels]);

  const getStudentParcelCounts = useCallback(
    (
      studentCode?: string,
      studentFullName?: string,
      studentMeta?: Partial<Student>
    ): StudentParcelCountStats => {
      const cleanCode = (studentCode || '').trim().toLowerCase();
      if (cleanCode && cleanCode !== 'unknown' && cleanCode !== '-') {
        const cached = studentParcelStatsMap.get(cleanCode);
        if (cached) return cached;
      }
      return getStudentParcelCountStats(parcels, studentCode, studentFullName, studentMeta);
    },
    [parcels, studentParcelStatsMap]
  );

  const openWeeklyWarningPopup = useCallback(
    (
      focusedStudent?: StudentParcelCountStats | null,
      reason: WeeklyWarningPopupState['triggerReason'] = 'manual'
    ) => {
      setWeeklyWarningPopup({
        isOpen: true,
        focusedStudent: focusedStudent || null,
        triggerReason: reason,
      });
    },
    []
  );

  const closeWeeklyWarningPopup = useCallback(() => {
    setWeeklyWarningPopup((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const lookupStudentByCode = useCallback(
    (code: string): Student | undefined => {
      const clean = code.trim().toLowerCase();
      if (!clean) return undefined;
      return studentMap.get(clean);
    },
    [studentMap]
  );

  const searchStudentsLocal = useCallback(
    (keyword: string): Student[] => {
      const clean = keyword.trim().toLowerCase();
      if (!clean) return students;
      return students.filter(
        (s) =>
          s.studentCode.toLowerCase().includes(clean) ||
          s.firstName.toLowerCase().includes(clean) ||
          s.lastName.toLowerCase().includes(clean) ||
          s.nickname.toLowerCase().includes(clean) ||
          s.dormitory.toLowerCase().includes(clean) ||
          s.dormRoom.toLowerCase().includes(clean) ||
          s.grade.toLowerCase().includes(clean) ||
          s.room.toLowerCase().includes(clean)
      );
    },
    [students]
  );

  const searchParcelsLocal = useCallback(
    (keyword: string, statusFilter = 'ALL', dormFilter = 'ALL', dateFilter = 'ALL'): Parcel[] => {
      const clean = keyword.trim().toLowerCase();
      return parcels.filter((p) => {
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        if (dormFilter !== 'ALL' && p.dormitory !== dormFilter) return false;
        if (dateFilter !== 'ALL' && p.receivedDate !== dateFilter) return false;
        if (!clean) return true;
        return (
          p.trackingNumber.toLowerCase().includes(clean) ||
          p.studentCode.toLowerCase().includes(clean) ||
          p.studentFullName.toLowerCase().includes(clean) ||
          p.nickname.toLowerCase().includes(clean) ||
          p.dormitory.toLowerCase().includes(clean) ||
          p.dormRoom.toLowerCase().includes(clean) ||
          p.bed.toLowerCase().includes(clean) ||
          p.courier.toLowerCase().includes(clean) ||
          p.category.toLowerCase().includes(clean) ||
          p.note.toLowerCase().includes(clean)
        );
      });
    },
    [parcels]
  );

  const recordLocalSearchSaving = useCallback(() => {
    setQuotaMetrics((prev) => ({
      ...prev,
      localLookupsSaved: prev.localLookupsSaved + 1,
    }));
  }, []);

  // -----------------------------------------------------------------
  // การดำเนินการ บันทึก / แก้ไข / ลบ กับฐานข้อมูล Firestore โดยตรง
  // -----------------------------------------------------------------

  /**
   * บันทึกรับเข้าพัสดุใหม่ลงฐานข้อมูล Firestore โดยตรง
   */
  const addInboundParcel = useCallback(
    async (input: NewParcelInput): Promise<Parcel> => {
      const trackingNumber = input.trackingNumber.trim();
      const studentCode = input.studentCode.trim();
      const matchedStudent = lookupStudentByCode(studentCode);
      const isUnknown = input.status === 'พัสดุไม่ทราบเจ้าของ';

      const studentFullName = isUnknown
        ? 'ไม่ทราบชื่อผู้รับ'
        : input.customStudent?.studentFullName ||
          (matchedStudent
            ? `${matchedStudent.prefix}${matchedStudent.firstName} ${matchedStudent.lastName}`
            : 'ไม่ระบุชื่อ');

      const nickname = isUnknown
        ? ''
        : input.customStudent?.nickname || matchedStudent?.nickname || '';
      const gradeRoom = isUnknown
        ? '-'
        : input.customStudent?.gradeRoom ||
          (matchedStudent ? `${matchedStudent.grade}/${matchedStudent.room}` : '-');
      const dormitory = isUnknown
        ? 'ส่วนกลาง (รอระบุหอ)'
        : input.customStudent?.dormitory || matchedStudent?.dormitory || 'ไม่ระบุหอ';
      const dormRoom = isUnknown
        ? '-'
        : input.customStudent?.dormRoom || matchedStudent?.dormRoom || '-';
      const bed = isUnknown
        ? '-'
        : input.customStudent?.bed || matchedStudent?.bed || '-';

      const now = new Date();
      const isoNow = now.toISOString();

      const newParcel: Parcel = {
        id: trackingNumber,
        trackingNumber,
        studentCode: isUnknown ? 'UNKNOWN' : studentCode || 'UNKNOWN',
        studentFullName,
        nickname,
        gradeRoom,
        dormitory,
        dormRoom,
        bed,
        category: input.category,
        status: input.status,
        courier: input.courier,
        note: input.note.trim(),
        receivedDate: getRelativeDateString(0),
        receivedHour: now.getHours(),
        ownerId: AUTO_CLOUD_OWNER_ID,
        createdAt: isoNow,
        updatedAt: isoNow,
      };

      // บันทึกลง Firestore โดยตรง
      try {
        await createParcelDirectly(newParcel, AUTO_CLOUD_OWNER_ID);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`บันทึกพัสดุ ${newParcel.trackingNumber} ลงฐานข้อมูล Firestore สำเร็จ`, 'success');
      } catch (err) {
        showToast(
          `เกิดข้อผิดพลาดในการบันทึกพัสดุลงฐานข้อมูล: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }

      // ตรวจสอบเตือนพัสดุเกินสัปดาห์ละ 3 ชิ้น
      if (!isUnknownOwnerParcel(newParcel)) {
        const updatedList = [newParcel, ...parcels];
        const stats = getStudentParcelCountStats(
          updatedList,
          newParcel.studentCode,
          newParcel.studentFullName,
          matchedStudent
        );
        if (stats.weekCount > WEEKLY_PARCEL_WARNING_LIMIT) {
          openWeeklyWarningPopup(stats, 'inbound_added');
        }
      }

      return newParcel;
    },
    [lookupStudentByCode, parcels, openWeeklyWarningPopup, showToast]
  );

  /**
   * อัปเดตสถานะพัสดุในฐานข้อมูล Firestore โดยตรง
   */
  const updateParcelStatus = useCallback(
    async (
      parcelId: string,
      newStatus: ParcelStatus,
      note?: string,
      deliveredDate?: string
    ): Promise<void> => {
      const effectiveDeliveredDate =
        newStatus === 'ส่งมอบสำเร็จ'
          ? (deliveredDate || getRelativeDateString(0)).slice(0, 20)
          : '';

      try {
        await updateParcelDirectly(
          parcelId,
          {
            status: newStatus,
            ...(note !== undefined ? { note: note.slice(0, 300) } : {}),
            deliveredDate: effectiveDeliveredDate,
          },
          AUTO_CLOUD_OWNER_ID
        );

        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`อัปเดตสถานะพัสดุ ${parcelId} เป็น "${newStatus}" บนฐานข้อมูล Firestore แล้ว`, 'success');
      } catch (err) {
        showToast(
          `ไม่สามารถอัปเดตสถานะบนฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [showToast]
  );

  /**
   * อัปเดตสถานะพัสดุหลายรายการพร้อมกันในฐานข้อมูล Firestore โดยตรง
   */
  const bulkUpdateParcelStatus = useCallback(
    async (
      parcelIds: string[],
      newStatus: ParcelStatus,
      deliveredDate?: string
    ): Promise<void> => {
      if (parcelIds.length === 0) return;
      try {
        const count = await bulkUpdateParcelsDirectly(
          parcelIds,
          newStatus,
          deliveredDate,
          AUTO_CLOUD_OWNER_ID
        );
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + count,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`อัปเดตพัสดุ ${count} รายการเป็น "${newStatus}" บนฐานข้อมูล Firestore สำเร็จ`, 'success');
      } catch (err) {
        showToast(
          `เกิดข้อผิดพลาดในการอัปเดตพัสดุหลายรายการ: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [showToast]
  );

  /**
   * ลบพัสดุออกจากฐานข้อมูล Firestore โดยตรง
   */
  const deleteParcel = useCallback(
    async (parcelId: string): Promise<void> => {
      try {
        await deleteParcelDirectly(parcelId);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`ลบรายการพัสดุ ${parcelId} จากฐานข้อมูล Firestore สำเร็จ`, 'info');
      } catch (err) {
        showToast(
          `ไม่สามารถลบพัสดุออกจากฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [showToast]
  );

  /**
   * นำเข้าข้อมูลนักเรียนจำนวนมาก (Bulk Import) ลงฐานข้อมูล Firestore โดยตรง
   */
  const bulkImportStudents = useCallback(
    async (
      rawStudents: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>[]
    ): Promise<number> => {
      if (rawStudents.length === 0) return 0;
      setIsSyncing(true);
      setSyncProgress({ completed: 0, total: rawStudents.length });

      try {
        const written = await batchImportStudentsToFirestore(
          rawStudents,
          AUTO_CLOUD_OWNER_ID,
          (completed, total) => setSyncProgress({ completed, total })
        );

        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + written,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(
          `นำเข้าและบันทึกข้อมูลนักเรียน ${written} คนลงฐานข้อมูล Firestore (${AUTO_CLOUD_EMAIL}) เรียบร้อยแล้ว`,
          'success'
        );
        return written;
      } catch (err) {
        showToast(
          `เกิดข้อผิดพลาดในการนำเข้านักเรียนลงฐานข้อมูล: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [showToast]
  );

  /**
   * บันทึกหรือแก้ไขข้อมูลนักเรียนรายคนลงฐานข้อมูล Firestore โดยตรง
   */
  const upsertSingleStudent = useCallback(
    async (student: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<void> => {
      try {
        await saveStudentDirectly(student, AUTO_CLOUD_OWNER_ID);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`บันทึกข้อมูลนักเรียนรหัส ${student.studentCode} ลงฐานข้อมูล Firestore สำเร็จ`, 'success');
      } catch (err) {
        showToast(
          `ไม่สามารถบันทึกข้อมูลนักเรียนลงฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [showToast]
  );

  /**
   * ลบข้อมูลนักเรียนรายคนออกจากฐานข้อมูล Firestore โดยตรง
   */
  const deleteStudent = useCallback(
    async (studentCode: string): Promise<void> => {
      try {
        await deleteStudentDirectly(studentCode);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`ลบข้อมูลนักเรียนรหัส ${studentCode} ออกจากฐานข้อมูล Firestore แล้ว`, 'info');
      } catch (err) {
        showToast(
          `ไม่สามารถลบข้อมูลนักเรียนออกจากฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [showToast]
  );

  /**
   * ลบข้อมูลนักเรียนหลายคนออกจากฐานข้อมูล Firestore โดยตรง
   */
  const bulkDeleteStudents = useCallback(
    async (studentCodes: string[], targetLabel?: string): Promise<void> => {
      if (studentCodes.length === 0) return;
      setIsSyncing(true);
      setSyncProgress({ completed: 0, total: studentCodes.length });

      try {
        const deletedCount = await bulkDeleteStudentsDirectly(studentCodes);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + deletedCount,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(
          `ลบข้อมูลนักเรียน${targetLabel ? ` (${targetLabel})` : ''} จำนวน ${deletedCount} คน จากฐานข้อมูล Firestore สำเร็จ`,
          'info'
        );
      } catch (err) {
        showToast(
          `ไม่สามารถลบข้อมูลนักเรียนจากฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [showToast]
  );

  /**
   * ล้างข้อมูลนักเรียนทั้งหมดในฐานข้อมูล Firestore โดยตรง
   */
  const clearAllStudents = useCallback(async () => {
    const allCodes = students.map((s) => s.studentCode);
    if (allCodes.length === 0) {
      showToast('ไม่มีข้อมูลนักเรียนในระบบ', 'info');
      return;
    }
    await bulkDeleteStudents(allCodes, 'ทั้งหมดในฐานข้อมูล Firestore');
  }, [students, bulkDeleteStudents, showToast]);

  /**
   * บันทึกหรือแก้ไขสมาชิกผู้ใช้ลงฐานข้อมูล Firestore โดยตรง
   */
  const upsertMember = useCallback(
    async (input: UpsertMemberInput): Promise<Member> => {
      const isExisting = Boolean(input.memberId && members.some((m) => m.memberId === input.memberId));
      const existingMember = isExisting ? members.find((m) => m.memberId === input.memberId) : undefined;
      const generatedId =
        input.memberId && input.memberId.trim()
          ? sanitizeId(input.memberId.trim(), 64)
          : sanitizeId(`mem_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 64);

      const safeRole: MemberRole =
        input.role === 'ผู้ดูแลระบบ'
          ? 'ผู้ดูแลระบบ'
          : input.role === 'ครู'
          ? 'ครู'
          : 'เจ้าหน้าที่';

      const cleanAllowedMenus: AppMenuKey[] =
        input.allowedMenus && input.allowedMenus.length > 0
          ? Array.from(new Set(input.allowedMenus))
          : safeRole === 'ผู้ดูแลระบบ'
          ? [...ALL_MENU_KEYS]
          : safeRole === 'ครู'
          ? [...DEFAULT_TEACHER_MENU_KEYS]
          : [...DEFAULT_STAFF_MENU_KEYS];

      if (safeRole === 'ผู้ดูแลระบบ' && input.useCustomMenus && !cleanAllowedMenus.includes('members')) {
        cleanAllowedMenus.push('members');
      }

      const defaultCanEdit = safeRole === 'ผู้ดูแลระบบ' ? true : safeRole === 'ครู' ? false : true;
      const defaultCanDelete = safeRole === 'ผู้ดูแลระบบ';

      const memberObj: Member = {
        memberId: generatedId,
        username: input.username.trim().slice(0, 80),
        password: input.password.trim().slice(0, 100),
        fullName: input.fullName.trim().slice(0, 150),
        role: safeRole,
        allowedMenus: cleanAllowedMenus,
        useCustomMenus: Boolean(input.useCustomMenus),
        canEdit: input.canEdit !== undefined ? Boolean(input.canEdit) : defaultCanEdit,
        canDelete: input.canDelete !== undefined ? Boolean(input.canDelete) : defaultCanDelete,
        active: input.active !== false,
        ownerId: AUTO_CLOUD_OWNER_ID,
        createdAt: existingMember ? existingMember.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveMemberDirectly(memberObj, AUTO_CLOUD_OWNER_ID);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(
          `${isExisting ? 'แก้ไขข้อมูล' : 'เพิ่ม'}สมาชิก "${memberObj.fullName}" (${memberObj.role}) บนฐานข้อมูล Firestore สำเร็จ`,
          'success'
        );
        return memberObj;
      } catch (err) {
        showToast(
          `ไม่สามารถบันทึกข้อมูลสมาชิกลงฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [members, showToast]
  );

  /**
   * ลบสมาชิกออกจากฐานข้อมูล Firestore โดยตรง
   */
  const deleteMember = useCallback(
    async (memberId: string): Promise<void> => {
      const target = members.find((m) => m.memberId === memberId);
      if (!target) return;

      const remainingAdmins = members.filter(
        (m) => m.memberId !== memberId && m.role === 'ผู้ดูแลระบบ' && m.active
      );
      if (target.role === 'ผู้ดูแลระบบ' && remainingAdmins.length === 0) {
        showToast('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายของระบบได้', 'error');
        return;
      }

      try {
        await deleteMemberDirectly(memberId);
        if (currentMemberId === memberId) {
          setCurrentMemberId(null);
        }
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`ลบสมาชิก "${target.fullName}" ออกจากฐานข้อมูล Firestore แล้ว`, 'info');
      } catch (err) {
        showToast(
          `ไม่สามารถลบสมาชิกออกจากฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [members, currentMemberId, showToast]
  );

  /**
   * บันทึกหรือแก้ไขสิทธิ์ของ Role ในฐานข้อมูล Firestore โดยตรง
   */
  const updateRolePermission = useCallback(
    async (
      roleId: 'admin' | 'staff' | 'teacher' | 'user',
      allowedMenus: AppMenuKey[],
      canEdit?: boolean,
      canDelete?: boolean
    ): Promise<void> => {
      const safeMenus: AppMenuKey[] = Array.from(new Set(allowedMenus));
      if (roleId === 'admin' && !safeMenus.includes('members')) {
        safeMenus.push('members');
      }
      if (safeMenus.length === 0) {
        safeMenus.push('inbound');
      }

      const roleName: MemberRole =
        roleId === 'admin'
          ? 'ผู้ดูแลระบบ'
          : roleId === 'teacher'
          ? 'ครู'
          : 'เจ้าหน้าที่';

      const existingRole = rolePermissions.find((rp) => rp.roleId === roleId);
      const updatedRole: RolePermission = {
        roleId,
        roleName,
        allowedMenus: safeMenus,
        canEdit: canEdit !== undefined ? canEdit : existingRole?.canEdit ?? (roleId !== 'teacher'),
        canDelete: canDelete !== undefined ? canDelete : existingRole?.canDelete ?? (roleId === 'admin'),
        ownerId: AUTO_CLOUD_OWNER_ID,
        createdAt: existingRole ? existingRole.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveRolePermissionDirectly(updatedRole, AUTO_CLOUD_OWNER_ID);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + 1,
          lastSyncedAt: new Date().toISOString(),
        }));
        showToast(`บันทึกสิทธิ์ของระดับ "${updatedRole.roleName}" ลงฐานข้อมูล Firestore สำเร็จ`, 'success');
      } catch (err) {
        showToast(
          `ไม่สามารถบันทึกสิทธิ์ลงฐานข้อมูลได้: ${err instanceof Error ? err.message : 'Error'}`,
          'error'
        );
        throw err;
      }
    },
    [rolePermissions, showToast]
  );

  // คำนวณสิทธิ์เมนูที่สมาชิกแต่ละคนมีสิทธิ์เข้าถึง
  const getEffectiveMemberMenus = useCallback(
    (member: Member): AppMenuKey[] => {
      if (member.useCustomMenus) {
        return member.allowedMenus.length > 0 ? member.allowedMenus : ['inbound'];
      }
      const roleKey =
        member.role === 'ผู้ดูแลระบบ'
          ? 'admin'
          : member.role === 'ครู'
          ? 'teacher'
          : 'staff';
      const foundRole = rolePermissions.find(
        (rp) => rp.roleId === roleKey || rp.roleName === member.role
      );
      if (foundRole && foundRole.allowedMenus.length > 0) {
        return foundRole.allowedMenus;
      }
      if (member.role === 'ผู้ดูแลระบบ') return [...ALL_MENU_KEYS];
      if (member.role === 'ครู') return [...DEFAULT_TEACHER_MENU_KEYS];
      return [...DEFAULT_STAFF_MENU_KEYS];
    },
    [rolePermissions]
  );

  const currentMember = useMemo<Member | null>(() => {
    if (!currentMemberId) return null;
    const found = members.find((m) => m.memberId === currentMemberId);
    if (!found || !found.active) return null;
    return found;
  }, [currentMemberId, members]);

  const allowedMenusForCurrentMember = useMemo<AppMenuKey[]>(() => {
    if (!currentMember) return [];
    return getEffectiveMemberMenus(currentMember);
  }, [currentMember, getEffectiveMemberMenus]);

  const canCurrentMemberEdit = useMemo<boolean>(() => {
    if (!currentMember) return false;
    if (currentMember.role === 'ผู้ดูแลระบบ') return true;
    if (currentMember.canEdit !== undefined) return Boolean(currentMember.canEdit);
    const roleKey = currentMember.role === 'ครู' ? 'teacher' : 'staff';
    const foundRole = rolePermissions.find(
      (rp) => rp.roleId === roleKey || rp.roleName === currentMember.role
    );
    if (foundRole && foundRole.canEdit !== undefined) return Boolean(foundRole.canEdit);
    return currentMember.role !== 'ครู';
  }, [currentMember, rolePermissions]);

  const canCurrentMemberDelete = useMemo<boolean>(() => {
    if (!currentMember) return false;
    if (currentMember.role === 'ผู้ดูแลระบบ') return true;
    if (currentMember.canDelete !== undefined) return Boolean(currentMember.canDelete);
    const roleKey = currentMember.role === 'ครู' ? 'teacher' : 'staff';
    const foundRole = rolePermissions.find(
      (rp) => rp.roleId === roleKey || rp.roleName === currentMember.role
    );
    if (foundRole && foundRole.canDelete !== undefined) return Boolean(foundRole.canDelete);
    return false;
  }, [currentMember, rolePermissions]);

  const loginWithCredentials = useCallback(
    (usernameInput: string, passwordInput: string): { success: boolean; message: string } => {
      const cleanUser = usernameInput.trim().toLowerCase();
      const cleanPass = passwordInput.trim();

      if (!cleanUser || !cleanPass) {
        return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน' };
      }

      const matched = members.find(
        (m) => m.username.trim().toLowerCase() === cleanUser && m.password === cleanPass
      );

      if (!matched) {
        return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }

      if (!matched.active) {
        return { success: false, message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ' };
      }

      setCurrentMemberId(matched.memberId);
      showToast(`เข้าสู่ระบบสำเร็จ: ${matched.fullName} (${matched.role})`, 'success');
      return { success: true, message: 'เข้าสู่ระบบสำเร็จ' };
    },
    [members, showToast]
  );

  const loginWithGoogleAccount = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    try {
      const loggedInUser = await signInWithGooglePopup();
      const emailLower = (loggedInUser.email || '').trim().toLowerCase();
      const matched = members.find(
        (m) =>
          m.username.trim().toLowerCase() === emailLower ||
          (emailLower === AUTO_CLOUD_EMAIL.toLowerCase() && m.role === 'ผู้ดูแลระบบ')
      );

      if (matched) {
        if (!matched.active) {
          return { success: false, message: 'บัญชีนี้ถูกปิดการใช้งาน' };
        }
        setCurrentMemberId(matched.memberId);
        showToast(`เข้าสู่ระบบด้วย Google สำเร็จ: ${matched.fullName} (${matched.role})`, 'success');
        return { success: true, message: 'เข้าสู่ระบบสำเร็จ' };
      }

      const fallbackAdmin = members.find((m) => m.role === 'ผู้ดูแลระบบ' && m.active) || members[0];
      if (fallbackAdmin) {
        setCurrentMemberId(fallbackAdmin.memberId);
        showToast(
          `เข้าสู่ระบบสำเร็จภายใต้ ${loggedInUser.email || AUTO_CLOUD_EMAIL} (${fallbackAdmin.role})`,
          'success'
        );
        return { success: true, message: 'เข้าสู่ระบบสำเร็จ' };
      }

      return { success: false, message: 'ไม่พบบัญชีสมาชิกที่ผูกกับอีเมลนี้' };
    } catch {
      return { success: false, message: 'ยกเลิกหรือเกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google' };
    }
  }, [members, showToast]);

  const logoutMember = useCallback(() => {
    setCurrentMemberId(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  }, [showToast]);

  // ฟังก์ชันรีเฟรชข้อมูลโดยตรงจาก Firestore
  const syncPendingToFirebase = useCallback(async (): Promise<void> => {
    await loadDataDirectlyFromFirestore();
    showToast('ดึงข้อมูลล่าสุดจากฐานข้อมูล Firestore สำเร็จ', 'success');
  }, [loadDataDirectlyFromFirestore, showToast]);

  const pullFromFirebaseToLocal = useCallback(async (): Promise<void> => {
    await loadDataDirectlyFromFirestore();
  }, [loadDataDirectlyFromFirestore]);

  const clearAllLocalData = useCallback(() => {
    purgeLocalMachineData();
    showToast('ล้างข้อมูลแคชในเครื่องทั้งหมดเรียบร้อยแล้ว ข้อมูลจะดึงสดจาก Firestore', 'info');
  }, [showToast]);

  const signInGoogle = useCallback(async () => {
    try {
      const loggedInUser = await signInWithGooglePopup();
      showToast(`ยืนยันตัวตนบัญชี Google สำเร็จ: ${loggedInUser.email || AUTO_CLOUD_EMAIL}`, 'success');
      await loadDataDirectlyFromFirestore();
    } catch {
      showToast(
        `ระบบเชื่อมต่ออัตโนมัติภายใต้บัญชี ${AUTO_CLOUD_EMAIL}`,
        'success'
      );
    }
  }, [showToast, loadDataDirectlyFromFirestore]);

  const signOutUser = useCallback(async () => {
    await signOutFirebaseUser();
    showToast(`ออกจากบัญชี Google (ยังคงทำงานกับฐานข้อมูลหลัก ${AUTO_CLOUD_EMAIL})`, 'info');
  }, [showToast]);

  const setSyncMode = useCallback((_mode: SyncMode) => {
    // โหมดเชื่อมต่อตรงเสมอ ไม่ต้องสลับ
  }, []);

  const value = useMemo<ParcelSystemContextValue>(
    () => ({
      user,
      connectedEmail,
      authReady,
      currentMember,
      members,
      rolePermissions,
      allowedMenusForCurrentMember,
      canCurrentMemberEdit,
      canCurrentMemberDelete,
      loginWithCredentials,
      loginWithGoogleAccount,
      logoutMember,
      upsertMember,
      deleteMember,
      updateRolePermission,
      getEffectiveMemberMenus,
      students,
      studentMap,
      parcels,
      studentParcelStatsMap,
      allStudentParcelStats,
      overWeeklyLimitStudents,
      getStudentParcelCounts,
      weeklyWarningPopup,
      openWeeklyWarningPopup,
      closeWeeklyWarningPopup,
      pendingWrites,
      quotaMetrics,
      syncMode,
      isSyncing,
      syncProgress,
      toastMessage,
      clearToast,
      setSyncMode,
      lookupStudentByCode,
      searchStudentsLocal,
      searchParcelsLocal,
      recordLocalSearchSaving,
      addInboundParcel,
      updateParcelStatus,
      bulkUpdateParcelStatus,
      deleteParcel,
      bulkImportStudents,
      upsertSingleStudent,
      deleteStudent,
      bulkDeleteStudents,
      clearAllStudents,
      syncPendingToFirebase,
      pullFromFirebaseToLocal,
      clearAllLocalData,
      signInGoogle,
      signOutUser,
    }),
    [
      user,
      connectedEmail,
      authReady,
      currentMember,
      members,
      rolePermissions,
      allowedMenusForCurrentMember,
      canCurrentMemberEdit,
      canCurrentMemberDelete,
      loginWithCredentials,
      loginWithGoogleAccount,
      logoutMember,
      upsertMember,
      deleteMember,
      updateRolePermission,
      getEffectiveMemberMenus,
      students,
      studentMap,
      parcels,
      studentParcelStatsMap,
      allStudentParcelStats,
      overWeeklyLimitStudents,
      getStudentParcelCounts,
      weeklyWarningPopup,
      openWeeklyWarningPopup,
      closeWeeklyWarningPopup,
      pendingWrites,
      quotaMetrics,
      syncMode,
      isSyncing,
      syncProgress,
      toastMessage,
      clearToast,
      setSyncMode,
      lookupStudentByCode,
      searchStudentsLocal,
      searchParcelsLocal,
      recordLocalSearchSaving,
      addInboundParcel,
      updateParcelStatus,
      bulkUpdateParcelStatus,
      deleteParcel,
      bulkImportStudents,
      upsertSingleStudent,
      deleteStudent,
      bulkDeleteStudents,
      clearAllStudents,
      syncPendingToFirebase,
      pullFromFirebaseToLocal,
      clearAllLocalData,
      signInGoogle,
      signOutUser,
    ]
  );

  return <ParcelSystemContext.Provider value={value}>{children}</ParcelSystemContext.Provider>;
};

export function useParcelSystem(): ParcelSystemContextValue {
  const ctx = useContext(ParcelSystemContext);
  if (!ctx) {
    throw new Error('useParcelSystem must be used within a ParcelSystemProvider');
  }
  return ctx;
}
