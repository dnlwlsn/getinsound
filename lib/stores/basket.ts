import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface BaseItem {
  artistId: string
  artistName: string
  artistSlug: string
  pricePence: number
  currency: string
  accentColour: string | null
}

export interface ReleaseBasketItem extends BaseItem {
  type: 'release'
  releaseId: string
  releaseTitle: string
  releaseSlug: string
  coverUrl: string | null
  customAmountPence?: number
}

export interface MerchBasketItem extends BaseItem {
  type: 'merch'
  merchId: string
  merchName: string
  variant: string | null
  postagePence: number
  photoUrl: string | null
}

export type BasketItem = ReleaseBasketItem | MerchBasketItem

function itemKey(item: BasketItem): string {
  if (item.type === 'merch') return `merch:${item.merchId}:${item.variant ?? ''}`
  return `release:${item.releaseId}`
}

interface BasketState {
  items: BasketItem[]
  add: (item: BasketItem) => void
  remove: (item: BasketItem) => void
  clear: () => void
  has: (item: BasketItem) => boolean
  itemsTotal: () => number
  postageTotal: () => number
  total: () => number
  hasMerch: () => boolean
}

const MAX_ITEMS = 20

export const useBasketStore = create<BasketState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item: BasketItem) => {
        const { items } = get()
        const key = itemKey(item)
        if (items.some(i => itemKey(i) === key)) return
        if (items.length >= MAX_ITEMS) return
        set({ items: [...items, item] })
      },

      remove: (item: BasketItem) => {
        const key = itemKey(item)
        set({ items: get().items.filter(i => itemKey(i) !== key) })
      },

      clear: () => set({ items: [] }),

      has: (item: BasketItem) => {
        const key = itemKey(item)
        return get().items.some(i => itemKey(i) === key)
      },

      itemsTotal: () => {
        return get().items.reduce((sum, i) => {
          if (i.type === 'release') return sum + (i.customAmountPence ?? i.pricePence)
          return sum + i.pricePence
        }, 0)
      },

      postageTotal: () => {
        return get().items.reduce((sum, i) => {
          if (i.type === 'merch') return sum + i.postagePence
          return sum
        }, 0)
      },

      total: () => {
        return get().itemsTotal() + get().postageTotal()
      },

      hasMerch: () => get().items.some(i => i.type === 'merch'),
    }),
    {
      name: 'insound-basket',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
