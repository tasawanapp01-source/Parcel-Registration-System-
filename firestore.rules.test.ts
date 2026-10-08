/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies all 12 adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: 'students' | 'parcels';
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'parcels',
    operation: 'create',
    auth: null,
    docId: 'TH123456789',
    payload: { trackingNumber: 'TH123456789' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'parcels',
    operation: 'get',
    auth: { uid: 'attacker_1', email: 'tasawan_app01@pcccr.ac.th', email_verified: false },
    docId: 'TH123456789',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collection: 'students',
    operation: 'create',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: '66101',
    payload: { ownerId: 'someone_else_uid', studentCode: '66101' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collection: 'parcels',
    operation: 'create',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH123456789',
    payload: { trackingNumber: 'TH123456789', isAdminOverride: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Update',
    collection: 'parcels',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH123456789',
    payload: { status: 'ระหว่างส่งไปหอ', bypassInspection: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immortal Field Mutation (ownerId)',
    collection: 'students',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: '66101',
    payload: { ownerId: 'hijacked_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Reversal on Delivered Parcel',
    collection: 'parcels',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH_DELIVERED_01',
    payload: { status: 'รับเข้าส่วนกลาง' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Status Enum Injection',
    collection: 'parcels',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH123456789',
    payload: { status: 'INVALID_STATUS_ENUM' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Denial-of-Wallet Oversized Note String',
    collection: 'parcels',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH123456789',
    payload: { note: 'X'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning with Illegal Characters',
    collection: 'students',
    operation: 'create',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'invalid$id#123',
    payload: { studentCode: '66101' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery',
    collection: 'parcels',
    operation: 'update',
    auth: { uid: 'staff_1', email: 'staff@school.ac.th', email_verified: true },
    docId: 'TH123456789',
    payload: { status: 'ระหว่างส่งไปหอ', updatedAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Cross-Tenant List Query',
    collection: 'parcels',
    operation: 'list',
    auth: { uid: 'other_user', email: 'other@school.ac.th', email_verified: true },
    docId: '*',
    expectedResult: 'PERMISSION_DENIED',
  },
];
