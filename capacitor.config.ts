import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.katuu.app',
  appName: 'Katuu',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#1F3A5F',
    allowMixedContent: true,
  },
  plugins: {
    SocialLogin: {
      google: {
        webClientId: '218022107605-ca7duh6mt7k9jdii3tgtaakfr6co0tk1.apps.googleusercontent.com',
      },
    },
  },
};
export default config;