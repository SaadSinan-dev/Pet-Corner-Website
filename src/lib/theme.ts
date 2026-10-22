import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const EVENT = 'petcorner:theme'
function snapshot(): Theme { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'pet-corner-theme') return
    document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light'
    notify()
  }
  window.addEventListener(EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener('storage', onStorage) }
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light' as Theme)
  function toggle() {
    const next = snapshot() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#101f2a' : '#103f6b')
    try { localStorage.setItem('pet-corner-theme', next) } catch { /* Choice stays available for this page session. */ }
    window.dispatchEvent(new Event(EVENT))
  }
  return { theme, toggle }
}
