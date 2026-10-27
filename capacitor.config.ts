/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/splash-screen" />
import type { CapacitorConfig } from '@capacitor/cli'
import type { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'app.amiv',
  appName: 'Amiv',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    Keyboard: {
      resize: 'native' as KeyboardResize,
    },
    SplashScreen: {
      backgroundColor: '#faf9fb',
    },
  },
}

export default config
