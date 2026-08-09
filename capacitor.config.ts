import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mibayate.pos',
  appName: 'MiBayate POS',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;