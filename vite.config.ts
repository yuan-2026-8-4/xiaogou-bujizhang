import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置：本地开发服务器 + GitHub Pages 子路径 + Capacitor (Android APK) 相对路径
export default defineConfig(({ mode }) => ({
  // github: GitHub Pages 子路径；capacitor: Android WebView 用相对路径加载 file:// 协议；默认 dev '/'
  base: mode === 'github' ? '/xiaogou-bujizhang/' : mode === 'capacitor' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 允许手机通过局域网访问，方便协同测试
  },
}))
