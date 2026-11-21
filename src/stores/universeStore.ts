import { create } from 'zustand'
import type { SimulationMode, Universe } from '@/types'
import {
  collectionRepository,
  universeRepository,
} from '@/database/repositories'
import type { CollectionRecord } from '@/database/mapping'
import { collectionsFromUniverse } from '@/database/mapping'
import { useCollectionStore } from '@/stores/collectionStore'
import {
  autoAdvance,
  branch as engineBranch,
  choose as engineChoose,
  createUniverse as engineCreate,
  deriveUniverse as engineDerive,
  getCurrentNode,
  getRoute,
  randomSeed,
  selectRoute as engineSelectRoute,
} from '@/engine/ple'
import { LIFE_EVENTS } from '@/data/events'
import { CHAPTERS } from '@/data/chapters'

export interface CreateUniverseInput {
  name: string
  archetypeId: string
  seed?: number
  startChapter?: number
  mode?: SimulationMode
}

export interface ImportResult {
  imported: number
  skipped: number
}

interface UniverseState {
  universes: Universe[]
  loaded: boolean
  load: () => Promise<void>
  createUniverse: (input: CreateUniverseInput) => Promise<Universe>
  choose: (universeId: string, choiceId: string) => Promise<Universe | null>
  branch: (universeId: string, nodeId: string, name: string) => Promise<Universe | null>
  selectRoute: (universeId: string, routeId: string) => Promise<Universe | null>
  deriveUniverse: (universeId: string, nodeId: string) => Promise<Universe | null>
  toggleFavorite: (universeId: string) => Promise<void>
  importData: (incoming: Universe[], collections?: CollectionRecord[]) => Promise<ImportResult>
  removeUniverse: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

const SPECIAL_IDS = new Set(LIFE_EVENTS.filter((e) => e.tier === 'special').map((e) => e.id))

async function syncCollections() {
  useCollectionStore.getState().sync(await collectionRepository.list())
}

/** 推进后的图鉴增量：新成就 / 新特殊事件 / 新结局（recordMissing 保证不覆盖既有记录） */
function collectionDelta(universe: Universe): Array<Omit<CollectionRecord, 'id' | 'unlockedAt'>> {
  const node = getCurrentNode(universe)
  const route = getRoute(universe)
  const entries: Array<Omit<CollectionRecord, 'id' | 'unlockedAt'>> = []
  for (const refId of node.achievementIds) {
    entries.push({ kind: 'achievement', refId, universeId: universe.id })
  }
  if (node.eventId && SPECIAL_IDS.has(node.eventId)) {
    entries.push({ kind: 'specialEvent', refId: node.eventId, universeId: universe.id })
  }
  if (route.status === 'ended' && route.endingId) {
    entries.push({ kind: 'ending', refId: route.endingId, universeId: universe.id })
  }
  return entries
}

export const useUniverseStore = create<UniverseState>((set, get) => ({
  universes: [],
  loaded: false,

  load: async () => {
    try {
      const universes = await universeRepository.list()
      set({ universes, loaded: true })
    } catch {
      set({ universes: [], loaded: true })
    }
  },

  createUniverse: async (input) => {
    let universe = engineCreate({
      id: crypto.randomUUID(),
      name: input.name.trim() || `宇宙 ${get().universes.length + 1}`,
      seed: input.seed ?? randomSeed(),
      archetypeId: input.archetypeId,
      createdAt: Date.now(),
    })
    const chapter = CHAPTERS.find((c) => c.id === (input.startChapter ?? 1))
    if (chapter && chapter.minAge > 0) {
      universe = autoAdvance(universe, chapter.minAge)
    }
    universe = { ...universe, mode: input.mode ?? 'manual' }
    await universeRepository.save(universe)
    set({ universes: [universe, ...get().universes] })
    return universe
  },

  choose: async (universeId, choiceId) => {
    const current = get().universes.find((u) => u.id === universeId)
    if (!current) return null
    const next = engineChoose(current, choiceId)
    await universeRepository.save(next)
    set({ universes: get().universes.map((u) => (u.id === next.id ? next : u)) })
    const delta = collectionDelta(next)
    if (delta.length > 0) {
      await collectionRepository.recordMissing(delta)
      await syncCollections()
    }
    return next
  },

  branch: async (universeId, nodeId, name) => {
    const current = get().universes.find((u) => u.id === universeId)
    if (!current) return null
    const next = engineBranch(current, nodeId, name)
    await universeRepository.save(next)
    set({ universes: get().universes.map((u) => (u.id === next.id ? next : u)) })
    return next
  },

  selectRoute: async (universeId, routeId) => {
    const current = get().universes.find((u) => u.id === universeId)
    if (!current) return null
    const next = engineSelectRoute(current, routeId)
    await universeRepository.save(next)
    set({ universes: get().universes.map((u) => (u.id === next.id ? next : u)) })
    return next
  },

  deriveUniverse: async (universeId, nodeId) => {
    const current = get().universes.find((u) => u.id === universeId)
    if (!current) return null
    const derived = engineDerive(current, nodeId, {
      id: crypto.randomUUID(),
      name: `派生 · ${current.name}`,
      createdAt: Date.now(),
    })
    await universeRepository.save(derived)
    set({ universes: [derived, ...get().universes] })
    return derived
  },

  toggleFavorite: async (universeId) => {
    const current = get().universes.find((u) => u.id === universeId)
    if (!current) return
    const next = { ...current, favorite: !current.favorite }
    await universeRepository.save(next)
    if (next.favorite) await collectionRepository.recordFavorite(universeId)
    else await collectionRepository.removeFavorites(universeId)
    set({ universes: get().universes.map((u) => (u.id === next.id ? next : u)) })
    await syncCollections()
  },

  // 导入只新增：同 ID 宇宙跳过，绝不覆盖现有数据
  importData: async (incoming, collections = []) => {
    const existing = new Set(get().universes.map((u) => u.id))
    const fresh = incoming.filter((u) => !existing.has(u.id))
    for (const universe of fresh) {
      await universeRepository.save(universe)
    }
    if (fresh.length > 0) {
      set({ universes: [...fresh, ...get().universes].sort((a, b) => b.createdAt - a.createdAt) })
      const freshIds = new Set(fresh.map((u) => u.id))
      await collectionRepository.recordMissing([
        ...fresh.flatMap((u) =>
          collectionsFromUniverse(u, Date.now()).map(({ id: _id, unlockedAt: _at, ...rest }) => rest),
        ),
        ...collections
          .filter((c) => freshIds.has(c.universeId))
          .map(({ id: _id, unlockedAt: _at, ...rest }) => rest),
      ])
      await syncCollections()
    }
    return { imported: fresh.length, skipped: incoming.length - fresh.length }
  },

  removeUniverse: async (id) => {
    await universeRepository.remove(id)
    set({ universes: get().universes.filter((u) => u.id !== id) })
    await syncCollections()
  },

  clearAll: async () => {
    await universeRepository.clear()
    set({ universes: [] })
    useCollectionStore.getState().sync([])
  },
}))