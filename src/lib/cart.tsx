import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { CartLine, Product } from './types'

const STORAGE_KEY = 'pet-corner:cart'
const MAX_QUANTITY = 99
const MAX_LINES = 50
const PRODUCT_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
interface CartState { items: CartLine[]; notice: string | null }
interface CartContextValue extends CartState {
  count: number
  add: (product: Product, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
  dismissNotice: () => void
}
type CartAction =
  | { type: 'add'; product: Product; quantity: number }
  | { type: 'quantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'dismiss' }

function restoreCart(): CartState {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) return { items: [], notice: null }
    const quantities = new Map<string, number>()
    for (const line of stored) {
      if (!line || typeof line !== 'object') continue
      const candidate = line as Record<string, unknown>
      if (typeof candidate.productId !== 'string' || !PRODUCT_ID_PATTERN.test(candidate.productId.trim())) continue
      if (typeof candidate.quantity !== 'number' || !Number.isSafeInteger(candidate.quantity) || candidate.quantity <= 0) continue
      const id = candidate.productId.trim()
      if (!quantities.has(id) && quantities.size >= MAX_LINES) continue
      quantities.set(id, Math.min(MAX_QUANTITY, (quantities.get(id) || 0) + candidate.quantity))
    }
    return { items: Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })), notice: null }
  } catch { return { items: [], notice: null } }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (!Number.isSafeInteger(action.quantity) || action.quantity < 1) return state
      const stock = Number.isFinite(action.product.stock) ? Math.max(0, Math.floor(action.product.stock)) : 0
      if (stock === 0) return { ...state, notice: 'هذا المنتج غير متوفر حاليًا.' }
      const current = state.items.find((line) => line.productId === action.product.id)?.quantity || 0
      if (!current && state.items.length >= MAX_LINES) return { ...state, notice: 'وصلت السلة إلى الحد المسموح من المنتجات المختلفة. يمكنك إكمال طلبك أولًا.' }
      const quantity = Math.min(current + action.quantity, stock, MAX_QUANTITY)
      const items = current
        ? state.items.map((line) => line.productId === action.product.id ? { ...line, quantity } : line)
        : [...state.items, { productId: action.product.id, quantity }]
      return { items, notice: quantity < current + action.quantity ? 'تم ضبط الكمية وفق المتاح لهذا المنتج.' : 'أُضيف المنتج إلى سلتك.' }
    }
    case 'quantity': {
      if (!Number.isSafeInteger(action.quantity) || action.quantity < 0) return state
      return { ...state, items: action.quantity === 0
        ? state.items.filter((line) => line.productId !== action.productId)
        : state.items.map((line) => line.productId === action.productId ? { ...line, quantity: Math.min(MAX_QUANTITY, action.quantity) } : line) }
    }
    case 'remove': return { ...state, items: state.items.filter((line) => line.productId !== action.productId) }
    case 'clear': return { items: [], notice: null }
    case 'dismiss': return { ...state, notice: null }
  }
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, restoreCart)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)) } catch { /* The cart remains usable when storage is unavailable. */ }
  }, [state.items])
  const value: CartContextValue = {
    ...state, count: state.items.reduce((sum, line) => sum + line.quantity, 0),
    add: (product, quantity = 1) => dispatch({ type: 'add', product, quantity }),
    setQuantity: (productId, quantity) => dispatch({ type: 'quantity', productId, quantity }),
    remove: (productId) => dispatch({ type: 'remove', productId }), clear: () => dispatch({ type: 'clear' }),
    dismissNotice: () => dispatch({ type: 'dismiss' }),
  }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react/only-export-components -- The provider and hook intentionally share this context module.
export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}
