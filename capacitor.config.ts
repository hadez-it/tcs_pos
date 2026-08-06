import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mibayate.pos',
  appName: 'MiBayate POS',
  webDir: 'dist',
  android: {
    // Capacitor v6 serves the app over https://localhost by default, which the
    // SPP plugin needs for a stable WebView origin.
    allowMixedContent: true,
  },
};

export default config;