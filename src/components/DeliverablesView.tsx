import React, { useState } from 'react';
import {
  Database,
  FolderTree,
  Code2,
  GitBranch,
  BookOpen,
  Copy,
  Check,
  Download,
  Terminal,
  FileCode,
  Rocket,
  CheckCircle2,
} from 'lucide-react';

const DEPLOY_YML_CODE = `name: Deploy Student Parcel System to GitHub Pages

on:
  push:
    branches:
      - main
      - master
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
          node-version: 22

      - name: 3. Setup Bun Runtime
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: 4. Install Dependencies
        run: |
          if [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
            bun install
          elif [ -f "package-lock.json" ]; then
            npm ci --legacy-peer-deps || npm install --legacy-peer-deps
          else
            npm install --legacy-peer-deps
          fi

      - name: 5. Build Production Bundle (Vite + React + Tailwind)
        run: |
          npm run build
          touch dist/.nojekyll
          cp dist/index.html dist/404.html

      - name: 6. Configure GitHub Pages
        uses: actions/configure-pages@v5

      - name: 7. Upload Build Artifact (dist/)
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
      - name: 8. Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

const VITE_CONFIG_CODE = `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});`;

function buildWindowsBatScript(repoUrl: string): string {
  const cleanUrl = repoUrl.trim();
  return `@echo off
chcp 65001 >nul
echo ============================================================================
echo   ระบบติดตั้ง GitHub Pages และ GitHub Actions อัตโนมัติ (Student Parcel System)
echo ============================================================================
echo.

REM 1. สร้างโฟลเดอร์ .github\\workflows และ public หากยังไม่มี
if not exist ".github\\workflows" mkdir ".github\\workflows"
if not exist "public" mkdir "public"

REM 2. สร้างไฟล์ public\\.nojekyll เพื่อป้องกัน Jekyll บล็อกไฟล์ของ Vite
type nul > "public\\.nojekyll"

REM 3. สร้างไฟล์ .github\\workflows\\deploy.yml
(
echo name: Deploy Student Parcel System to GitHub Pages
echo.
echo on:
echo   push:
echo     branches:
echo       - main
echo       - master
echo   workflow_dispatch:
echo.
echo permissions:
echo   contents: read
echo   pages: write
echo   id-token: write
echo.
echo concurrency:
echo   group: "pages"
echo   cancel-in-progress: true
echo.
echo jobs:
echo   build:
echo     runs-on: ubuntu-latest
echo     steps:
echo       - name: 1. Checkout Source Code
echo         uses: actions/checkout@v4
echo.
echo       - name: 2. Setup Node.js Environment
echo         uses: actions/setup-node@v4
echo         with:
echo           node-version: 22
echo.
echo       - name: 3. Setup Bun Runtime
echo         uses: oven-sh/setup-bun@v2
echo         with:
echo           bun-version: latest
echo.
echo       - name: 4. Install Dependencies
echo         run: ^|
echo           if [ -f "bun.lock" ] ^|^| [ -f "bun.lockb" ]; then
echo             bun install
echo           elif [ -f "package-lock.json" ]; then
echo             npm ci --legacy-peer-deps ^|^| npm install --legacy-peer-deps
echo           else
echo             npm install --legacy-peer-deps
echo           fi
echo.
echo       - name: 5. Build Production Bundle ^(Vite + React + Tailwind^)
echo         run: ^|
echo           npm run build
echo           touch dist/.nojekyll
echo           cp dist/index.html dist/404.html
echo.
echo       - name: 6. Configure GitHub Pages
echo         uses: actions/configure-pages@v5
echo.
echo       - name: 7. Upload Build Artifact ^(dist/^)
echo         uses: actions/upload-pages-artifact@v3
echo         with:
echo           path: './dist'
echo.
echo   deploy:
echo     environment:
echo       name: github-pages
echo       url: \${{ steps.deployment.outputs.page_url }}
echo     runs-on: ubuntu-latest
echo     needs: build
echo     steps:
echo       - name: 8. Deploy to GitHub Pages
echo         id: deployment
echo         uses: actions/deploy-pages@v4
) > ".github\\workflows\\deploy.yml"

echo [สำเร็จ] สร้างไฟล์ .github\\workflows\\deploy.yml และ public\\.nojekyll เรียบร้อยแล้ว!
echo.

${
  cleanUrl
    ? `set "REPO_URL=${cleanUrl}"`
    : `set /p REPO_URL="กรุณาวาง URL ของ GitHub Repository (เช่น https://github.com/username/parcel-system.git): "`
}

if "%REPO_URL%"=="" (
    echo ข้ามการ Push อัตโนมัติ
    pause
    exit /b 0
)

git init
git add .
git commit -m "Deploy Student Parcel System to GitHub Pages"
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main

echo.
echo ============================================================================
echo   อัปโหลดโค้ดขึ้น GitHub สำเร็จ!
echo   ขั้นตอนสุดท้าย: ไปที่ GitHub Repo ^> Settings ^> Pages
echo   ตรงหัวข้อ Build and deployment ^> Source ให้เลือกเป็น "GitHub Actions"
echo ============================================================================
pause
`;
}

function buildBashScript(repoUrl: string): string {
  const cleanUrl = repoUrl.trim();
  return `#!/usr/bin/env bash
set -e

echo "============================================================================"
echo "  ระบบติดตั้ง GitHub Pages และ GitHub Actions อัตโนมัติ (Student Parcel System)"
echo "============================================================================"

mkdir -p .github/workflows
mkdir -p public
touch public/.nojekyll

cat << 'EOF' > .github/workflows/deploy.yml
${DEPLOY_YML_CODE}
EOF

echo "[สำเร็จ] สร้างไฟล์ .github/workflows/deploy.yml และ public/.nojekyll เรียบร้อยแล้ว!"

${
  cleanUrl
    ? `REPO_URL="${cleanUrl}"`
    : `read -r -p "กรุณาวาง URL ของ GitHub Repository (เช่น https://github.com/username/parcel-system.git): " REPO_URL`
}

if [ -z "$REPO_URL" ]; then
  echo "ข้ามการ Push อัตโนมัติ"
  exit 0
fi

git init
git add .
git commit -m "Deploy Student Parcel System to GitHub Pages" || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git push -u origin main

echo "============================================================================"
echo "  อัปโหลดโค้ดขึ้น GitHub สำเร็จ!"
echo "  ขั้นตอนสุดท้าย: ไปที่ GitHub Repo > Settings > Pages"
echo "  ตรงหัวข้อ Build and deployment > Source ให้เลือกเป็น 'GitHub Actions'"
echo "============================================================================"
`;
}

const PROJECT_TREE_CODE = `student-parcel-system/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions CI/CD สำหรับ Deploy ขึ้น GitHub Pages อัตโนมัติ
├── public/
│   └── .nojekyll                     # ป้องกัน GitHub Pages (Jekyll) บล็อกไฟล์ Assets ของ Vite
├── src/
│   ├── components/
│   │   ├── InboundView.tsx           # หน้าสแกนรับพัสดุ & ป้ายสีประจำหอพัก (Mobile-First)
│   │   ├── TrackingView.tsx          # หน้าค้นหาและติดตามสถานะพัสดุ (Zero-Read Local Index)
│   │   ├── ManifestView.tsx          # หน้าสร้างและพิมพ์ใบรายการนำส่งพัสดุ (Printable A4)
│   │   ├── StudentsImportView.tsx    # หน้านำเข้าข้อมูลนักเรียน CSV/Excel ด้วย Batched Writes
│   │   ├── DashboardView.tsx         # หน้าสถิติ กราฟเส้น และวิเคราะห์ Peak Hours (Chart.js)
│   │   └── DeliverablesView.tsx      # ศูนย์ดาวน์โหลดไฟล์ติดตั้ง GitHub Pages & GitHub Actions
│   ├── context/
│   │   └── ParcelSystemContext.tsx   # ระบบจัดการ Local Cache + Pending Write Queue ลดโควตา Firebase
│   ├── services/
│   │   └── firebase.ts               # ตั้งค่า Firebase SDK, Batched Writes (450 docs/batch) & Error Handler
│   ├── types/
│   │   └── parcel.ts                 # โครงสร้างข้อมูล TypeScript, สีประจำหอพัก และข้อมูลเริ่มต้น
│   ├── App.tsx                       # โครงสร้าง Navigation (Top Bar + Mobile Bottom Tab Bar)
│   ├── index.css                     # Tailwind CSS + ตั้งค่าหน้ากระดาษ @media print
│   └── main.tsx                      # Entry Point ของแอปพลิเคชัน
├── setup-github-pages.bat            # ไฟล์ติดตั้งและ Push ขึ้น GitHub Pages อัตโนมัติ (สำหรับ Windows)
├── setup-github-pages.sh             # ไฟล์ติดตั้งและ Push ขึ้น GitHub Pages อัตโนมัติ (สำหรับ Mac/Linux)
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
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [activeScriptTab, setActiveScriptTab] = useState<'yml' | 'bat' | 'sh' | 'vite'>('yml');

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const effectiveRepoUrl =
    repoUrl.trim() || 'https://github.com/<ชื่อผู้ใช้ของคุณ>/student-parcel-system.git';

  const gitTerminalCommands = `git init
git add .
git commit -m "Deploy Student Parcel System to GitHub Pages"
git branch -M main
git remote add origin ${effectiveRepoUrl}
git push -u origin main`;

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-700">
            ศูนย์ติดตั้ง GitHub Pages & GitHub Actions อัตโนมัติ · โครงสร้างระบบ · คู่มือการใช้งาน
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            ไฟล์ติดตั้ง GitHub Pages และ GitHub Actions (CI/CD Installer)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadFile('deploy.yml', DEPLOY_YML_CODE)}
            className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลด deploy.yml</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleDownloadFile('setup-github-pages.bat', buildWindowsBatScript(repoUrl))
            }
            className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลดตัวติดตั้งอัตโนมัติ (.bat สำหรับ Windows)</span>
          </button>
        </div>
      </div>

      {/* SECTION 0: ศูนย์ดาวน์โหลดและสร้างไฟล์ติดตั้ง GitHub Pages & GitHub Actions */}
      <section className="bg-white border-2 border-slate-900 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                ชุดไฟล์ติดตั้ง GitHub Pages และ GitHub Action (พร้อมใช้งานในโปรเจกต์)
              </h2>
              <p className="text-xs text-slate-600">
                ไฟล์ทั้งหมดถูกสร้างไว้ในโปรเจกต์แล้ว และคุณสามารถกดดาวน์โหลดแยกไฟล์หรือดาวน์โหลดสคริปต์ติดตั้งคลิกเดียวได้ที่นี่
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold self-start md:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>สร้างไฟล์ในโปรเจกต์เรียบร้อยแล้ว</span>
          </span>
        </div>

        {/* ตัวกำหนด URL ของ GitHub Repository เพื่อสร้างสคริปต์อัตโนมัติ */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <label
            htmlFor="github-repo-url-input"
            className="block text-xs font-bold text-slate-800"
          >
            ระบุลิงก์ GitHub Repository ของคุณ (ไม่บังคับ — เพื่อฝังลงในไฟล์ติดตั้ง .bat / .sh และชุดคำสั่ง Git อัตโนมัติ):
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="github-repo-url-input"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="เช่น https://github.com/username/student-parcel-system.git"
              className="flex-1 min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="button"
              onClick={() => handleCopy('git-cmds', gitTerminalCommands)}
              className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {copiedId === 'git-cmds' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Terminal className="w-4 h-4" />
              )}
              <span>{copiedId === 'git-cmds' ? 'คัดลอกคำสั่ง Git แล้ว' : 'คัดลอกคำสั่ง Git Push'}</span>
            </button>
          </div>
        </div>

        {/* การ์ดดาวน์โหลดไฟล์ทั้ง 4 ไฟล์หลัก */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-white hover:border-slate-400 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  .github/workflows/deploy.yml
                </span>
                <GitBranch className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                1. ไฟล์ GitHub Actions
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                สั่ง Build โปรเจกต์ (รองรับทั้ง Bun และ NPM) สร้าง <code className="font-mono">.nojekyll</code>, <code className="font-mono">404.html</code> และ Deploy ขึ้น GitHub Pages อัตโนมัติ
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownloadFile('deploy.yml', DEPLOY_YML_CODE)}
                className="flex-1 min-h-[36px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScriptTab('yml');
                  handleCopy('card-yml', DEPLOY_YML_CODE);
                }}
                className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedId === 'card-yml' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>คัดลอก</span>
              </button>
            </div>
          </div>

          <div className="border border-emerald-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-emerald-50/40 hover:border-emerald-400 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                  setup-github-pages.bat
                </span>
                <Terminal className="w-4 h-4 text-emerald-700" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                2. ตัวติดตั้งคลิกเดียว (Windows)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ดับเบิลคลิกรันบน Windows เพื่อสร้างโฟลเดอร์ <code className="font-mono">.github\workflows\deploy.yml</code> และ Push ขึ้น GitHub ให้ทันที
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-emerald-100">
              <button
                type="button"
                onClick={() =>
                  handleDownloadFile('setup-github-pages.bat', buildWindowsBatScript(repoUrl))
                }
                className="flex-1 min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด .bat</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScriptTab('bat');
                  handleCopy('card-bat', buildWindowsBatScript(repoUrl));
                }}
                className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedId === 'card-bat' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>คัดลอก</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-white hover:border-slate-400 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  setup-github-pages.sh
                </span>
                <Terminal className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                3. ตัวติดตั้ง (macOS / Linux)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                สคริปต์ Bash สำหรับสร้างไฟล์ Action, <code className="font-mono">.nojekyll</code> และอัปโหลดโค้ดขึ้น GitHub Repository อัตโนมัติ
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  handleDownloadFile('setup-github-pages.sh', buildBashScript(repoUrl))
                }
                className="flex-1 min-h-[36px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด .sh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScriptTab('sh');
                  handleCopy('card-sh', buildBashScript(repoUrl));
                }}
                className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedId === 'card-sh' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>คัดลอก</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-white hover:border-slate-400 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                  vite.config.ts
                </span>
                <FileCode className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                4. ไฟล์ตั้งค่า GitHub Pages Base
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ตั้งค่า <code className="font-mono">base: &apos;./&apos;</code> เพื่อให้แสดงผลบน GitHub Pages ได้ทุกชื่อ Repository โดยที่ลิงก์ CSS/JS ไม่เสีย
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownloadFile('vite.config.ts', VITE_CONFIG_CODE)}
                className="flex-1 min-h-[36px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveScriptTab('vite');
                  handleCopy('card-vite', VITE_CONFIG_CODE);
                }}
                className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedId === 'card-vite' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>คัดลอก</span>
              </button>
            </div>
          </div>
        </div>

        {/* แท็บแสดงโค้ดของไฟล์ติดตั้งแต่ละไฟล์ */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveScriptTab('yml')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeScriptTab === 'yml'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                .github/workflows/deploy.yml
              </button>
              <button
                type="button"
                onClick={() => setActiveScriptTab('bat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeScriptTab === 'bat'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                setup-github-pages.bat (Windows)
              </button>
              <button
                type="button"
                onClick={() => setActiveScriptTab('sh')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeScriptTab === 'sh'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                setup-github-pages.sh (Mac/Linux)
              </button>
              <button
                type="button"
                onClick={() => setActiveScriptTab('vite')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  activeScriptTab === 'vite'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                vite.config.ts
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const content =
                  activeScriptTab === 'yml'
                    ? DEPLOY_YML_CODE
                    : activeScriptTab === 'bat'
                    ? buildWindowsBatScript(repoUrl)
                    : activeScriptTab === 'sh'
                    ? buildBashScript(repoUrl)
                    : VITE_CONFIG_CODE;
                handleCopy('active-tab-code', content);
              }}
              className="min-h-[34px] px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              {copiedId === 'active-tab-code' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === 'active-tab-code' ? 'คัดลอกโค้ดแล้ว' : 'คัดลอกโค้ดด้านล่าง'}</span>
            </button>
          </div>

          <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto leading-relaxed max-h-[420px]">
            {activeScriptTab === 'yml'
              ? DEPLOY_YML_CODE
              : activeScriptTab === 'bat'
              ? buildWindowsBatScript(repoUrl)
              : activeScriptTab === 'sh'
              ? buildBashScript(repoUrl)
              : VITE_CONFIG_CODE}
          </pre>
        </div>

        {/* คู่มือเปิดใช้งาน GitHub Pages 3 ขั้นตอน */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
              ขั้นตอนที่ 1
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              นำโค้ดขึ้น GitHub Repository
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              สร้าง Repository บน GitHub แล้วดับเบิลคลิกรันไฟล์ <code className="font-mono font-bold">setup-github-pages.bat</code> หรือใช้เมนู Export to GitHub เพื่อส่งโค้ดขึ้นกิ่ง <code className="font-mono font-bold">main</code>
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
              ขั้นตอนที่ 2
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              ตั้งค่า Source เป็น GitHub Actions
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ไปที่หน้า GitHub Repo &gt; <strong>Settings</strong> &gt; เมนูซ้าย <strong>Pages</strong> &gt; ตรงหัวข้อ <strong>Build and deployment &gt; Source</strong> ให้เลือกเป็น <strong>GitHub Actions</strong>
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-700 text-white">
              ขั้นตอนที่ 3
            </span>
            <h3 className="text-sm font-bold text-slate-900">
              ออนไลน์พร้อมใช้งานอัตโนมัติ
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ไปที่แท็บ <strong>Actions</strong> บน GitHub ระบบจะ Build และเผยแพร่เว็บไซต์ขึ้นลิงก์ <code className="font-mono">https://&lt;username&gt;.github.io/&lt;repo&gt;/</code> ภายใน 1-2 นาที
            </p>
          </div>
        </div>
      </section>

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

      {/* Deliverable 4: Setup Guide */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <BookOpen className="w-5 h-5 text-slate-900" />
          <h2 className="text-lg font-bold text-slate-900">
            04. คู่มือการตั้งค่า Firebase และการนำขึ้นรันบน GitHub Pages (Setup Guide)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 leading-relaxed">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              ขั้นตอนที่ 1: การตั้งค่า Firebase Project
            </h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                เข้าสู่ <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-semibold text-slate-900">Firebase Console</a> (ในระบบนี้ได้ทำการตั้งค่าฐานข้อมูลจริงไว้ให้แล้วในไฟล์ <code className="font-mono">firebase-applet-config.json</code>)
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
                สร้าง Repository ใหม่บน GitHub และ Push โค้ดทั้งหมดขึ้นกิ่ง <code className="font-mono">main</code> (หรือรันไฟล์ <code className="font-mono">setup-github-pages.bat</code>)
              </li>
              <li>
                ในไฟล์ <code className="font-mono">vite.config.ts</code> ได้ตั้งค่า <code className="font-mono">base: &apos;./&apos;</code> และสร้าง <code className="font-mono">public/.nojekyll</code> ไว้ให้แล้ว ทำให้รองรับทุกชื่อ Repository บน GitHub Pages
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
