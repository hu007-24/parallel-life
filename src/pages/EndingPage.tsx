import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Flag, Loader2, Play, RotateCcw, Sparkles } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Progress } from '@/components/ui'
import { RadarChart } from '@/components/charts/RadarChart'
import { useUniverse } from '@/hooks/useUniverse'
import { useSettingsStore } from '@/stores/settingsStore'
import { getCurrentNode, getRoute, getRoutePath, getEndingDef, parseStoryChoice } from '@/engine/ple'
import { ENDINGS } from '@/data/endings'
import { STORY_NODES } from '@/data/stories'
import { LIFE_EVENTS } from '@/data/events'
import { ACHIEVEMENTS } from '@/data/achievements'
import { getArchetype } from '@/data/archetypes'
import { STAT_KEYS, STAT_LABELS, type EventDef } from '@/types'
import { formatDate } from '@/utils/format'
import { playCue } from '@/utils/sound'
import { drawCard, exportCardPng, type CardData } from '@/utils/memorial-card'

export function EndingPage() {
  const { universeId } = useParams()
  const { universe, loaded } = useUniverse(universeId)
  const sound = useSettingsStore((s) => s.settings.sound)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevEndedRef = useRef(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const route = universe ? getRoute(universe) : null
  const node = universe ? getCurrentNode(universe) : null
  const ended = route?.status === 'ended' && route.endingId !== null

  useEffect(() => {
    if (ended && !prevEndedRef.current) playCue('ending', sound)
    prevEndedRef.current = ended
  }, [ended, sound])

  const ending = universe && route?.endingId ? getEndingDef(ENDINGS, route.endingId) : null
  const endingNumber = ending ? ENDINGS.findIndex((e) => e.id === ending.id) + 1 : 0

  const experiences = useMemo(() => {
    if (!universe || !route) return { milestones: [], specialEvents: [] as EventDef[] }
    const path = getRoutePath(universe, route.id)
    const milestones = path
      .filter((entry) => entry.choiceId?.startsWith('st:'))
      .map((entry) => {
        const parsed = parseStoryChoice(entry.choiceId as string)
        const story = STORY_NODES.find((s) => s.id === parsed?.storyId)
        return { age: entry.age, title: story?.title ?? '主线', label: entry.choiceLabel ?? '' }
      })
    const specialEvents = path
      .map((entry) => (entry.eventId ? LIFE_EVENTS.find((e) => e.id === entry.eventId) : null))
      .filter((e): e is EventDef => e != null && e.tier === 'special')
    return { milestones, specialEvents }
  }, [universe, route])

  const cardData = useMemo<CardData | null>(() => {
    if (!universe || !node || !ending) return null
    const identity = getArchetype(universe.archetypeId)
    const summaryText =
      `${identity.name}的平行人生：${node.age} 岁抵达「${ending.name}」。` +
      `${experiences.milestones.length} 次主线抉择、${experiences.specialEvents.length} 次特殊事件、` +
      `${node.seenAchievementIds.length} 项隐藏成就。${ending.description}`
    return {
      universeId: universe.id,
      universeName: universe.name.length > 12 ? `${universe.name.slice(0, 12)}…` : universe.name,
      endingTitle: ending.name,
      endingNumber,
      summaryText,
      stats: node.stats,
      createdDate: formatDate(universe.createdAt),
      seed: universe.seed,
      identityName: identity.name,
      age: node.age,
    }
  }, [universe, node, ending, endingNumber, experiences])

  useEffect(() => {
    if (!cardData) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled && canvasRef.current) drawCard(canvasRef.current, cardData, 2)
    })
    return () => {
      cancelled = true
    }
  }, [cardData])

  async function handleExport() {
    if (!cardData || exporting) return
    setExporting(true)
    setExportError(null)
    try {
      await document.fonts.ready
      const blob = await exportCardPng(cardData, 3)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `parallel-life-${cardData.universeId.slice(0, 8)}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

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

  if (!ended || !ending) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Ending" title="人生仍在继续" />
        <EmptyState
          icon={<Play size={24} strokeWidth={1.25} />}
          title={`这条时间线目前 ${node.age} 岁`}
          description="结局尚未写就。回到模拟页面，继续做出选择。"
          action={
            <Link to={`/simulation/${universe.id}`}>
              <Button>继续模拟</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const achievements = ACHIEVEMENTS.filter((a) => node.seenAchievementIds.includes(a.id))
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Ending"
        title={universe.name}
        description={`${getArchetype(universe.archetypeId).name} · 路线「${route.name}」· 享年 ${node.age} 岁 · ${route.nodeIds.length} 个节点`}
      />

      <motion.div {...motionProps}>
        <div className="rounded-lg bg-dark px-8 py-12 text-center text-bg md:px-14">
          <Flag size={20} strokeWidth={1.5} className="mx-auto text-silver" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest2 text-silver">
            Ending {String(endingNumber).padStart(2, '0')} / {String(ENDINGS.length).padStart(2, '0')}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{ending.name}</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-silver">
            {ending.description}
          </p>
          <p className="mt-6 font-mono text-[11px] text-silver/70">达成条件：{ending.conditionText}</p>
        </div>
      </motion.div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="pl-label">Final Stats</span>
          </CardHeader>
          <CardBody className="space-y-4">
            {STAT_KEYS.map((key) => (
              <Progress key={key} label={STAT_LABELS[key]} value={node.stats[key]} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <span className="pl-label">Life Shape</span>
          </CardHeader>
          <CardBody>
            <RadarChart series={[{ name: route.name, stats: node.stats }]} height={280} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <span className="pl-label">Key Experiences</span>
        </CardHeader>
        <CardBody className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs text-muted">主线抉择（{experiences.milestones.length}）</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {experiences.milestones.map((milestone) => (
                <div key={`${milestone.age}-${milestone.title}`} className="flex items-baseline gap-3">
                  <span className="w-12 shrink-0 font-mono text-[10px] text-silver">
                    {milestone.age} 岁
                  </span>
                  <span className="text-sm">
                    {milestone.title}
                    <span className="ml-2 text-xs text-muted">→ {milestone.label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs text-muted">特殊事件（{experiences.specialEvents.length}）</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {experiences.specialEvents.length === 0 && (
                <p className="text-xs text-silver">这一生没有遭遇特殊事件——平静也是一种形状。</p>
              )}
              {experiences.specialEvents.map((event) => (
                <div key={event.id} className="flex items-baseline gap-2">
                  <Badge tone="dark">特殊</Badge>
                  <span className="text-sm">{event.title}</span>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <span className="pl-label">Achievements</span>
        </CardHeader>
        <CardBody>
          {achievements.length === 0 ? (
            <p className="text-xs text-silver">尚未解锁隐藏成就。换一条路径，再试一次。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement) => (
                <div key={achievement.id} className="rounded-md border border-line bg-bg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-ink" />
                    <p className="text-sm font-medium">{achievement.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{achievement.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <span className="pl-label">Memorial Card</span>
          <Button variant="secondary" size="sm" disabled={exporting} onClick={() => void handleExport()}>
            <Download size={14} />
            {exporting ? '生成中…' : '导出高清 PNG'}
          </Button>
        </CardHeader>
        <CardBody className="flex flex-col items-center gap-4 md:flex-row md:items-start">
          <canvas
            ref={canvasRef}
            aria-label="人生纪念卡预览"
            className="w-full max-w-[320px] rounded-md border border-line shadow-card"
          />
          <div className="text-xs leading-relaxed text-muted">
            <p>黑白银纪念卡：品牌标识、宇宙编号、结局标题、人生摘要、五维属性与创建日期。</p>
            <p className="mt-2">导出为 3000 × 4200 高清 PNG，中文字体由系统字体栈渲染，版式经布局校验不变量保证不错位。</p>
            {exportError && <p className="mt-2 text-ink">{exportError}</p>}
          </div>
        </CardBody>
      </Card>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/create">
          <Button size="lg">
            <RotateCcw size={16} />
            重新探索
          </Button>
        </Link>
        <Link to={`/timeline/${universe.id}`}>
          <Button variant="secondary" size="lg">
            回顾完整时间线
          </Button>
        </Link>
        <Link to="/comparison">
          <Button variant="ghost" size="lg">
            对照另一段人生
          </Button>
        </Link>
      </div>
    </div>
  )
}