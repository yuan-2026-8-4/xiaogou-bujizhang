import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 配置：将 React 网页打包为 Android APK
// - webDir: Vite 构建产物目录（npm run build:capacitor → dist/）
// - appId: Android 包名（com.xiaogou.bujizhang）
// - appName: 显示在桌面图标下的名字
// - android: 后台颜色（蓝绿渐变同 App 主题）
const config: CapacitorConfig = {
  appId: 'com.xiaogou.bujizhang',
  appName: '小狗不记账',
  webDir: 'dist',
  backgroundColor: '#14B8A6',
  android: {
    backgroundColor: '#14B8A6',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
