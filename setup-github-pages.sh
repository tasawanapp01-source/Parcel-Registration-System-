#!/usr/bin/env bash
set -e

echo "============================================================================"
echo "  ระบบติดตั้ง GitHub Pages และ GitHub Actions อัตโนมัติ (Student Parcel System)"
echo "============================================================================"
echo ""

mkdir -p .github/workflows
mkdir -p public
touch public/.nojekyll

cat << 'EOF' > .github/workflows/deploy.yml
name: Deploy Student Parcel System to GitHub Pages

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

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
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: 8. Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
EOF

echo "[สำเร็จ] สร้างไฟล์ .github/workflows/deploy.yml และ public/.nojekyll เรียบร้อยแล้ว!"
echo ""

read -r -p "กรุณาวาง URL ของ GitHub Repository (เช่น https://github.com/username/parcel-system.git หรือกด Enter เพื่อข้าม): " REPO_URL

if [ -z "$REPO_URL" ]; then
  echo ""
  echo "ข้ามการ Push อัตโนมัติ คุณสามารถรันคำสั่งต่อไปนี้ด้วยตนเองภายหลัง:"
  echo "  git init"
  echo "  git add ."
  echo "  git commit -m 'Setup GitHub Pages and GitHub Actions'"
  echo "  git branch -M main"
  echo "  git remote add origin <URL-ของ-GitHub-Repo>"
  echo "  git push -u origin main"
  exit 0
fi

git init
git add .
git commit -m "Deploy Student Parcel System to GitHub Pages" || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git push -u origin main

echo ""
echo "============================================================================"
echo "  อัปโหลดโค้ดขึ้น GitHub สำเร็จ!"
echo "  ขั้นตอนสุดท้าย: ไปที่ GitHub Repo > Settings > Pages"
echo "  ตรงหัวข้อ Build and deployment > Source ให้เลือกเป็น 'GitHub Actions'"
echo "============================================================================"
