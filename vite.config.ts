import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
if (!fs.existsSync(firebaseConfigPath)) {
  fs.writeFileSync(
    firebaseConfigPath,
    JSON.stringify(
      {
        projectId: 'gen-lang-client-0068612636',
        appId: '1:294915648858:web:b83089c20ab24a27505763',
        apiKey: 'AIzaSyAXCabVQnk0VqfCglvmiFSHeEtucZou3Mc',
        authDomain: 'gen-lang-client-0068612636.firebaseapp.com',
        firestoreDatabaseId: 'ai-studio-studentparcelman-0e2e98b1-248f-4518-ba3e-e8f8df5fc899',
        storageBucket: 'gen-lang-client-0068612636.firebasestorage.app',
        messagingSenderId: '294915648858',
        measurementId: '',
        oAuthClientId: '294915648858-pl0knt6ddl6s9mj1i1qm76e9pp7fgq5m.apps.googleusercontent.com',
        recaptchaSiteKey: '',
      },
      null,
      2
    )
  );
}

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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
