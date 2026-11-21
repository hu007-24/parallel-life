import { memo, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Flag, GitBranch, Loader2, Pause, Play } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { useUniverse } from '@/hooks/useUniverse'
import { useTweenedNumber } from '@/hooks/useTweenedNumber'
import { useUniverseStore } from '@/stores/universeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getArchetype } from '@/data/archetypes'
import { LIFE_EVENTS } from '@/data/events'
import { NARRATIVES } from '@/data/narratives'
import { ACHIEVEMENTS } from '@/data/achievements'
import { ENDINGS } from '@/data/endings'
import { STAT_KEYS, STAT_LABELS, type StatKey } from '@/types'
import {
  MAX_AGE,
  activeStory,
  autoChoiceId,
  chapterForAge,
  getCurrentNode,
  getEndingDef,
  getRoute,
  getRoutePath,
  nodeContext,
} from '@/engine/ple'
import { cn } from '@/utils/cn'
import { playCue } from '@/utils/sound'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const StatRow = memo(function StatRow({
  statKey,
  value,
  prev,
  reduceMotion,
}: {
  statKey: StatKey
  value: number
  prev: number
  reduceMotion: boolean
}) {
  const display = useTweenedNumber(value, 600, !reduceMotion)
  const delta = value - prev
  const ratio = Math.max(0, Math.min(1, display / 100))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-muted">{STAT_LABELS[statKey]}</span>
        <span className="flex items-baseline gap-2">
          <AnimatePresence mode="popLayout">
            {delta !== 0 && (
              <motion.span
                key={`${statKey}-${value}`}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'font-mono text-[10px] tabular-nums',
                  delta > 0 ? 'text-ink' : 'text-silver',
                )}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="font-mono text-xs tabular-nums text-ink">{Math.round(display)}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={STAT_LABELS[statKey]}
        className="pl-ticks h-[3px] w-full overflow-hidden rounded-full bg-line"
      >
        <motion.div
          className="h-full rounded-full bg-dark"
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>
    </div>
  )
})

export function SimulationPage() {
  const { universeId } = useParams()
  const { universe, loaded } = useUniverse(universeId)
  const choose = useUniverseStore((s) => s.choose)
  const selectRoute = useUniverseStore((s) => s.selectRoute)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const sound = useSettingsStore((s) => s.settings.sound)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [autoPlaying, setAutoPlaying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const prevAchievementCount = useRef(0)

  const nodeId = universe ? getCurrentNode(universe).id : null
  useEffect(() => setSelected(null), [nodeId])

  const achievementCount = universe ? getCurrentNode(universe).seenAchievementIds.length : 0
  useEffect(() => {
    if (achievementCount > prevAchievementCount.current) playCue('achievement', sound)
    prevAchievementCount.current = achievementCount
  }, [achievementCount, sound])

  const route = universe ? getRoute(universe) : null
  const node = universe ? getCurrentNode(universe) : null
  const active = universe && node ? activeStory(node.story, nodeContext(node)) : null
  const milestone = active && node && active.minAge === node.age ? active : null
  const ended = route?.status === 'ended'
  const autoMode = universe?.mode === 'auto'

  // 自动推演：普通年份按种子推进；主线剧情年暂停交由用户抉择
  useEffect(() => {
    if (!universe || !node || !autoMode || !autoPlaying || ended || busy || milestone) return
    const timer = setTimeout(() => {
      void choose(universe.id, autoChoiceId(universe)).catch(() => setAutoPlaying(false))
    }, 900)
    return () => clearTimeout(timer)
  }, [universe, node, autoMode, autoPlaying, ended, busy, milestone, choose])

  useEffect(() => {
    if (milestone && autoPlaying) setAutoPlaying(false)
  }, [milestone, autoPlaying])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24 text-silver">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!universe || !route || !node) {
    return (
      <EmptyState
        title="未找到这个宇宙"
        description="它可能已被删除，或链接有误。"
        action={
          <Link to="/multiverse">
            <Button variant="secondary">返回平行宇宙</Button>
          </Link>
        }
      />
    )
  }

  const archetype = getArchetype(universe.archetypeId)
  const chapter = chapterForAge(node.age)
  const parent = node.parentId ? universe.nodes[node.parentId] : null
  const log = getRoutePath(universe).slice(1).reverse().slice(0, 14)
  const routes = Object.values(universe.routes)
  const ending = route.endingId ? getEndingDef(ENDINGS, route.endingId) : null

  async function handleConfirm() {
    if (!universe || !selected || busy) return
    setBusy(true)
    setActionError(null)
    playCue('confirm', sound)
    try {
      await choose(universe.id, selected)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '推进失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.32, ease: EASE },
      }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={`Simulation · Seed ${universe.seed}`}
        title={universe.name}
        description={`${archetype.name} · 路线「${route.name}」· ${autoMode ? '自动推演模式' : '手动步进模式'}`}
        actions={
          <>
            {routes.length > 1 && (
              <select
                aria-label="切换路线"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs outline-none focus:border-ink"
                value={route.id}
                onChange={(e) => void selectRoute(universe.id, e.target.value)}
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            <Link to={`/timeline/${universe.id}`}>
              <Button variant="secondary" size="sm">
                <GitBranch size={14} />
                时间线
              </Button>
            </Link>
            {ended && (
              <Link to={`/ending/${universe.id}`}>
                <Button variant="secondary" size="sm">
                  <Flag size={14} />
                  查看结局
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        {/* 左栏：五维人生属性 + 变化动画 */}
        <Card className="order-2 md:order-1">
          <CardHeader className="flex items-center justify-between">
            <span className="pl-label">Life State</span>
            <Badge tone={ended ? 'dark' : 'outline'}>{ended ? 'Ended' : 'Active'}</Badge>
          </CardHeader>
          <CardBody>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-5xl font-light tabular-nums">{node.age}</span>
              <span className="text-sm text-muted">岁 / {MAX_AGE}</span>
              <span className="ml-auto font-mono text-[9px] tracking-wider text-silver">
                5D / 0–100
              </span>
            </div>
            <div className="mt-8 space-y-5">
              {STAT_KEYS.map((key) => (
                <StatRow
                  key={key}
                  statKey={key}
                  value={node.stats[key]}
                  prev={parent?.stats[key] ?? node.stats[key]}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 中栏：当前剧情 / 背景 / 选项 / 确认 */}
        <Card className="order-1 md:order-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <span className="pl-label">Current Story</span>
            {chapter && (
              <Badge tone="silver">
                CHAPTER 0{chapter.id} · {chapter.title}
              </Badge>
            )}
          </CardHeader>
          <CardBody>
            {/* 年龄刻度尺：仪器式进度指示，标记随推进平滑移动 */}
            <div className="mb-6" aria-hidden>
              <div className="pl-ticks relative h-3 opacity-60">
                <motion.div
                  className="absolute top-0 h-3 w-px bg-ink"
                  initial={false}
                  animate={{ left: `${(node.age / MAX_AGE) * 100}%` }}
                  transition={{ duration: 0.5, ease: EASE }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-silver">
                <span>0</span>
                <span>20</span>
                <span>40</span>
                <span>60</span>
                <span>80</span>
              </div>
            </div>
            {autoMode && !ended && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-line bg-bg px-3 py-2">
                <span className="text-xs text-muted">
                  {autoPlaying
                    ? '引擎按种子自动推进中…'
                    : milestone
                      ? '主线剧情年：请亲自抉择'
                      : '自动推演已暂停'}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAutoPlaying((playing) => !playing)}
                >
                  {autoPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {autoPlaying ? '暂停' : '开始推演'}
                </Button>
              </div>
            )}
            <motion.div key={node.id} {...motionProps}>
                {ended ? (
                  <div className="py-6 text-center">
                    <p className="font-mono text-xs tracking-widest2 text-silver">FINAL</p>
                    <h3 className="mt-3 text-2xl font-medium tracking-tight">
                      {ending?.name ?? '人生已闭合'}
                    </h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
                      {ending?.description}
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                      <Link to={`/ending/${universe.id}`}>
                        <Button>
                          <Flag size={15} />
                          查看完整结局
                        </Button>
                      </Link>
                      <Link to={`/timeline/${universe.id}`}>
                        <Button variant="secondary">回看时间线</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-xs text-silver">
                      AGE {node.age} · {milestone ? '主线剧情' : '自由行动年'}
                    </p>
                    <h3 className="mt-2 text-xl font-medium tracking-tight">
                      {milestone ? milestone.title : '这一年，由你安排'}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {milestone
                        ? milestone.description
                        : '没有主线剧情推进。选择一个行动塑造五维状态，机遇与低谷会在途中上门。'}
                    </p>
                    <motion.div
                      key={node.id}
                      className="mt-6 space-y-2"
                      role="radiogroup"
                      aria-label="本年度可选行动"
                      {...(reduceMotion
                        ? {}
                        : {
                            initial: 'hidden',
                            animate: 'show',
                            variants: { show: { transition: { staggerChildren: 0.05 } } },
                          })}
                    >
                      {node.options.map((option) => (
                        <motion.div
                          key={option.id}
                          {...(reduceMotion
                            ? {}
                            : {
                                variants: {
                                  hidden: { opacity: 0, y: 8 },
                                  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
                                },
                              })}
                        >
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected === option.id}
                          data-testid="choice-option"
                          onClick={() => {
                            setSelected(option.id)
                            setActionError(null)
                            playCue('select', sound)
                          }}
                          className={cn(
                            'w-full rounded-md border bg-white px-4 py-3 text-left transition-all duration-200',
                            selected === option.id
                              ? 'border-ink shadow-card'
                              : 'border-line hover:border-silver',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{option.label}</span>
                            {selected === option.id && <Check size={14} className="text-ink" />}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted">
                            {option.description}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {STAT_KEYS.filter((key) => option.effects[key] !== undefined).map(
                              (key) => {
                                const delta = option.effects[key] ?? 0
                                return (
                                  <Badge key={key} tone={delta >= 0 ? 'outline' : 'silver'}>
                                    {STAT_LABELS[key]} {delta > 0 ? '+' : ''}
                                    {delta}
                                  </Badge>
                                )
                              },
                            )}
                          </div>
                        </button>
                        </motion.div>
                      ))}
                    </motion.div>
                    <Button
                      className="mt-5 w-full"
                      size="lg"
                      disabled={!selected || busy}
                      data-testid="confirm-choice"
                      onClick={() => void handleConfirm()}
                    >
                      {busy ? '命运计算中…' : `确认选择 · 推进到 ${node.age + 1} 岁`}
                    </Button>
                    {actionError && (
                      <p className="mt-2 text-xs text-ink" role="alert">
                        {actionError}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
          </CardBody>
        </Card>

        {/* 右栏：事件记录 / 当前阶段 / 宇宙编号 */}
        <Card className="order-3 md:col-span-2 lg:col-span-1">
          <CardHeader>
            <span className="pl-label">Record</span>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="break-all font-mono text-[10px] leading-relaxed text-silver">
              UNIVERSE {universe.id}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="outline">SEED {universe.seed}</Badge>
              <Badge tone="silver">{route.name}</Badge>
              {chapter && <Badge tone="dark">{chapter.title}</Badge>}
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {log.length === 0 && (
                <p className="text-xs text-silver">还没有记录。做出第一个选择。</p>
              )}
              {log.map((entry) => {
                const event = entry.eventId
                  ? LIFE_EVENTS.find((e) => e.id === entry.eventId)
                  : null
                const narratives = NARRATIVES.filter((n) => entry.narrativeIds.includes(n.id))
                const achievements = ACHIEVEMENTS.filter((a) =>
                  entry.achievementIds.includes(a.id),
                )
                return (
                  <div key={entry.id} className="border-l border-line pl-3">
                    <p className="font-mono text-[10px] text-silver">AGE {entry.age}</p>
                    <p className="mt-0.5 text-sm font-medium">{entry.choiceLabel}</p>
                    {event && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        <span className="text-ink">{event.title}</span> — {event.description}
                      </p>
                    )}
                    {narratives.map((narrative) => (
                      <p key={narrative.id} className="mt-1 text-xs leading-relaxed text-muted">
                        <span className="text-ink">{narrative.title}</span> — {narrative.text}
                      </p>
                    ))}
                    {achievements.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {achievements.map((achievement) => (
                          <Badge key={achievement.id} tone="dark">
                            成就 · {achievement.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}