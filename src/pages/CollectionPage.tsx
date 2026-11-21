import { Link } from 'react-router-dom'
import { Lock, Orbit, Sparkles, Star, Zap } from 'lucide-react'
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { ENDINGS } from '@/data/endings'
import { ARCHETYPES } from '@/data/archetypes'
import { ACHIEVEMENTS } from '@/data/achievements'
import { LIFE_EVENTS } from '@/data/events'
import { useUniverseStore } from '@/stores/universeStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { getCurrentNode, getRoute } from '@/engine/ple'
import { cn } from '@/utils/cn'

const SPECIAL_EVENTS = LIFE_EVENTS.filter((e) => e.tier === 'special')

export function CollectionPage() {
  const universes = useUniverseStore((s) => s.universes)
  const toggleFavorite = useUniverseStore((s) => s.toggleFavorite)
  const records = useCollectionStore((s) => s.records)

  const unlocked = new Set(
    records.filter((r) => r.kind === 'ending').map((r) => r.refId),
  )
  const unlockedAchievements = new Set(
    records.filter((r) => r.kind === 'achievement').map((r) => r.refId),
  )
  const specialEncounters = new Map<string, number>()
  for (const record of records) {
    if (record.kind === 'specialEvent') {
      specialEncounters.set(record.refId, (specialEncounters.get(record.refId) ?? 0) + 1)
    }
  }
  const favorites = universes.filter((u) => u.favorite === true)
  const usedArchetypes = new Set(universes.map((u) => u.archetypeId))

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Collection"
        title="宇宙图鉴"
        description={`已探索 ${universes.length} 个宇宙 · 解锁 ${unlocked.size}/${ENDINGS.length} 结局 · ${unlockedAchievements.size}/${ACHIEVEMENTS.length} 成就 · ${specialEncounters.size}/${SPECIAL_EVENTS.length} 特殊事件。`}
      />

      <p className="pl-label mb-3">Explored Universes</p>
      {universes.length === 0 ? (
        <EmptyState
          icon={<Orbit size={28} strokeWidth={1.25} />}
          title="还没有探索记录"
          description="创建第一个宇宙，图鉴会记录你抵达的每一种人生。"
          action={
            <Link to="/create">
              <Button>创建宇宙</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {universes.map((universe) => {
            const node = getCurrentNode(universe)
            const route = getRoute(universe)
            return (
              <Link key={universe.id} to={`/simulation/${universe.id}`}>
                <Card className="h-full transition-shadow duration-300 hover:shadow-card">
                  <CardBody>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[15px] font-medium tracking-tight">
                        {universe.name}
                      </h3>
                      {universe.favorite && <Star size={14} className="shrink-0 text-ink" fill="currentColor" />}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-silver">
                      {node.age} 岁 · {Object.keys(universe.routes).length} 路线 · SEED {universe.seed}
                    </p>
                    <Badge tone={route.status === 'ended' ? 'dark' : 'outline'}>
                      {route.status === 'ended' ? 'Ended' : 'Active'}
                    </Badge>
                  </CardBody>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <p className="pl-label mb-3 mt-12">Endings</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENDINGS.map((ending, index) => {
          const isUnlocked = unlocked.has(ending.id)
          return (
            <Card
              key={ending.id}
              className={cn('transition-shadow duration-300', isUnlocked && 'hover:shadow-card')}
            >
              <CardBody>
                <div className="flex items-center justify-between">
                  {isUnlocked ? (
                    <Sparkles size={16} strokeWidth={1.5} className="text-ink" />
                  ) : (
                    <Lock size={16} strokeWidth={1.5} className="text-silver" />
                  )}
                  <span className="font-mono text-[10px] text-silver">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3
                  className={cn(
                    'mt-4 text-[15px] font-medium tracking-tight',
                    !isUnlocked && 'text-silver',
                  )}
                >
                  {ending.name}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {isUnlocked ? ending.description : '尚未有宇宙抵达这个结局。'}
                </p>
                <p className="mt-3 font-mono text-[10px] text-silver">{ending.conditionText}</p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="pl-label mb-3 mt-12">Hidden Achievements</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((achievement) => {
          const isUnlocked = unlockedAchievements.has(achievement.id)
          return (
            <Card key={achievement.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  {isUnlocked ? (
                    <Sparkles size={16} strokeWidth={1.5} className="text-ink" />
                  ) : (
                    <Lock size={16} strokeWidth={1.5} className="text-silver" />
                  )}
                  <Badge tone={isUnlocked ? 'dark' : 'silver'}>
                    {isUnlocked ? 'Unlocked' : 'Hidden'}
                  </Badge>
                </div>
                <h3
                  className={cn(
                    'mt-4 text-[15px] font-medium tracking-tight',
                    !isUnlocked && 'text-silver',
                  )}
                >
                  {isUnlocked ? achievement.title : '？？？'}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {isUnlocked
                    ? achievement.description
                    : '隐藏成就：在某条人生路径上达成特定组合后解锁。'}
                </p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="pl-label mb-3 mt-12">Special Events</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SPECIAL_EVENTS.map((event) => {
          const count = specialEncounters.get(event.id) ?? 0
          const encountered = count > 0
          return (
            <Card key={event.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <Zap
                    size={15}
                    strokeWidth={1.5}
                    className={encountered ? 'text-ink' : 'text-silver'}
                  />
                  <Badge tone={encountered ? 'dark' : 'silver'}>
                    {encountered ? `${count} 宇宙` : '未遭遇'}
                  </Badge>
                </div>
                <h3
                  className={cn(
                    'mt-3 text-sm font-medium tracking-tight',
                    !encountered && 'text-silver',
                  )}
                >
                  {encountered ? event.title : '？？？'}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {encountered ? event.description : '在特定条件与路径下才会发生。'}
                </p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <p className="pl-label mb-3 mt-12">Favorites</p>
      {favorites.length === 0 ? (
        <p className="text-sm text-muted">
          还没有收藏。在平行宇宙管理页点击星标，把重要的人生实验留在这里。
        </p>
      ) : (
        <div className="space-y-2">
          {favorites.map((universe) => (
            <Card key={universe.id}>
              <CardBody className="flex flex-wrap items-center gap-3">
                <Star size={15} className="text-ink" fill="currentColor" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{universe.name}</p>
                  <p className="font-mono text-[11px] text-silver">
                    {getCurrentNode(universe).age} 岁 · SEED {universe.seed}
                  </p>
                </div>
                <Link to={`/simulation/${universe.id}`}>
                  <Button variant="secondary" size="sm">
                    进入
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void toggleFavorite(universe.id)}
                >
                  取消收藏
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="pl-label mb-3 mt-12">Archetypes</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ARCHETYPES.map((archetype) => {
          const used = usedArchetypes.has(archetype.id)
          return (
            <Card key={archetype.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-medium tracking-tight">{archetype.name}</h3>
                  <Badge tone={used ? 'outline' : 'silver'}>{used ? '已运行' : '未运行'}</Badge>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-silver">
                  {archetype.tagline}
                </p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <Link to="/create">
          <Button variant="secondary">创建宇宙，解锁更多记录</Button>
        </Link>
      </div>
    </div>
  )
}