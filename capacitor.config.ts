import { CapacitorConfig } from '@capacitor/cli';

// RAKSHA Android shell — loads the existing Vite production build (dist/).
// No secrets here: the API base URL is baked from VITE_API_BASE_URL at build time.
const config: CapacitorConfig = {
  appId: 'com.raksha.healthcare',
  appName: 'RAKSHA',
  webDir: 'dist',
  backgroundColor: '#0F3D33',
  android: {
    // Production posture: no cleartext HTTP in release builds.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0F3D33',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0F3D33',
    },
    PushNotifications: {
      // FCM sender configuration lives in android/app/google-services.json
      // (NOT committed — see docs/ANDROID.md). No credentials in this file.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
