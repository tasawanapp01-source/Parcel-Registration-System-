import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Student,
  Parcel,
  ParcelCategory,
  ParcelStatus,
  PendingWriteItem,
  QuotaMetrics,
  INITIAL_STUDENTS,
  INITIAL_PARCELS,
  getRelativeDateString,
  generateUniqueParentTrackingNumber,
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
  batchImportStudentsToFirestore,
  flushPendingQueueToFirestore,
  fetchCloudDataToLocalCache,
  subscribeToWorkspaceCloudData,
  sanitizeId,
  AUTO_CLOUD_EMAIL,
  AUTO_CLOUD_OWNER_ID,
} from '../services/firebase';

const LEGACY_KEYS = [
  'spms_students_cache_v1',
  'spms_parcels_cache_v1',
  'spms_pending_writes_v1',
  'spms_quota_metrics_v1',
  'spms_students_prod_v2',
  'spms_parcels_prod_v2',
  'spms_pending_writes_prod_v2',
  'spms_quota_metrics_prod_v2',
  'spms_sync_mode_clean_v3',
];

const STORAGE_KEYS = {
  STUDENTS: 'spms_students_clean_v3',
  PARCELS: 'spms_parcels_clean_v3',
  PENDING_WRITES: 'spms_pending_writes_clean_v3',
  QUOTA_METRICS: 'spms_quota_metrics_clean_v3',
  SYNC_MODE: 'spms_sync_mode_auto_v4',
};

export type SyncMode = 'local_buffer' | 'auto_cloud';

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

export interface WeeklyWarningPopupState {
  isOpen: boolean;
  focusedStudent: StudentParcelCountStats | null;
  triggerReason?: 'inbound_added' | 'student_lookup' | 'auto_detect' | 'manual';
}

interface ParcelSystemContextValue {
  user: User | null;
  connectedEmail: string;
  authReady: boolean;
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

// สร้างออบเจ็กต์ผู้ใช้ที่ผูกกับบัญชี Tasawan_app01@pcccr.ac.th อัตโนมัติ
const AUTO_BOUND_USER = {
  uid: AUTO_CLOUD_OWNER_ID,
  email: AUTO_CLOUD_EMAIL,
  displayName: AUTO_CLOUD_EMAIL,
  emailVerified: true,
  isAnonymous: false,
} as unknown as User;

function cleanupLegacyDemoStorage(): void {
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    cleanupLegacyDemoStorage();
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const ParcelSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(true);

  // เชื่อมต่อภายใต้บัญชี Tasawan_app01@pcccr.ac.th อัตโนมัติทันที
  const user = useMemo<User>(() => firebaseAuthUser || AUTO_BOUND_USER, [firebaseAuthUser]);
  const connectedEmail = AUTO_CLOUD_EMAIL;

  const [students, setStudents] = useState<Student[]>(() =>
    loadFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS).map((s) => ({
      ...s,
      ownerId: AUTO_CLOUD_OWNER_ID,
    }))
  );
  const [parcels, setParcels] = useState<Parcel[]>(() => {
    const loaded = loadFromStorage<Parcel[]>(STORAGE_KEYS.PARCELS, INITIAL_PARCELS);
    return loaded.map((p) => ({
      ...p,
      ownerId: AUTO_CLOUD_OWNER_ID,
      status:
        (p.status as string) === 'ระหว่างส่งไปหอ'
          ? 'ลงทะเบียนรับพัสดุ'
          : p.status,
    }));
  });
  const [pendingWrites, setPendingWrites] = useState<PendingWriteItem[]>(() =>
    loadFromStorage<PendingWriteItem[]>(STORAGE_KEYS.PENDING_WRITES, [])
  );
  // ตั้งค่าเริ่มต้นเป็น 'auto_cloud' เพื่อให้ซิงก์ข้อมูลกับ Firebase อัตโนมัติทันที
  const [syncMode, setSyncModeState] = useState<SyncMode>(() =>
    loadFromStorage<SyncMode>(STORAGE_KEYS.SYNC_MODE, 'auto_cloud')
  );
  const [quotaMetrics, setQuotaMetrics] = useState<QuotaMetrics>(() =>
    loadFromStorage<QuotaMetrics>(STORAGE_KEYS.QUOTA_METRICS, {
      localLookupsSaved: 0,
      batchedWritesQueued: 0,
      firestoreReadsUsed: 0,
      firestoreWritesUsed: 0,
      lastSyncedAt: null,
    })
  );

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

  const initialAutoSyncDoneRef = useRef<boolean>(false);
  const initialOverLimitAlertShownRef = useRef<boolean>(false);
  const studentsRef = useRef<Student[]>(students);
  const parcelsRef = useRef<Parcel[]>(parcels);
  const pendingWritesRef = useRef<PendingWriteItem[]>(pendingWrites);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    parcelsRef.current = parcels;
  }, [parcels]);

  useEffect(() => {
    pendingWritesRef.current = pendingWrites;
  }, [pendingWrites]);

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

  // ติดตามสถานะการล็อกอิน Firebase Authentication (ถ้ามี)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseAuthUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // บันทึกข้อมูลลง LocalStorage ทุกครั้งที่มีการเปลี่ยนแปลง (Local-First Persistence)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch (e) {
      console.error('Failed to persist students to localStorage:', e);
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PARCELS, JSON.stringify(parcels));
    } catch (e) {
      console.error('Failed to persist parcels to localStorage:', e);
    }
  }, [parcels]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_WRITES, JSON.stringify(pendingWrites));
    } catch (e) {
      console.error('Failed to persist pendingWrites to localStorage:', e);
    }
  }, [pendingWrites]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.QUOTA_METRICS, JSON.stringify(quotaMetrics));
    } catch (e) {
      console.error('Failed to persist quotaMetrics to localStorage:', e);
    }
  }, [quotaMetrics]);

  const setSyncMode = useCallback((mode: SyncMode) => {
    setSyncModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_MODE, JSON.stringify(mode));
    } catch {
      // ignore
    }
  }, []);

  /**
   * ฟังก์ชันเชื่อมต่อและซิงก์ข้อมูลสองทาง (Two-Way Auto Sync) ภายใต้บัญชี Tasawan_app01@pcccr.ac.th
   * 1. ส่งคิวที่ค้างอยู่ขึ้น Firestore
   * 2. ดึงข้อมูลล่าสุดจาก Firestore ลงมาเปรียบเทียบ
   * 3. หากมีข้อมูลในเครื่องที่ยังไม่อยู่บน Cloud ให้ส่งขึ้น Firestore อัตโนมัติทันที
   */
  const performFullCloudSync = useCallback(
    async (silent = false): Promise<void> => {
      setIsSyncing(true);
      try {
        let writesUsed = 0;
        const currentPending = pendingWritesRef.current;

        // 1. यदिมีรายการค้างในคิว pendingWrites ให้ส่งขึ้น Cloud ก่อน
        if (currentPending.length > 0) {
          setSyncProgress({ completed: 0, total: currentPending.length });
          const flushed = await flushPendingQueueToFirestore(
            currentPending,
            AUTO_CLOUD_OWNER_ID,
            (completed, total) => setSyncProgress({ completed, total })
          );
          writesUsed += flushed;
          setPendingWrites([]);
        }

        // 2. ดึงข้อมูลบน Cloud ของบัญชี Tasawan_app01@pcccr.ac.th
        const {
          students: cloudStudents,
          parcels: cloudParcels,
          readsCount,
        } = await fetchCloudDataToLocalCache(AUTO_CLOUD_OWNER_ID, firebaseAuthUser?.uid);

        const cloudStudentCodes = new Set(cloudStudents.map((s) => s.studentCode));
        const cloudParcelIds = new Set(cloudParcels.map((p) => p.id));

        // 3. ตรวจสอบข้อมูลในเครื่องที่ยังไม่ได้ขึ้น Cloud แล้วอัปโหลดให้อัตโนมัติทันที
        const localUnsyncedStudents = studentsRef.current.filter(
          (s) => !cloudStudentCodes.has(s.studentCode)
        );
        if (localUnsyncedStudents.length > 0) {
          setSyncProgress({ completed: 0, total: localUnsyncedStudents.length });
          const writtenStudents = await batchImportStudentsToFirestore(
            localUnsyncedStudents,
            AUTO_CLOUD_OWNER_ID,
            (completed, total) => setSyncProgress({ completed, total })
          );
          writesUsed += writtenStudents;
        }

        const localUnsyncedParcels = parcelsRef.current.filter(
          (p) => !cloudParcelIds.has(p.id)
        );
        if (localUnsyncedParcels.length > 0) {
          const parcelQueue: PendingWriteItem[] = localUnsyncedParcels.map((p) => ({
            id: `auto_parcel_${p.id}_${Date.now()}`,
            collection: 'parcels',
            docId: p.id,
            action: 'upsert',
            data: { ...p, ownerId: AUTO_CLOUD_OWNER_ID },
            queuedAt: new Date().toISOString(),
          }));
          setSyncProgress({ completed: 0, total: parcelQueue.length });
          const writtenParcels = await flushPendingQueueToFirestore(
            parcelQueue,
            AUTO_CLOUD_OWNER_ID,
            (completed, total) => setSyncProgress({ completed, total })
          );
          writesUsed += writtenParcels;
        }

        // 4. รวมข้อมูลจาก Cloud และในเครื่องให้ตรงกัน 100%
        const mergedStudentsMap = new Map<string, Student>();
        for (const s of studentsRef.current) {
          mergedStudentsMap.set(s.studentCode, { ...s, ownerId: AUTO_CLOUD_OWNER_ID });
        }
        for (const cs of cloudStudents) {
          mergedStudentsMap.set(cs.studentCode, { ...cs, ownerId: AUTO_CLOUD_OWNER_ID });
        }
        const finalStudents = Array.from(mergedStudentsMap.values()).sort(
          (a, b) => a.seqNo - b.seqNo
        );
        setStudents(finalStudents);

        const mergedParcelsMap = new Map<string, Parcel>();
        for (const p of parcelsRef.current) {
          mergedParcelsMap.set(p.id, { ...p, ownerId: AUTO_CLOUD_OWNER_ID });
        }
        for (const cp of cloudParcels) {
          mergedParcelsMap.set(cp.id, { ...cp, ownerId: AUTO_CLOUD_OWNER_ID });
        }
        const finalParcels = Array.from(mergedParcelsMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setParcels(finalParcels);

        const isoNow = new Date().toISOString();
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreReadsUsed: prev.firestoreReadsUsed + readsCount,
          firestoreWritesUsed: prev.firestoreWritesUsed + writesUsed,
          lastSyncedAt: isoNow,
        }));

        if (!silent) {
          showToast(
            `เชื่อมต่อและซิงก์ข้อมูลภายใต้ ${AUTO_CLOUD_EMAIL} สำเร็จ (นักเรียน ${finalStudents.length} คน · พัสดุ ${finalParcels.length} ชิ้น)`,
            'success'
          );
        }
      } catch (error) {
        if (!silent) {
          showToast(
            `เกิดข้อผิดพลาดในการซิงก์กับ Firebase: ${error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ'}`,
            'error'
          );
        }
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
      }
    },
    [firebaseAuthUser?.uid, showToast]
  );

  // เชื่อมต่อและซิงก์ข้อมูลกับ Firebase อัตโนมัติทันทีเมื่อเปิดโปรแกรม
  useEffect(() => {
    if (initialAutoSyncDoneRef.current) return;
    initialAutoSyncDoneRef.current = true;
    performFullCloudSync(false);
  }, [performFullCloudSync]);

  // ซิงก์แบบ Real-time อัตโนมัติเมื่อมีการเปลี่ยนแปลงบน Cloud ภายใต้บัญชี Tasawan_app01@pcccr.ac.th
  useEffect(() => {
    if (syncMode !== 'auto_cloud') return;

    const unsubscribe = subscribeToWorkspaceCloudData(
      AUTO_CLOUD_OWNER_ID,
      (cloudStudents) => {
        if (cloudStudents.length > 0) {
          setStudents((prev) => {
            const map = new Map<string, Student>();
            for (const s of prev) map.set(s.studentCode, s);
            for (const cs of cloudStudents) map.set(cs.studentCode, cs);
            return Array.from(map.values()).sort((a, b) => a.seqNo - b.seqNo);
          });
        }
      },
      (cloudParcels) => {
        if (cloudParcels.length > 0) {
          setParcels((prev) => {
            const map = new Map<string, Parcel>();
            for (const p of prev) map.set(p.id, p);
            for (const cp of cloudParcels) map.set(cp.id, cp);
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      }
    );

    return () => unsubscribe();
  }, [syncMode]);

  // หากมีรายการค้างในคิวและอยู่ในโหมดซิงก์อัตโนมัติ ให้ส่งขึ้น Firebase ทันที
  useEffect(() => {
    if (syncMode !== 'auto_cloud' || pendingWrites.length === 0 || isSyncing) return;

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        const count = await flushPendingQueueToFirestore(pendingWrites, AUTO_CLOUD_OWNER_ID);
        setPendingWrites([]);
        setQuotaMetrics((prev) => ({
          ...prev,
          firestoreWritesUsed: prev.firestoreWritesUsed + count,
          lastSyncedAt: new Date().toISOString(),
        }));
      } catch {
        // คงรายการไว้ในคิวหากออฟไลน์ชั่วคราว
      } finally {
        setIsSyncing(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [syncMode, pendingWrites, isSyncing]);

  /**
   * สร้าง In-Memory Hash Map สำหรับค้นหานักเรียนด้วยรหัสนักเรียนแบบ O(1)
   */
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(s.studentCode.trim().toLowerCase(), s);
    }
    return map;
  }, [students]);

  /**
   * คำนวณจำนวนพัสดุของนักเรียนแต่ละคน (วัน, สัปดาห์, เดือน) และตรวจจับนักเรียนที่มีพัสดุเกิน 3 ชิ้น/สัปดาห์
   */
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
      const matched = cleanCode ? studentMap.get(cleanCode) : undefined;
      return getStudentParcelCountStats(
        parcels,
        studentCode,
        studentFullName,
        studentMeta || matched
      );
    },
    [studentParcelStatsMap, studentMap, parcels]
  );

  const openWeeklyWarningPopup = useCallback(
    (
      focusedStudent: StudentParcelCountStats | null = null,
      reason: WeeklyWarningPopupState['triggerReason'] = 'manual'
    ) => {
      setWeeklyWarningPopup({
        isOpen: true,
        focusedStudent,
        triggerReason: reason,
      });
    },
    []
  );

  const closeWeeklyWarningPopup = useCallback(() => {
    setWeeklyWarningPopup((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // เมื่อกล่องแจ้งเตือนเปิดขึ้น ให้แสดงเตือนแล้วปิดอัตโนมัติ
  useEffect(() => {
    if (!weeklyWarningPopup.isOpen) return;
    const timer = setTimeout(() => {
      closeWeeklyWarningPopup();
    }, 3000);
    return () => clearTimeout(timer);
  }, [weeklyWarningPopup.isOpen, closeWeeklyWarningPopup]);

  const recordLocalSearchSaving = useCallback(() => {
    setQuotaMetrics((prev) => ({
      ...prev,
      localLookupsSaved: prev.localLookupsSaved + 1,
    }));
  }, []);

  const lookupStudentByCode = useCallback(
    (code: string): Student | undefined => {
      if (!code.trim()) return undefined;
      return studentMap.get(code.trim().toLowerCase());
    },
    [studentMap]
  );

  const searchStudentsLocal = useCallback(
    (keyword: string): Student[] => {
      const q = keyword.trim().toLowerCase();
      if (!q) return students;
      return students.filter(
        (s) =>
          s.studentCode.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.nickname.toLowerCase().includes(q) ||
          s.dormitory.toLowerCase().includes(q) ||
          s.dormRoom.toLowerCase().includes(q)
      );
    },
    [students]
  );

  const searchParcelsLocal = useCallback(
    (keyword: string, statusFilter = 'ALL', dormFilter = 'ALL', dateFilter = ''): Parcel[] => {
      const q = keyword.trim().toLowerCase();
      return parcels.filter((p) => {
        if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'ALL_REGISTERED') {
          if (statusFilter === 'SIGNED') {
            if (p.status !== 'ส่งมอบสำเร็จ') return false;
          } else if (statusFilter === 'UNSIGNED' || statusFilter === 'PENDING_GROUP') {
            if (p.status === 'ส่งมอบสำเร็จ') return false;
          } else if (statusFilter === 'LEGAL_HOLD') {
            if (p.status !== 'ติดนิติการ') return false;
          } else if (statusFilter === 'UNKNOWN_OWNER' || statusFilter === 'พัสดุไม่ทราบเจ้าของ') {
            if (!isUnknownOwnerParcel(p)) return false;
          } else if (p.status !== statusFilter) {
            return false;
          }
        }
        if (dormFilter && dormFilter !== 'ALL' && !p.dormitory.includes(dormFilter)) {
          return false;
        }
        if (dateFilter && p.receivedDate !== dateFilter) {
          return false;
        }
        if (!q) return true;
        return (
          p.trackingNumber.toLowerCase().includes(q) ||
          p.studentCode.toLowerCase().includes(q) ||
          p.studentFullName.toLowerCase().includes(q) ||
          p.nickname.toLowerCase().includes(q) ||
          p.dormitory.toLowerCase().includes(q) ||
          p.dormRoom.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      });
    },
    [parcels]
  );

  /**
   * บันทึกรับเข้าพัสดุใหม่ (Inbound) และซิงก์ขึ้น Firebase ภายใต้บัญชี Tasawan_app01@pcccr.ac.th ทันที
   */
  const addInboundParcel = useCallback(
    async (input: NewParcelInput): Promise<Parcel> => {
      let rawTracking = input.trackingNumber.trim();
      const isDuplicateTracking = parcels.some(
        (p) =>
          p.id.toUpperCase() === rawTracking.toUpperCase() ||
          p.trackingNumber.toUpperCase() === rawTracking.toUpperCase()
      );

      if (input.courier === 'ผู้ปกครองฝากส่ง' && (!rawTracking || isDuplicateTracking)) {
        rawTracking = generateUniqueParentTrackingNumber(parcels);
      }

      const safeTracking = sanitizeId(rawTracking, 64);
      const safeStudentCode = sanitizeId(input.studentCode, 20);
      const matchedStudent = studentMap.get(safeStudentCode.toLowerCase());

      const now = new Date();
      const isoNow = now.toISOString();
      const todayStr = getRelativeDateString(0);
      const currentHour = now.getHours();

      const newParcel: Parcel = {
        id: safeTracking,
        trackingNumber: safeTracking,
        studentCode: safeStudentCode,
        studentFullName:
          input.customStudent?.studentFullName?.trim() ||
          (matchedStudent
            ? `${matchedStudent.prefix}${matchedStudent.firstName} ${matchedStudent.lastName}`
            : 'ไม่พบชื่อในทะเบียน'),
        nickname:
          input.customStudent?.nickname?.trim() ||
          (matchedStudent ? matchedStudent.nickname : '-'),
        gradeRoom:
          input.customStudent?.gradeRoom?.trim() ||
          (matchedStudent ? `${matchedStudent.grade}/${matchedStudent.room}` : '-'),
        dormitory:
          input.customStudent?.dormitory?.trim() ||
          (matchedStudent ? matchedStudent.dormitory : '-'),
        dormRoom:
          input.customStudent?.dormRoom?.trim() ||
          (matchedStudent ? matchedStudent.dormRoom : '-'),
        bed:
          input.customStudent?.bed?.trim() ||
          (matchedStudent ? matchedStudent.bed : '-'),
        category: input.category,
        status: input.status,
        courier: input.courier || 'Flash Express',
        note: input.note.trim().slice(0, 300),
        receivedDate: todayStr,
        receivedHour: currentHour,
        ownerId: AUTO_CLOUD_OWNER_ID,
        createdAt: isoNow,
        updatedAt: isoNow,
      };

      const updatedParcelsList = [
        newParcel,
        ...parcels.filter((item) => item.id !== newParcel.id),
      ];
      setParcels(updatedParcelsList);

      // ตรวจสอบจำนวนพัสดุของนักเรียนคนนี้ทันทีหลังบันทึก หากเกิน 3 ชิ้นต่อสัปดาห์ ให้แสดง Popup แจ้งเตือนทันที
      if (!isUnknownOwnerParcel(newParcel)) {
        const updatedStudentStats = getStudentParcelCountStats(
          updatedParcelsList,
          newParcel.studentCode,
          newParcel.studentFullName,
          matchedStudent
        );
        if (updatedStudentStats.weekCount > WEEKLY_PARCEL_WARNING_LIMIT) {
          initialOverLimitAlertShownRef.current = true;
          setWeeklyWarningPopup({
            isOpen: true,
            focusedStudent: updatedStudentStats,
            triggerReason: 'inbound_added',
          });
        }
      }

      const queueItem: PendingWriteItem = {
        id: `parcel_${newParcel.id}_${Date.now()}`,
        collection: 'parcels',
        docId: newParcel.id,
        action: 'upsert',
        data: newParcel,
        queuedAt: isoNow,
      };

      if (syncMode === 'auto_cloud') {
        try {
          await flushPendingQueueToFirestore([queueItem], AUTO_CLOUD_OWNER_ID);
          setQuotaMetrics((prev) => ({
            ...prev,
            localLookupsSaved: prev.localLookupsSaved + 1,
            firestoreWritesUsed: prev.firestoreWritesUsed + 1,
            lastSyncedAt: isoNow,
          }));
          showToast(
            `บันทึกพัสดุ ${newParcel.trackingNumber} และซิงก์ขึ้น Firebase (${AUTO_CLOUD_EMAIL}) สำเร็จ`,
            'success'
          );
        } catch {
          setPendingWrites((prev) => [...prev, queueItem]);
          showToast(`บันทึกในเครื่องแล้ว (รอซิงก์ขึ้น Cloud ภายหลัง)`, 'warning');
        }
      } else {
        setPendingWrites((prev) => [...prev, queueItem]);
        setQuotaMetrics((prev) => ({
          ...prev,
          localLookupsSaved: prev.localLookupsSaved + 1,
          batchedWritesQueued: prev.batchedWritesQueued + 1,
        }));
        showToast(`บันทึกพัสดุ ${newParcel.trackingNumber} ลงตัวโปรแกรมแล้ว`, 'success');
      }

      return newParcel;
    },
    [parcels, studentMap, syncMode, showToast]
  );

  /**
   * อัปเดตสถานะพัสดุรายชิ้น และซิงก์ขึ้น Firebase ทันที
   */
  const updateParcelStatus = useCallback(
    async (
      parcelId: string,
      newStatus: ParcelStatus,
      note?: string,
      deliveredDate?: string
    ): Promise<void> => {
      const isoNow = new Date().toISOString();
      let updatedParcelObj: Parcel | null = null;
      const effectiveDeliveredDate =
        newStatus === 'ส่งมอบสำเร็จ'
          ? (deliveredDate || getRelativeDateString(0)).slice(0, 20)
          : '';

      setParcels((prev) =>
        prev.map((p) => {
          if (p.id !== parcelId) return p;
          updatedParcelObj = {
            ...p,
            status: newStatus,
            note: note !== undefined ? note.slice(0, 300) : p.note,
            deliveredDate: effectiveDeliveredDate,
            ownerId: AUTO_CLOUD_OWNER_ID,
            updatedAt: isoNow,
          };
          return updatedParcelObj;
        })
      );

      if (!updatedParcelObj) return;

      const queueItem: PendingWriteItem = {
        id: `parcel_upd_${parcelId}_${Date.now()}`,
        collection: 'parcels',
        docId: parcelId,
        action: 'upsert',
        data: updatedParcelObj,
        queuedAt: isoNow,
      };

      if (syncMode === 'auto_cloud') {
        try {
          await flushPendingQueueToFirestore([queueItem], AUTO_CLOUD_OWNER_ID);
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + 1,
            lastSyncedAt: isoNow,
          }));
          showToast(`อัปเดตสถานะ ${parcelId} เป็น "${newStatus}" และซิงก์ขึ้น Firebase แล้ว`, 'success');
        } catch {
          setPendingWrites((prev) => [...prev, queueItem]);
          showToast(`อัปเดตสถานะเป็น "${newStatus}" ในเครื่องแล้ว (รอซิงก์)`, 'info');
        }
      } else {
        setPendingWrites((prev) => [...prev, queueItem]);
        setQuotaMetrics((prev) => ({
          ...prev,
          batchedWritesQueued: prev.batchedWritesQueued + 1,
        }));
        showToast(`อัปเดตสถานะพัสดุ ${parcelId} เป็น "${newStatus}" ในเครื่องแล้ว`, 'success');
      }
    },
    [syncMode, showToast]
  );

  /**
   * อัปเดตสถานะพัสดุหลายรายการพร้อมกัน
   */
  const bulkUpdateParcelStatus = useCallback(
    async (
      parcelIds: string[],
      newStatus: ParcelStatus,
      deliveredDate?: string
    ): Promise<void> => {
      if (parcelIds.length === 0) return;
      const idSet = new Set(parcelIds);
      const isoNow = new Date().toISOString();
      const updatedItems: PendingWriteItem[] = [];
      const effectiveDeliveredDate =
        newStatus === 'ส่งมอบสำเร็จ'
          ? (deliveredDate || getRelativeDateString(0)).slice(0, 20)
          : '';

      setParcels((prev) =>
        prev.map((p) => {
          if (!idSet.has(p.id)) return p;
          const updated: Parcel = {
            ...p,
            status: newStatus,
            deliveredDate: effectiveDeliveredDate,
            ownerId: AUTO_CLOUD_OWNER_ID,
            updatedAt: isoNow,
          };
          updatedItems.push({
            id: `parcel_bulk_${p.id}_${Date.now()}`,
            collection: 'parcels',
            docId: p.id,
            action: 'upsert',
            data: updated,
            queuedAt: isoNow,
          });
          return updated;
        })
      );

      if (syncMode === 'auto_cloud' && updatedItems.length > 0) {
        try {
          await flushPendingQueueToFirestore(updatedItems, AUTO_CLOUD_OWNER_ID);
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + updatedItems.length,
            lastSyncedAt: isoNow,
          }));
          showToast(
            `อัปเดตพัสดุ ${updatedItems.length} รายการเป็น "${newStatus}" และซิงก์ขึ้น Firebase สำเร็จ`,
            'success'
          );
          return;
        } catch {
          // fallback to queue
        }
      }

      setPendingWrites((prev) => [...prev, ...updatedItems]);
      setQuotaMetrics((prev) => ({
        ...prev,
        batchedWritesQueued: prev.batchedWritesQueued + updatedItems.length,
      }));
      showToast(`อัปเดตสถานะพัสดุ ${parcelIds.length} รายการเป็น "${newStatus}" แล้ว`, 'success');
    },
    [syncMode, showToast]
  );

  const deleteParcel = useCallback(
    async (parcelId: string): Promise<void> => {
      const isoNow = new Date().toISOString();
      setParcels((prev) => prev.filter((p) => p.id !== parcelId));

      const queueItem: PendingWriteItem = {
        id: `parcel_del_${parcelId}_${Date.now()}`,
        collection: 'parcels',
        docId: parcelId,
        action: 'delete',
        queuedAt: isoNow,
      };

      if (syncMode === 'auto_cloud') {
        try {
          await flushPendingQueueToFirestore([queueItem], AUTO_CLOUD_OWNER_ID);
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + 1,
            lastSyncedAt: isoNow,
          }));
          showToast(`ลบรายการพัสดุ ${parcelId} และซิงก์กับ Firebase แล้ว`, 'info');
          return;
        } catch {
          // fallback to queue
        }
      }

      setPendingWrites((prev) => [...prev, queueItem]);
      showToast(`ลบรายการพัสดุ ${parcelId} แล้ว`, 'info');
    },
    [syncMode, showToast]
  );

  /**
   * นำเข้าข้อมูลนักเรียนจำนวนมาก (Bulk Import) และซิงก์ขึ้น Firebase ภายใต้ Tasawan_app01@pcccr.ac.th
   */
  const bulkImportStudents = useCallback(
    async (
      rawStudents: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>[],
      commitImmediately = true
    ): Promise<number> => {
      if (rawStudents.length === 0) return 0;
      const isoNow = new Date().toISOString();

      const normalizedStudents: Student[] = rawStudents.map((s, idx) => ({
        seqNo: Number(s.seqNo) || idx + 1,
        studentCode: sanitizeId(String(s.studentCode || `${idx + 1}`), 20),
        prefix: String(s.prefix || '-').trim(),
        firstName: String(s.firstName || '-').trim(),
        lastName: String(s.lastName || '-').trim(),
        nickname: String(s.nickname || '-').trim(),
        grade: String(s.grade || '-').trim(),
        room: String(s.room || '-').trim(),
        dormitory: String(s.dormitory || '-').trim(),
        dormRoom: String(s.dormRoom || '-').trim(),
        bed: String(s.bed || '-').trim(),
        ownerId: AUTO_CLOUD_OWNER_ID,
        createdAt: isoNow,
        updatedAt: isoNow,
      }));

      setStudents((prev) => {
        const mergedMap = new Map<string, Student>();
        for (const existing of prev) {
          mergedMap.set(existing.studentCode, existing);
        }
        for (const incoming of normalizedStudents) {
          mergedMap.set(incoming.studentCode, incoming);
        }
        return Array.from(mergedMap.values()).sort((a, b) => a.seqNo - b.seqNo);
      });

      if (commitImmediately || syncMode === 'auto_cloud') {
        setIsSyncing(true);
        setSyncProgress({ completed: 0, total: normalizedStudents.length });
        try {
          const written = await batchImportStudentsToFirestore(
            normalizedStudents,
            AUTO_CLOUD_OWNER_ID,
            (completed, total) => setSyncProgress({ completed, total })
          );
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + written,
            lastSyncedAt: isoNow,
          }));
          showToast(
            `นำเข้าและซิงก์ข้อมูลนักเรียน ${written} คนขึ้น Firebase (${AUTO_CLOUD_EMAIL}) สำเร็จ!`,
            'success'
          );
        } catch {
          const fallbackItems: PendingWriteItem[] = normalizedStudents.map((st) => ({
            id: `student_${st.studentCode}_${Date.now()}`,
            collection: 'students',
            docId: st.studentCode,
            action: 'upsert',
            data: st,
            queuedAt: isoNow,
          }));
          setPendingWrites((prev) => [...prev, ...fallbackItems]);
          showToast(
            `นำเข้านักเรียน ${normalizedStudents.length} คนลงเครื่องแล้ว (รอซิงก์ขึ้น Cloud)`,
            'warning'
          );
        } finally {
          setIsSyncing(false);
          setSyncProgress(null);
        }
      } else {
        const newQueueItems: PendingWriteItem[] = normalizedStudents.map((st) => ({
          id: `student_${st.studentCode}_${Date.now()}`,
          collection: 'students',
          docId: st.studentCode,
          action: 'upsert',
          data: st,
          queuedAt: isoNow,
        }));
        setPendingWrites((prev) => [...prev, ...newQueueItems]);
        setQuotaMetrics((prev) => ({
          ...prev,
          batchedWritesQueued: prev.batchedWritesQueued + normalizedStudents.length,
        }));
        showToast(
          `นำเข้านักเรียน ${normalizedStudents.length} คนลงหน่วยความจำโปรแกรมแล้ว`,
          'success'
        );
      }

      return normalizedStudents.length;
    },
    [syncMode, showToast]
  );

  const upsertSingleStudent = useCallback(
    async (student: Omit<Student, 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<void> => {
      await bulkImportStudents([student], syncMode === 'auto_cloud');
    },
    [bulkImportStudents, syncMode]
  );

  const deleteStudent = useCallback(
    async (studentCode: string): Promise<void> => {
      const isoNow = new Date().toISOString();
      setStudents((prev) => prev.filter((s) => s.studentCode !== studentCode));
      const queueItem: PendingWriteItem = {
        id: `student_del_${studentCode}_${Date.now()}`,
        collection: 'students',
        docId: studentCode,
        action: 'delete',
        queuedAt: isoNow,
      };

      if (syncMode === 'auto_cloud') {
        try {
          await flushPendingQueueToFirestore([queueItem], AUTO_CLOUD_OWNER_ID);
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + 1,
            lastSyncedAt: isoNow,
          }));
          showToast(`ลบข้อมูลนักเรียนรหัส ${studentCode} และซิงก์กับ Firebase แล้ว`, 'info');
          return;
        } catch {
          // fallback to queue
        }
      }

      setPendingWrites((prev) => [...prev, queueItem]);
      showToast(`ลบข้อมูลนักเรียนรหัส ${studentCode} แล้ว`, 'info');
    },
    [syncMode, showToast]
  );

  const bulkDeleteStudents = useCallback(
    async (studentCodes: string[], targetLabel?: string): Promise<void> => {
      if (studentCodes.length === 0) return;
      const codeSet = new Set(studentCodes);
      const isoNow = new Date().toISOString();

      setStudents((prev) => prev.filter((s) => !codeSet.has(s.studentCode)));

      const deleteItems: PendingWriteItem[] = Array.from(codeSet).map((code) => ({
        id: `student_del_${code}_${Date.now()}`,
        collection: 'students',
        docId: code,
        action: 'delete',
        queuedAt: isoNow,
      }));

      if (syncMode === 'auto_cloud') {
        setIsSyncing(true);
        setSyncProgress({ completed: 0, total: deleteItems.length });
        try {
          const deletedCount = await flushPendingQueueToFirestore(
            deleteItems,
            AUTO_CLOUD_OWNER_ID,
            (completed, total) => setSyncProgress({ completed, total })
          );
          setQuotaMetrics((prev) => ({
            ...prev,
            firestoreWritesUsed: prev.firestoreWritesUsed + deletedCount,
            lastSyncedAt: isoNow,
          }));
          showToast(
            `ล้างข้อมูลนักเรียน${targetLabel ? ` (${targetLabel})` : ''} จำนวน ${deletedCount} คน และซิงก์กับ Firebase เรียบร้อยแล้ว`,
            'info'
          );
          return;
        } catch {
          // fallback to queue
        } finally {
          setIsSyncing(false);
          setSyncProgress(null);
        }
      }

      setPendingWrites((prev) => [...prev, ...deleteItems]);
      showToast(
        `ล้างข้อมูลนักเรียน${targetLabel ? ` (${targetLabel})` : ''} จำนวน ${codeSet.size} คนแล้ว`,
        'info'
      );
    },
    [syncMode, showToast]
  );

  const clearAllStudents = useCallback(async () => {
    const allCodes = studentsRef.current.map((s) => s.studentCode);
    if (allCodes.length === 0) {
      setStudents([]);
      showToast('ไม่มีข้อมูลนักเรียนในระบบ', 'info');
      return;
    }
    await bulkDeleteStudents(allCodes, 'ทั้งหมดในระบบ');
  }, [bulkDeleteStudents, showToast]);

  /**
   * สั่งซิงก์ข้อมูลทั้งหมด (ทั้งคิวค้างซิงก์ ข้อมูลในเครื่อง และข้อมูลบน Cloud) ภายใต้บัญชี Tasawan_app01@pcccr.ac.th
   */
  const syncPendingToFirebase = useCallback(async (): Promise<void> => {
    await performFullCloudSync(false);
  }, [performFullCloudSync]);

  /**
   * ดึงข้อมูลจาก Firebase Firestore ลงมาอัปเดต Local Cache
   */
  const pullFromFirebaseToLocal = useCallback(async (): Promise<void> => {
    await performFullCloudSync(false);
  }, [performFullCloudSync]);

  const clearAllLocalData = useCallback(() => {
    setStudents([]);
    setParcels([]);
    setPendingWrites([]);
    showToast('ล้างข้อมูลนักเรียนและพัสดุในเครื่องทั้งหมดเรียบร้อยแล้ว', 'info');
  }, [showToast]);

  const signInGoogle = useCallback(async () => {
    try {
      const loggedInUser = await signInWithGooglePopup();
      showToast(`ยืนยันตัวตนบัญชี Google สำเร็จ: ${loggedInUser.email || AUTO_CLOUD_EMAIL}`, 'success');
      await performFullCloudSync(true);
    } catch {
      showToast(
        `ระบบเชื่อมต่ออัตโนมัติภายใต้บัญชี ${AUTO_CLOUD_EMAIL} และซิงก์ข้อมูลให้เรียบร้อยแล้ว`,
        'success'
      );
      await performFullCloudSync(true);
    }
  }, [showToast, performFullCloudSync]);

  const signOutUser = useCallback(async () => {
    await signOutFirebaseUser();
    showToast(`ระบบยังคงเชื่อมต่ออัตโนมัติภายใต้บัญชี ${AUTO_CLOUD_EMAIL}`, 'info');
  }, [showToast]);

  const value = useMemo<ParcelSystemContextValue>(
    () => ({
      user,
      connectedEmail,
      authReady,
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
