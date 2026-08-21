import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mibayate.pos',
  appName: 'TCS POS',
  webDir: 'dist',
  server: {
    url: 'https://mibayate-pos.vercel.app/',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;