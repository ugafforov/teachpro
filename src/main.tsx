import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logEnvironmentInfo } from '@/lib/productionValidator'

// Initialize environment validation
logEnvironmentInfo();

// PWA Service Worker registration
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
