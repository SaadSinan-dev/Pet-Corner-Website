import { useEffect } from 'react'

export function BootstrapReady() {
  useEffect(() => { window.dispatchEvent(new Event('petcorner:ready')) }, [])
  return null
}
