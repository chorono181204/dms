import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill for URL.parse (missing in Electron 30 / Chromium 124)
// Required by pdfjs-dist v4.4+ / react-pdf v9+
if (typeof URL.parse === 'undefined') {
  // @ts-ignore
  URL.parse = (url: string | URL, base?: string | URL) => {
    try {
      return new URL(url, base);
    } catch (e) {
      return null;
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
