@echo off
chcp 65001 >nul
echo ============================================================================
echo   ระบบติดตั้ง GitHub Pages และ GitHub Actions อัตโนมัติ (Student Parcel System)
echo ============================================================================
echo.

REM 1. สร้างโฟลเดอร์ .github\workflows และ public หากยังไม่มี
if not exist ".github\workflows" mkdir ".github\workflows"
if not exist "public" mkdir "public"

REM 2. สร้างไฟล์ public\.nojekyll เพื่อป้องกัน Jekyll บล็อกไฟล์ของ Vite
type nul > "public\.nojekyll"

REM 3. สร้างไฟล์ .github\workflows\deploy.yml
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
echo       url: ${{ steps.deployment.outputs.page_url }}
echo     runs-on: ubuntu-latest
echo     needs: build
echo     steps:
echo       - name: 8. Deploy to GitHub Pages
echo         id: deployment
echo         uses: actions/deploy-pages@v4
) > ".github\workflows\deploy.yml"

echo [สำเร็จ] สร้างไฟล์ .github\workflows\deploy.yml และ public\.nojekyll เรียบร้อยแล้ว!
echo.

set /p REPO_URL="กรุณาวาง URL ของ GitHub Repository (เช่น https://github.com/username/parcel-system.git หรือกด Enter เพื่อข้าม): "

if "%REPO_URL%"=="" (
    echo.
    echo ข้ามการ Push อัตโนมัติ คุณสามารถรันคำสั่งต่อไปนี้ด้วยตนเองภายหลัง:
    echo   git init
    echo   git add .
    echo   git commit -m "Setup GitHub Pages and GitHub Actions"
    echo   git branch -M main
    echo   git remote add origin ^<URL-ของ-GitHub-Repo^>
    echo   git push -u origin main
    goto END
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

:END
pause
