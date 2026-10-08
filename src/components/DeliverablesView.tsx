import React, { useState } from 'react';
import {
  Database,
  FolderTree,
  Code2,
  GitBranch,
  BookOpen,
  Copy,
  Check,
} from 'lucide-react';

const DEPLOY_YML_CODE = `name: Deploy Student Parcel System to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

# กำหนดสิทธิ์สำหรับใช้ GitHub Pages Action
permissions:
  contents: read
  pages: write
  id-token: write

# ป้องกันการรัน Deploy ซ้อนกันหลายชุดในเวลาเดียว
concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 1. Checkout Source Code
        uses: actions/checkout@v4

      - name: 2. Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: 3. Install Dependencies
        run: npm ci

      - name: 4. Build Production Bundle (Vite + React + Tailwind)
        run: npm run build

      - name: 5. Configure GitHub Pages
        uses: actions/configure-pages@v5

      - name: 6. Upload Build Artifact (dist/)
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: 7. Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

const PROJECT_TREE_CODE = `student-parcel-system/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions CI/CD สำหรับ Deploy ขึ้น GitHub Pages อัตโนมัติ
├── src/
│   ├── components/
│   │   ├── InboundView.tsx           # หน้าสแกนรับพัสดุ & ป้ายสีประจำหอพัก (Mobile-First)
│   │   ├── TrackingView.tsx          # หน้าค้นหาและติดตามสถานะพัสดุ (Zero-Read Local Index)
│   │   ├── ManifestView.tsx          # หน้าสร้างและพิมพ์ใบรายการนำส่งพัสดุ (Printable A4)
│   │   ├── StudentsImportView.tsx    # หน้านำเข้าข้อมูลนักเรียน CSV/Excel ด้วย Batched Writes
│   │   ├── DashboardView.tsx         # หน้าสถิติ กราฟเส้น และวิเคราะห์ Peak Hours (Chart.js)
│   │   └── DeliverablesView.tsx      # เอกสารสถาปัตยกรรมระบบ โครงสร้างฐานข้อมูล และคู่มือติดตั้ง
│   ├── context/
│   │   └── ParcelSystemContext.tsx   # ระบบจัดการ Local Cache + Pending Write Queue ลดโควตา Firebase
│   ├── services/
│   │   └── firebase.ts               # ตั้งค่า Firebase SDK, Batched Writes (450 docs/batch) & Error Handler
│   ├── types/
│   │   └── parcel.ts                 # โครงสร้างข้อมูล TypeScript, สีประจำหอพัก และข้อมูลเริ่มต้น
│   ├── App.tsx                       # โครงสร้าง Navigation (Top Bar + Mobile Bottom Tab Bar)
│   ├── index.css                     # Tailwind CSS + ตั้งค่าหน้ากระดาษ @media print
│   └── main.tsx                      # Entry Point ของแอปพลิเคชัน
├── firebase-applet-config.json       # ไฟล์ตั้งค่าการเชื่อมต่อ Firebase Project
├── firebase-blueprint.json           # โครงสร้าง Schema มาตรฐานของฐานข้อมูล
├── firestore.rules                   # กฎความปลอดภัย Firestore Security Rules
├── SETUP_GUIDE.md                    # คู่มือการติดตั้งและใช้งานฉบับเต็ม
├── package.json
└── vite.config.ts                    # ตั้งค่า base: './' สำหรับรองรับ GitHub Pages`;

const BATCH_WRITE_SNIPPET = `/**
 * ตัวอย่างโค้ด Firestore Batched Writes + Local Cache เพื่อลด Limit การใช้งาน Firebase
 * แบ่งข้อมูลออกเป็นก้อนละ 450 รายการ (จำกัดสูงสุดของ Firestore คือ 500 รายการต่อ 1 Batch)
 */
export async function batchImportStudentsToFirestore(students: Student[], uid: string) {
  const CHUNK_SIZE = 450;

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const st of chunk) {
      // ใช้รหัสนักเรียน (studentCode) เป็น Document ID เพื่อป้องกันข้อมูลซ้ำและค้นหาแบบ O(1)
      const docRef = doc(db, 'students', st.studentCode);
      batch.set(docRef, {
        ...st,
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // ส่งคำสั่งเขียนพร้อมกันในครั้งเดียว (Atomic Batch Commit)
    await batch.commit();
  }
}`;

export const DeliverablesView: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-slate-500">
          เอกสารสรุปสถาปัตยกรรมระบบ · โครงสร้างฐานข้อมูล · GitHub Actions CI/CD · คู่มือการติดตั้งจริง
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
          โครงสร้างระบบ การลดโควตา Firebase และคู่มือ CI/CD (System Blueprint)
        </h1>
      </div>

      {/* Deliverable 1: Firebase Data Model & Quota Optimization */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Database className="w-5 h-5 text-slate-900" />
          <h2 className="text-lg font-bold text-slate-900">
            01. การออกแบบฐานข้อมูล Firebase (Firestore Data Model) และวิธีลดโควตาการใช้งาน
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Collection 1: <span className="font-mono">students</span> (ทะเบียนนักเรียน)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ใช้ <strong className="font-mono">studentCode</strong> เป็น Document ID โดยตรง ทำให้เมื่ออัปโหลดไฟล์ CSV ซ้ำ ระบบจะทับข้อมูลเดิมโดยไม่เกิดแถวซ้ำซ้อน
            </p>
            <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`// Path: /students/{studentCode}
{
  "seqNo": number,                // เลขที่
  "studentCode": string,          // รหัสนักเรียน
  "prefix": string,               // คำนำหน้า
  "firstName": string,            // ชื่อ
  "lastName": string,             // นามสกุล
  "nickname": string,             // ชื่อเล่น
  "grade": string,                // ระดับชั้น
  "room": string,                 // ห้อง
  "dormitory": string,            // หอพัก
  "dormRoom": string,             // ห้องพักหอ
  "bed": string,                  // เตียง
  "ownerId": string,
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}`}
            </pre>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Collection 2: <span className="font-mono">parcels</span> (รายการพัสดุ)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ใช้เทคนิค <strong>Denormalization (Extended Reference)</strong> โดยฝังชื่อนักเรียน หอพัก ห้อง และเตียง ลงในเอกสารพัสดุทันทีตอนรับเข้า ทำให้ตอนแสดงตารางหรือพิมพ์ใบนำส่ง <strong>ไม่ต้องคิวรีตาราง students ซ้ำ</strong>
            </p>
            <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`// Path: /parcels/{trackingNumber}
{
  "trackingNumber": string,
  "studentCode": string,
  "studentFullName": string,
  "nickname": string,
  "gradeRoom": string,
  "dormitory": string,
  "dormRoom": string,
  "bed": string,
  "category": string,
  "status": string,
  "courier": string,
  "note": string,
  "receivedDate": string,
  "receivedHour": number,         // ใช้วิเคราะห์ Peak Hours
  "ownerId": string,
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}`}
            </pre>
          </div>
        </div>

        {/* สรุป 3 กลยุทธ์ลด Limit การใช้งาน Firebase */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2.5">
          <h3 className="text-sm font-bold text-emerald-950">
            กลยุทธ์หลักในการลด Limit การใช้งาน Firebase (Local-First Architecture):
          </h3>
          <ul className="text-xs text-emerald-900 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>1. พักข้อมูลลงบนตัวโปรแกรมก่อน (Local Buffer & Write Coalescing):</strong> ทุกครั้งที่สแกนรับพัสดุหรือเปลี่ยนสถานะ ระบบจะบันทึกลง <code className="font-mono">localStorage</code> ทันทีและเก็บเข้าคิว <code className="font-mono">pendingWrites</code> หากพัสดุชิ้นเดิมถูกเปลี่ยนสถานะหลายครั้งก่อนซิงก์ ระบบจะยุบรวมเหลือการเขียนขึ้น Firebase เพียง 1 ครั้งเมื่อกดปุ่ม <em>ซิงก์ขึ้น Firebase (Batch Sync)</em>
            </li>
            <li>
              <strong>2. ดัชนีค้นหาในหน่วยความจำ (Zero-Read Local Search Index):</strong> ข้อมูลนักเรียนถูกสร้างเป็น <code className="font-mono">Map&lt;studentCode, Student&gt;</code> ใน RAM ของโปรแกรม การพิมพ์รหัสนักเรียนหรือพิมพ์ค้นหาเลขพัสดุทุกตัวอักษรจะค้นหาจากหน่วยความจำเครื่อง 100% (ใช้ Firestore Read = 0 ครั้ง)
            </li>
            <li>
              <strong>3. การฝังข้อมูลหอพักลงในพัสดุ (Denormalization):</strong> ลดการทำ Relational Read ระหว่างตาราง <code className="font-mono">parcels</code> และ <code className="font-mono">students</code> ลงได้ 50% ทันทีเมื่อดึงข้อมูลมาออกใบรายการ
            </li>
          </ul>
        </div>
      </section>

      {/* Deliverable 2: Project Structure */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">
              02. โครงสร้างโฟลเดอร์โปรเจกต์ (Project Structure)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('tree', PROJECT_TREE_CODE)}
            className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId === 'tree' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'tree' ? 'คัดลอกแล้ว' : 'คัดลอกโครงสร้าง'}</span>
          </button>
        </div>
        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto leading-relaxed">
          {PROJECT_TREE_CODE}
        </pre>
      </section>

      {/* Deliverable 3: Annotated Batched Writes Code */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Code2 className="w-5 h-5 text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">
              03. โค้ดระบบ Firestore Batched Writes (แบ่ง Chunk อัตโนมัติ)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('batch', BATCH_WRITE_SNIPPET)}
            className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId === 'batch' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'batch' ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
          </button>
        </div>
        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto leading-relaxed">
          {BATCH_WRITE_SNIPPET}
        </pre>
      </section>

      {/* Deliverable 4: GitHub Actions Workflow */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-slate-900" />
            <h2 className="text-lg font-bold text-slate-900">
              04. GitHub Actions CI/CD Workflow (`.github/workflows/deploy.yml`)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleCopy('yml', DEPLOY_YML_CODE)}
            className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId === 'yml' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'yml' ? 'คัดลอกแล้ว' : 'คัดลอก deploy.yml'}</span>
          </button>
        </div>
        <p className="text-xs text-slate-600">
          ไฟล์นี้ถูกสร้างไว้ในโปรเจกต์เรียบร้อยแล้วที่พาธ <code className="font-mono font-bold">.github/workflows/deploy.yml</code> เมื่อทำการ Push โค้ดขึ้นกิ่ง <code className="font-mono font-bold">main</code> ระบบจะทำการติดตั้งแพ็กเกจ, Build โปรเจกต์ และอัปเดตขึ้น GitHub Pages อัตโนมัติ
        </p>
        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto leading-relaxed">
          {DEPLOY_YML_CODE}
        </pre>
      </section>

      {/* Deliverable 5: Setup Guide */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <BookOpen className="w-5 h-5 text-slate-900" />
          <h2 className="text-lg font-bold text-slate-900">
            05. คู่มือการตั้งค่า Firebase และการนำขึ้นรันบน GitHub Pages (Setup Guide)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 leading-relaxed">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              ขั้นตอนที่ 1: การตั้งค่า Firebase Project
            </h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                เข้าสู่ <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-semibold text-slate-900">Firebase Console</a> และสร้างโปรเจกต์ใหม่ (ในระบบนี้ได้ทำการ Provision ฐานข้อมูลจริงไว้ให้แล้วในไฟล์ <code className="font-mono">firebase-applet-config.json</code>)
              </li>
              <li>
                ไปที่เมนู <strong>Authentication &gt; Sign-in method</strong> และเปิดใช้งาน <strong>Google Sign-In</strong>
              </li>
              <li>
                ไปที่เมนู <strong>Authentication &gt; Settings &gt; Authorized domains</strong> แล้วเพิ่มโดเมน GitHub Pages ของคุณ เช่น <code className="font-mono">username.github.io</code>
              </li>
              <li>
                ไปที่เมนู <strong>Firestore Database &gt; Rules</strong> และวางกฎความปลอดภัยจากไฟล์ <code className="font-mono">firestore.rules</code>
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              ขั้นตอนที่ 2: การนำโค้ดขึ้น GitHub Pages พร้อม CI/CD
            </h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                สร้าง Repository ใหม่บน GitHub และ Push โค้ดทั้งหมดขึ้นกิ่ง <code className="font-mono">main</code>
              </li>
              <li>
                ในไฟล์ <code className="font-mono">vite.config.ts</code> ได้ตั้งค่า <code className="font-mono">base: './'</code> ไว้ให้แล้ว ทำให้รองรับทุกชื่อ Repository บน GitHub Pages โดยที่ไฟล์ CSS/JS ไม่พัง
              </li>
              <li>
                ไปที่หน้า GitHub Repository &gt; <strong>Settings &gt; Pages</strong>
              </li>
              <li>
                ในหัวข้อ <strong>Build and deployment &gt; Source</strong> ให้เปลี่ยนจาก <em>Deploy from a branch</em> เป็น <strong>GitHub Actions</strong>
              </li>
              <li>
                เมื่อ Push โค้ดใหม่ Workflow ใน <code className="font-mono">.github/workflows/deploy.yml</code> จะทำงานอัตโนมัติและเผยแพร่เว็บไซต์ภายใน 1-2 นาที
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
};
