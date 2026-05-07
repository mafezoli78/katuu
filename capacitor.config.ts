import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.katuu.app',
  appName: 'Katuu',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    App: {
      launchUrl: 'com.katuu.app://',
    },
  },
};

export default config;