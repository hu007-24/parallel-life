import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, GitCompareArrows } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { RadarChart } from '@/components/charts/RadarChart'
import { DeltaBarChart } from '@/components/charts/DeltaBarChart'
import { useUniverseStore } from '@/stores/universeStore'
import { STAT_KEYS, STAT_LABELS, type Universe } from '@/types'
import { buildSide, compareSides, type SideReport } from '@/engine/ple'
import { LIFE_EVENTS } from '@/data/events'
import { cn } from '@/utils/cn'

interface SideRef {
  universeId: string
  routeId: string
}

function defaultSides(universes: Universe[]): { left: SideRef; right: SideRef } | null {
  const first = universes[0]
  if (!first) return null
  const firstRoutes = Object.values(first.routes)
  const left = { universeId: first.id, routeId: first.currentRouteId }
  const otherRoute = firstRoutes.find((r) => r.id !== first.currentRouteId)
  if (otherRoute) return { left, right: { universeId: first.id, routeId: otherRoute.id } }
  const second = universes[1]
  if (!second) return null
  return { left, right: { universeId: second.id, routeId: second.currentRouteId } }
}

function SidePicker({
  label,
  value,
  universes,
  onChange,
}: {
  label: string
  value: SideRef | null
  universes: Universe[]
  onChange: (next: SideRef) => void
}) {
  const universe = universes.find((u) => u.id === value?.universeId) ?? null
  const routes = universe ? Object.values(universe.routes) : []
  const selectClass =
    'h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none transition-colors focus:border-ink'
  return (
    <Card>
      <CardHeader>
        <span className="pl-label">{label}</span>
      </CardHeader>
      <CardBody className="space-y-2">
        <select
          aria-label={`${label} 宇宙`}
          className={selectClass}
          value={value?.universeId ?? ''}
          onChange={(e) => {
            const next = universes.find((u) => u.id === e.target.value)
            if (next) onChange({ universeId: next.id, routeId: next.currentRouteId })
          }}
        >
          {universes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} 路线`}
          className={selectClass}
          value={value?.routeId ?? ''}
          onChange={(e) => value && onChange({ ...value, routeId: e.target.value })}
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}（{r.nodeIds.length} 节点）
            </option>
          ))}
        </select>
      </CardBody>
    </Card>
  )
}

const SideSummary = memo(function SideSummary({ side, tag }: { side: SideReport; tag: string }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] tracking-widest2 text-silver">{tag}</p>
          <Badge tone={side.status === 'ended' ? 'dark' : 'outline'}>
            {side.status === 'ended' ? 'Ended' : 'Active'}
          </Badge>
        </div>
        <h3 className="mt-3 text-lg font-medium tracking-tight">{side.routeName}</h3>
        <p className="mt-1 text-xs text-muted">
          {side.universeName} · {side.identityName} · {side.age} 岁
        </p>
        <p className="mt-3 font-mono text-[11px] text-silver">SEED {side.seed}</p>
        <div className="mt-4 border-t border-line pt-3">
          {side.endingName ? (
            <p className="text-sm font-medium">
              {side.endingName}
              <span className="ml-2 font-mono text-[10px] text-silver">
                ENDING {String(side.endingNumber).padStart(2, '0')} / 08
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">人生仍在继续，结局未定。</p>
          )}
        </div>
      </CardBody>
    </Card>
  )
})

const EventList = memo(function EventList({
  title,
  events,
}: {
  title: string
  events: SideReport['events']
}) {
  return (
    <Card>
      <CardHeader>
        <span className="pl-label">{title}</span>
      </CardHeader>
      <CardBody className="space-y-2">
        {events.length === 0 && <p className="text-xs text-silver">无</p>}
        {events.map((event) => (
          <div key={`${event.id}-${event.age}`} className="flex items-baseline gap-2">
            <span className="w-12 shrink-0 font-mono text-[10px] text-silver">{event.age} 岁</span>
            <span className="text-sm">{event.title}</span>
            {event.tier === 'special' && <Badge tone="dark">特殊</Badge>}
          </div>
        ))}
      </CardBody>
    </Card>
  )
})

export function ComparisonPage() {
  const universes = useUniverseStore((s) => s.universes)
  const [left, setLeft] = useState<SideRef | null>(null)
  const [right, setRight] = useState<SideRef | null>(null)

  useEffect(() => {
    if (left && right) return
    const defaults = defaultSides(universes)
    if (defaults) {
      setLeft(defaults.left)
      setRight(defaults.right)
    }
  }, [universes, left, right])

  const report = useMemo(() => {
    if (!left || !right) return null
    const leftUniverse = universes.find((u) => u.id === left.universeId)
    const rightUniverse = universes.find((u) => u.id === right.universeId)
    if (!leftUniverse || !rightUniverse) return null
    if (!leftUniverse.routes[left.routeId] || !rightUniverse.routes[right.routeId]) return null
    return compareSides(
      buildSide(leftUniverse, left.routeId),
      buildSide(rightUniverse, right.routeId),
    )
  }, [universes, left, right])

  const totalRoutes = universes.reduce((sum, u) => sum + Object.keys(u.routes).length, 0)

  if (totalRoutes < 2) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Comparison"
          title="人生对照实验"
          description="选择两条人生路线，对照不同选择塑造出的不同命运。"
        />
        <EmptyState
          icon={<GitCompareArrows size={28} strokeWidth={1.25} />}
          title="至少需要两条路线"
          description="创建第二个宇宙，或在时间线中回溯创建分支路线，再回来观察它们的差异。"
          action={
            <Link to="/create">
              <Button>创建宇宙</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const maxAge = report ? Math.max(report.left.age, report.right.age) : 0
  const leftByAge = new Map(report?.left.path.map((entry) => [entry.age, entry]) ?? [])
  const rightByAge = new Map(report?.right.path.map((entry) => [entry.age, entry]) ?? [])
  const keyAges = report
    ? [...new Set([...report.left.keyChoices, ...report.right.keyChoices].map((c) => c.age))].sort(
        (a, b) => a - b,
      )
    : []
  const leftKeys = new Map(report?.left.keyChoices.map((c) => [c.age, c]) ?? [])
  const rightKeys = new Map(report?.right.keyChoices.map((c) => [c.age, c]) ?? [])

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Comparison"
        title="人生对照实验"
        description="同一套引擎、不同的选择——观察属性、经历与结局如何分岔。"
      />

      <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <SidePicker label="Route A" value={left} universes={universes} onChange={setLeft} />
        <div className="flex items-center justify-center">
          <Button
            variant="secondary"
            aria-label="交换左右路线"
            title="交换左右路线"
            onClick={() => {
              setLeft(right)
              setRight(left)
            }}
          >
            <ArrowLeftRight size={16} />
          </Button>
        </div>
        <SidePicker label="Route B" value={right} universes={universes} onChange={setRight} />
      </div>

      {report && (
        <>
          {report.sameRoute && (
            <p className="mt-3 text-xs text-muted">
              当前左右为同一条路线：差异为零。选择另一条路线或分支以观察分岔。
            </p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SideSummary side={report.left} tag="ROUTE A" />
            <SideSummary side={report.right} tag="ROUTE B" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <span className="pl-label">Attribute Radar</span>
              </CardHeader>
              <CardBody>
                <RadarChart
                  series={[
                    { name: `A · ${report.left.routeName}`, stats: report.left.stats },
                    { name: `B · ${report.right.routeName}`, stats: report.right.stats },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <span className="pl-label">Delta (A − B)</span>
              </CardHeader>
              <CardBody>
                <DeltaBarChart
                  delta={report.statDelta}
                  leftName={report.left.routeName}
                  rightName={report.right.routeName}
                />
                <p className="mt-2 text-center font-mono text-[10px] text-silver">
                  {report.divergenceAge !== null
                    ? `首次分岔于 ${report.divergenceAge} 岁`
                    : '两条路径完全一致'}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <span className="pl-label">Five Stats</span>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['属性', 'A', 'B', 'Δ (A−B)'].map((head) => (
                      <th
                        key={head}
                        className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-silver"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {STAT_KEYS.map((key) => {
                    const delta = report.statDelta[key]
                    return (
                      <tr key={key}>
                        <td className="px-6 py-3 text-muted">{STAT_LABELS[key]}</td>
                        <td className="px-6 py-3 font-mono tabular-nums">{report.left.stats[key]}</td>
                        <td className="px-6 py-3 font-mono tabular-nums">{report.right.stats[key]}</td>
                        <td
                          className={cn(
                            'px-6 py-3 font-mono tabular-nums',
                            delta !== 0 && 'font-medium',
                          )}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <span className="pl-label">Key Choices</span>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['年龄', 'A 的关键选择', 'B 的关键选择', ''].map((head, i) => (
                      <th
                        key={i}
                        className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-silver"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {keyAges.map((age) => {
                    const l = leftKeys.get(age)
                    const r = rightKeys.get(age)
                    const differs = (l?.label ?? null) !== (r?.label ?? null)
                    return (
                      <tr key={age} className={cn(differs && 'bg-bg')}>
                        <td className="px-6 py-3 font-mono text-xs text-silver">{age} 岁</td>
                        <td className="px-6 py-3">{l?.label ?? '—'}</td>
                        <td className="px-6 py-3">{r?.label ?? '—'}</td>
                        <td className="px-6 py-3">
                          {differs && <Badge tone="outline">分岔</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <EventList title="共同经历" events={report.sharedEvents} />
            <EventList title="仅 A 经历" events={report.leftOnlyEvents} />
            <EventList title="仅 B 经历" events={report.rightOnlyEvents} />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <span className="pl-label">Timeline Compare</span>
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line text-left">
                      {['年龄', 'A', 'B'].map((head) => (
                        <th
                          key={head}
                          className="px-6 py-3 font-mono text-[10px] uppercase tracking-wider text-silver"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {Array.from({ length: maxAge + 1 }, (_, age) => {
                      const l = leftByAge.get(age)
                      const r = rightByAge.get(age)
                      const lEvent = l?.eventId
                        ? LIFE_EVENTS.find((e) => e.id === l.eventId)
                        : null
                      const rEvent = r?.eventId
                        ? LIFE_EVENTS.find((e) => e.id === r.eventId)
                        : null
                      return (
                        <tr
                          key={age}
                          className={cn(
                            report.divergenceAge === age && 'border-l-2 border-l-ink bg-bg',
                          )}
                        >
                          <td className="px-6 py-2 font-mono text-xs text-silver">{age}</td>
                          <td className="px-6 py-2">
                            {l?.label ?? '—'}
                            {lEvent && (
                              <span className="ml-2 text-xs text-muted">· {lEvent.title}</span>
                            )}
                          </td>
                          <td className="px-6 py-2">
                            {r?.label ?? '—'}
                            {rEvent && (
                              <span className="ml-2 text-xs text-muted">· {rEvent.title}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}