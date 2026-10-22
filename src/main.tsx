import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './navigation.css'
import './storefront-upgrade.css'
import App from './App.tsx'
import { BootstrapReady } from './components/BootstrapReady'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <BootstrapReady />
  </StrictMode>,
)
