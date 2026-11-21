import Dexie, { type Table } from 'dexie'
import type { Universe } from '@/types'
import {
  collectionsFromUniverse,
  splitUniverse,
  type CollectionRecord,
  type NodeRow,
  type UniverseMeta,
} from '@/database/mapping'

export interface SettingRecord {
  key: string
  value: unknown
}

class ParallelLifeDatabase extends Dexie {
  universes!: Table<UniverseMeta, string>
  nodes!: Table<NodeRow, string>
  collections!: Table<CollectionRecord, string>
  settings!: Table<SettingRecord, string>

  constructor() {
    super('parallel-life')
    this.version(1).stores({
      universes: 'id, name, createdAt, status',
      settings: 'key',
    })
    // v2：PLE 重构后 Universe 结构不兼容（节点树 + 路线），清除旧格式记录
    this.version(2)
      .stores({
        universes: 'id, name, createdAt',
        settings: 'key',
      })
      .upgrade((tx) => tx.table('universes').clear())
    // v3：节点携带剧情进度快照与成就集合、身份库重建，旧记录不兼容
    this.version(3)
      .stores({
        universes: 'id, name, createdAt',
        settings: 'key',
      })
      .upgrade((tx) => tx.table('universes').clear())
    // v4：Repository 模式四表——universes 元数据 / nodes 规范化 / collections 图鉴 / settings
    this.version(4)
      .stores({
        universes: 'id, name, createdAt',
        nodes: 'key, universeId, nodeId, parentId',
        collections: 'id, kind, refId, universeId',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const old = (await tx.table('universes').toArray()) as Universe[]
        const metas: UniverseMeta[] = []
        const rows: NodeRow[] = []
        const collections: CollectionRecord[] = []
        for (const universe of old) {
          const { meta, rows: nodeRows } = splitUniverse(universe)
          metas.push(meta)
          rows.push(...nodeRows)
          collections.push(...collectionsFromUniverse(universe, universe.createdAt))
        }
        await tx.table('universes').clear()
        await tx.table('universes').bulkPut(metas)
        await tx.table('nodes').bulkPut(rows)
        await tx.table('collections').bulkPut(collections)
      })
  }
}

export const db = new ParallelLifeDatabase()