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
    // Empêche WKWebView de faire défiler le document au focus d'un input :
    // seuls les conteneurs overflow: auto scrollent.
    scrollEnabled: false,
  },
  plugins: {
    Keyboard: {
      resize: 'native' as KeyboardResize,
    },
    SplashScreen: {
      backgroundColor: '#faf9fb',
    },
    // Notification reçue app ouverte : bannière + son, comme app fermée.
    PushNotifications: {
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
}

export default config
