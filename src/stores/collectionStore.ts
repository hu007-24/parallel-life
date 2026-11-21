import { create } from 'zustand'
import type { CollectionRecord } from '@/database/mapping'
import { collectionRepository } from '@/database/repositories'

interface CollectionState {
  records: CollectionRecord[]
  loaded: boolean
  load: () => Promise<void>
  sync: (records: CollectionRecord[]) => void
}

export const useCollectionStore = create<CollectionState>((set) => ({
  records: [],
  loaded: false,

  load: async () => {
    try {
      const records = await collectionRepository.list()
      set({ records, loaded: true })
    } catch {
      set({ records: [], loaded: true })
    }
  },

  sync: (records) => set({ records, loaded: true }),
}))