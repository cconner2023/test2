import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './serviceWorker.ts'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register service worker AFTER React renders
// This ensures the page is loaded before SW registration
setTimeout(() => {
  registerServiceWorker();
}, 100);