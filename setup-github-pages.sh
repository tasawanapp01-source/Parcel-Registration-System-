#!/usr/bin/env bash
set -e

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
  contents: write
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 1. Checkout Source Code
        uses: actions/checkout@v4

      - name: 2. Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: 3. Ensure Firebase Config Exists
        run: |
          if [ ! -f "firebase-applet-config.json" ]; then
            cat << 'CONFIG_EOF' > firebase-applet-config.json
          {
            "projectId": "gen-lang-client-0068612636",
            "appId": "1:294915648858:web:b83089c20ab24a27505763",
            "apiKey": "AIzaSyAXCabVQnk0VqfCglvmiFSHeEtucZou3Mc",
            "authDomain": "gen-lang-client-0068612636.firebaseapp.com",
            "firestoreDatabaseId": "ai-studio-studentparcelman-0e2e98b1-248f-4518-ba3e-e8f8df5fc899",
            "storageBucket": "gen-lang-client-0068612636.firebasestorage.app",
            "messagingSenderId": "294915648858",
            "measurementId": "",
            "oAuthClientId": "294915648858-pl0knt6ddl6s9mj1i1qm76e9pp7fgq5m.apps.googleusercontent.com",
            "recaptchaSiteKey": ""
          }
          CONFIG_EOF
          fi

      - name: 4. Install Dependencies
        run: npm install --legacy-peer-deps || npm install --force

      - name: 5. Build Production Bundle (Vite + React + Tailwind)
        run: |
          npm run build
          touch dist/.nojekyll
          cp dist/index.html dist/404.html

      - name: 6. Deploy to gh-pages Branch
        uses: peaceiris/actions-gh-pages@v4
        continue-on-error: true
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          force_orphan: true

      - name: 7. Configure GitHub Pages
        id: pages_config
        uses: actions/configure-pages@v5
        continue-on-error: true
        with:
          enablement: true

      - name: 8. Upload Build Artifact (dist/)
        if: steps.pages_config.outcome == 'success'
        uses: actions/upload-pages-artifact@v3
        continue-on-error: true
        with:
          path: './dist'

      - name: 9. Deploy to GitHub Pages
        if: steps.pages_config.outcome == 'success'
        id: deployment
        uses: actions/deploy-pages@v4
        continue-on-error: true
EOF

echo "[สำเร็จ] อัปเดตไฟล์ .github/workflows/deploy.yml เรียบร้อยแล้ว!"
