import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppStoreProvider } from './store/AppStore'
import './index.css'

// 应用入口：挂载全局状态 + 路由
// HashRouter：兼容 GitHub Pages 等静态托管（无 SPA 回退能力），同样兼容 Android WebView（file:// 协议下 hash 路由不会触发文件加载）

// Capacitor 安卓初始化：状态栏透明蓝绿主题色 + 设置全屏沉浸式
// 在 Capacitor 环境（capacitor.config.ts webDir + Android WebView）才执行，浏览器环境直接跳过
const isCapacitor = typeof window !== 'undefined'
  && (window as any).Capacitor?.isNativePlatform?.();
if (isCapacitor) {
  Promise.all([
    import('@capacitor/status-bar').then(m => {
      m.StatusBar?.setBackgroundColor?.({ color: '#14B8A6' })
      m.StatusBar?.setStyle?.({ style: m.Style.Light })
    }),
    import('@capacitor/app').then(m => m.App?.addListener?.('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      // 安卓返回键：能回退就回退，否则退出
      if (canGoBack) window.history.back();
      else m.App?.exitApp?.();
    })),
  ]).catch(() => { /* Capacitor 模块缺失时静默 */ })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </HashRouter>
  </React.StrictMode>,
)
