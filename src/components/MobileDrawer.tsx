import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function MobileDrawer({ open, close, children }: { open: boolean; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (open) {
      node.removeAttribute('data-closing')
      if (!node.open) node.showModal()
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previous }
    }
    if (!node.open) return
    node.dataset.closing = 'true'
    const timer = window.setTimeout(() => node.close(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
    return () => window.clearTimeout(timer)
  }, [open])
  return <dialog ref={dialog} className="mobile-drawer" id="mobile-nav" aria-label="قائمة المتجر" onCancel={event => { event.preventDefault(); close() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
  }}>{children}</dialog>
}
