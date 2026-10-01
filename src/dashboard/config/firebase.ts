import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

function getEnvVar(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {
    // ignore
  }
  return undefined;
}

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyCJ1DhmehgqKh_FMRUaCqwm1x-esjcEvbU',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'kitchen-bots.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'kitchen-bots',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'kitchen-bots.firebasestorage.app',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '830613552692',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:830613552692:web:f8d96a2af80a45f4a61461'
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use Auth Emulator if configured in dev environment
const emulatorHost = getEnvVar('VITE_FIREBASE_AUTH_EMULATOR_HOST');
if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}`);
}

export default app;
