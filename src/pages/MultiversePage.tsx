import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, GitBranch, Orbit, Play, Plus, Star, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardBody, EmptyState, Modal, PageHeader } from '@/components/ui'
import { useUniverseStore } from '@/stores/universeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getArchetype } from '@/data/archetypes'
import { ENDINGS } from '@/data/endings'
import { CHAPTERS } from '@/data/chapters'
import { formatDate } from '@/utils/format'
import { getCurrentNode, getEndingDef, getRoute } from '@/engine/ple'
import type { Universe } from '@/types'
import { cn } from '@/utils/cn'

type Filter = 'all' | 'active' | 'ended' | 'favorite'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'active', label: '运行中' },
  { id: 'ended', label: '已结束' },
  { id: 'favorite', label: '收藏' },
]

export function MultiversePage() {
  const universes = useUniverseStore((s) => s.universes)
  const removeUniverse = useUniverseStore((s) => s.removeUniverse)
  const toggleFavorite = useUniverseStore((s) => s.toggleFavorite)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const [pendingDelete, setPendingDelete] = useState<Universe | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const sorted = [...universes].sort(
    (a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false) || b.createdAt - a.createdAt,
  )
  const visible = sorted.filter((universe) => {
    const ended = getRoute(universe).status === 'ended'
    if (filter === 'active') return !ended
    if (filter === 'ended') return ended
    if (filter === 'favorite') return universe.favorite === true
    return true
  })

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await removeUniverse(pendingDelete.id)
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败，请重试')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Multiverse"
        title="平行宇宙管理"
        description="所有时间线都保存在浏览器本地数据库（IndexedDB）中，可随时进入、对照、收藏或删除。"
        actions={
          <Link to="/create">
            <Button size="sm">
              <Plus size={14} />
              新建宇宙
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={cn(
              'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
              filter === item.id
                ? 'border-ink bg-dark text-bg'
                : 'border-line bg-white text-muted hover:border-silver',
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-silver">
          {visible.length} / {universes.length} 个宇宙
        </span>
      </div>

      {universes.length === 0 ? (
        <EmptyState
          icon={<Orbit size={28} strokeWidth={1.25} />}
          title="还没有任何宇宙"
          description="创建第一条人生时间线，开始你的平行人生实验。"
          action={
            <Link to="/create">
              <Button>创建宇宙</Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="该筛选下没有宇宙"
          description="切换筛选条件，或创建一个新的宇宙。"
          action={
            <Button variant="secondary" onClick={() => setFilter('all')}>
              查看全部
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((universe, index) => {
            const archetype = getArchetype(universe.archetypeId)
            const route = getRoute(universe)
            const current = getCurrentNode(universe)
            const ended = route.status === 'ended'
            const ending = route.endingId ? getEndingDef(ENDINGS, route.endingId) : null
            const chapter = CHAPTERS.find(
              (c) => current.age >= c.minAge && current.age <= c.maxAge,
            )
            return (
              <motion.div
                key={universe.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
              <Card className="transition-shadow duration-300 hover:shadow-card">
                <CardBody className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    aria-label={universe.favorite ? `取消收藏 ${universe.name}` : `收藏 ${universe.name}`}
                    aria-pressed={universe.favorite === true}
                    onClick={() => void toggleFavorite(universe.id)}
                    className={cn(
                      'rounded-md p-1.5 transition-colors',
                      universe.favorite ? 'text-ink' : 'text-silver hover:text-ink',
                    )}
                  >
                    <Star size={16} fill={universe.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[15px] font-medium tracking-tight">
                        {universe.name}
                      </h3>
                      <Badge tone={ended ? 'dark' : 'outline'}>{ended ? 'Ended' : 'Active'}</Badge>
                      {universe.mode === 'auto' && <Badge tone="silver">自动推演</Badge>}
                      {ending && <Badge tone="outline">{ending.name}</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-silver">
                      {archetype.name} · {current.age} 岁 · {chapter?.title ?? '—'} ·{' '}
                      {Object.keys(universe.routes).length} 条路线 · SEED {universe.seed} ·{' '}
                      {formatDate(universe.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/simulation/${universe.id}`}>
                      <Button variant="secondary" size="sm">
                        <Play size={14} />
                        {ended ? '查看人生' : '继续模拟'}
                      </Button>
                    </Link>
                    <Link to={`/timeline/${universe.id}`}>
                      <Button variant="ghost" size="sm">
                        <GitBranch size={14} />
                        查看
                      </Button>
                    </Link>
                    {ended ? (
                      <Link to={`/ending/${universe.id}`}>
                        <Button variant="ghost" size="sm">
                          <Flag size={14} />
                          结局
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" disabled title="尚未抵达结局">
                        <Flag size={14} />
                        结局
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`删除 ${universe.name}`}
                      onClick={() => setPendingDelete(universe)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardBody>
              </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="删除宇宙"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={() => void confirmDelete()}>
              确认删除
            </Button>
          </>
        }
      >
        即将删除「{pendingDelete?.name}」及其全部{' '}
        {pendingDelete ? Object.keys(pendingDelete.nodes).length : 0} 个时间线节点。此操作不可撤销。
        {deleteError && (
          <span className="mt-2 block text-ink" role="alert">
            {deleteError}
          </span>
        )}
      </Modal>
    </div>
  )
}