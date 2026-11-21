import type { AppSettings, Universe } from '@/types'
import { db } from '@/database/db'
import {
  assembleUniverse,
  collectionsFromUniverse,
  DEFAULT_SETTINGS,
  splitUniverse,
  type CollectionRecord,
} from '@/database/mapping'

/**
 * Repository 层：页面与 store 只经此访问 IndexedDB。
 * 宇宙聚合 = universes 元数据行 + nodes 规范化行；保存为单事务，杜绝半写状态。
 */
export const universeRepository = {
  async list(): Promise<Universe[]> {
    const metas = await db.universes.orderBy('createdAt').reverse().toArray()
    const rows = await db.nodes.toArray()
    const byUniverse = new Map<string, typeof rows>()
    for (const row of rows) {
      const bucket = byUniverse.get(row.universeId)
      if (bucket) bucket.push(row)
      else byUniverse.set(row.universeId, [row])
    }
    return metas.map((meta) => assembleUniverse(meta, byUniverse.get(meta.id) ?? []))
  },

  async get(id: string): Promise<Universe | null> {
    const meta = await db.universes.get(id)
    if (!meta) return null
    const rows = await db.nodes.where('universeId').equals(id).toArray()
    return assembleUniverse(meta, rows)
  },

  async save(universe: Universe): Promise<void> {
    const { meta, rows } = splitUniverse(universe)
    await db.transaction('rw', db.universes, db.nodes, async () => {
      await db.universes.put(meta)
      // 节点不可变：已存在的行永不变化，只插入新增节点，避免整表重写
      const existing = new Set(
        await db.nodes.where('universeId').equals(universe.id).primaryKeys(),
      )
      const fresh = rows.filter((row) => !existing.has(row.key))
      if (fresh.length > 0) await db.nodes.bulkPut(fresh)
    })
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.universes, db.nodes, db.collections, async () => {
      await db.universes.delete(id)
      await db.nodes.where('universeId').equals(id).delete()
      await db.collections.where('universeId').equals(id).and((r) => r.kind === 'favorite').delete()
    })
  },

  async clear(): Promise<void> {
    await db.transaction('rw', db.universes, db.nodes, db.collections, async () => {
      await db.universes.clear()
      await db.nodes.clear()
      await db.collections.clear()
    })
  },
}

export const collectionRepository = {
  list(): Promise<CollectionRecord[]> {
    return db.collections.toArray()
  },

  /** 只写入尚不存在的记录：保留最早解锁时间，不覆盖既有图鉴 */
  async recordMissing(
    entries: Array<Omit<CollectionRecord, 'id' | 'unlockedAt'>>,
  ): Promise<void> {
    if (entries.length === 0) return
    const withKeys = entries.map((entry) => ({
      ...entry,
      id: `${entry.kind}:${entry.refId}:${entry.universeId}`,
      unlockedAt: Date.now(),
    }))
    const existing = new Set(
      await db.collections.where('id').anyOf(withKeys.map((r) => r.id)).primaryKeys(),
    )
    const fresh = withKeys.filter((r) => !existing.has(r.id))
    if (fresh.length > 0) await db.collections.bulkPut(fresh)
  },

  async rebuild(universes: Universe[]): Promise<void> {
    const records = universes.flatMap((u) => collectionsFromUniverse(u, Date.now()))
    await db.transaction('rw', db.collections, async () => {
      await db.collections.clear()
      await db.collections.bulkPut(records)
    })
  },

  async removeFavorites(universeId: string): Promise<void> {
    await db.collections
      .where('universeId')
      .equals(universeId)
      .and((r) => r.kind === 'favorite')
      .delete()
  },

  async recordFavorite(universeId: string): Promise<void> {
    await db.collections.put({
      id: `favorite:${universeId}:${universeId}`,
      kind: 'favorite',
      refId: universeId,
      universeId,
      unlockedAt: Date.now(),
    })
  },
}

export const settingsRepository = {
  async load(): Promise<AppSettings> {
    const record = await db.settings.get('app')
    const stored = (record?.value ?? {}) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...stored }
  },

  async save(settings: AppSettings): Promise<void> {
    await db.settings.put({ key: 'app', value: settings })
  },
}