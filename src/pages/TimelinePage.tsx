import { memo, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { motion } from 'framer-motion'
import { GitBranch, Loader2, Play, Sparkles, Split } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Progress } from '@/components/ui'
import { useUniverse } from '@/hooks/useUniverse'
import { useUniverseStore } from '@/stores/universeStore'
import { LIFE_EVENTS } from '@/data/events'
import { NARRATIVES } from '@/data/narratives'
import { ACHIEVEMENTS } from '@/data/achievements'
import { STAT_KEYS, STAT_LABELS } from '@/types'
import { getCurrentNode, getRoute } from '@/engine/ple'
import { cn } from '@/utils/cn'
import { playCue } from '@/utils/sound'
import { useSettingsStore } from '@/stores/settingsStore'

/** 分支灰阶色板：当前路线最深，其余路线按序取色，配合图例区分 */
const ROUTE_COLORS = ['#111111', '#6B7075', '#BFC3C7', '#3A3F45', '#8C9196', '#565B60']

interface LifeNodeData extends Record<string, unknown> {
  age: number
  title: string
  subtitle: string
  color: string
  isCurrent: boolean
  isSelected: boolean
  reduceMotion: boolean
}

const LifeNodeCard = memo(function LifeNodeCard({ data }: NodeProps<Node<LifeNodeData>>) {
  return (
    <div
      className={cn(
        'w-40 rounded-md border bg-white px-3 py-2 shadow-subtle transition-all duration-200 hover:border-silver hover:shadow-card',
        data.isCurrent
          ? 'border-ink ring-2 ring-ink/15'
          : data.isSelected
            ? 'border-ink ring-1 ring-ink/10'
            : 'border-line',
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-silver" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: data.color }} />
        <span className="font-mono text-[10px] text-silver">AGE {data.age}</span>
        {data.isCurrent &&
          (data.reduceMotion ? (
            <span className="ml-auto font-mono text-[9px] tracking-wider text-ink">NOW</span>
          ) : (
            <motion.span
              className="ml-auto font-mono text-[9px] tracking-wider text-ink"
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              NOW
            </motion.span>
          ))}
      </div>
      <p className="mt-1 truncate text-xs font-medium">{data.title}</p>
      {data.subtitle && <p className="truncate text-[10px] text-muted">{data.subtitle}</p>}
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-silver" />
    </div>
  )
})

const nodeTypes = { life: LifeNodeCard }

function AutoFit({ signature }: { signature: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60)
    return () => clearTimeout(timer)
  }, [signature, fitView])
  return null
}

export function TimelinePage() {
  const { universeId } = useParams()
  const navigate = useNavigate()
  const { universe, loaded } = useUniverse(universeId)
  const branch = useUniverseStore((s) => s.branch)
  const deriveUniverse = useUniverseStore((s) => s.deriveUniverse)
  const selectRoute = useUniverseStore((s) => s.selectRoute)
  const sound = useSettingsStore((s) => s.settings.sound)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)

  const route = universe ? getRoute(universe) : null
  const current = universe ? getCurrentNode(universe) : null

  const orderedRoutes = useMemo(() => {
    if (!universe || !route) return []
    return [route, ...Object.values(universe.routes).filter((r) => r.id !== route.id)]
  }, [universe, route])

  const { nodes, edges } = useMemo(() => {
    if (!universe || !route) return { nodes: [] as Node<LifeNodeData>[], edges: [] as Edge[] }
    const laneOf = (nodeId: string): number => {
      const index = orderedRoutes.findIndex((r) => r.nodeIds.includes(nodeId))
      return index <= 0 ? 0 : index
    }
    const nodes: Node<LifeNodeData>[] = Object.values(universe.nodes).map((entry) => {
      const lane = laneOf(entry.id)
      const event = entry.eventId ? LIFE_EVENTS.find((e) => e.id === entry.eventId) : null
      return {
        id: entry.id,
        type: 'life',
        position: { x: lane * 300, y: entry.age * 84 },
        data: {
          age: entry.age,
          title: entry.choiceLabel ?? '宇宙诞生',
          subtitle: event?.title ?? '',
          color: ROUTE_COLORS[lane % ROUTE_COLORS.length] as string,
          isCurrent: entry.id === route.currentNodeId,
          isSelected: entry.id === selectedId,
          reduceMotion,
        },
        draggable: false,
        selectable: false,
      }
    })
    const edges: Edge[] = Object.values(universe.nodes)
      .filter((entry) => entry.parentId && universe.nodes[entry.parentId])
      .map((entry) => {
        const lane = laneOf(entry.id)
        return {
          id: `e-${entry.parentId}-${entry.id}`,
          source: entry.parentId as string,
          target: entry.id,
          type: 'smoothstep',
          animated: !reduceMotion && entry.id === route.currentNodeId && lane === 0,
          style: {
            stroke: ROUTE_COLORS[lane % ROUTE_COLORS.length] as string,
            strokeWidth: lane === 0 ? 1.6 : 1.1,
          },
        }
      })
    return { nodes, edges }
  }, [universe, route, orderedRoutes, selectedId, reduceMotion])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24 text-silver">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!universe || !route || !current) {
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

  const selected = selectedId ? universe.nodes[selectedId] : null
  const selectedRoutes = selected
    ? Object.values(universe.routes).filter((r) => r.nodeIds.includes(selected.id))
    : []
  const selectedEvent = selected?.eventId
    ? LIFE_EVENTS.find((e) => e.id === selected.eventId)
    : null
  const selectedNarratives = selected
    ? NARRATIVES.filter((n) => selected.narrativeIds.includes(n.id))
    : []
  const selectedAchievements = selected
    ? ACHIEVEMENTS.filter((a) => selected.achievementIds.includes(a.id))
    : []

  async function handleBranch() {
    if (!universe || !selected || busy) return
    setBusy(true)
    setPanelError(null)
    try {
      await branch(universe.id, selected.id, `分支 ${Object.keys(universe.routes).length}`)
      playCue('branch', sound)
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '分支创建失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleDerive() {
    if (!universe || !selected || busy) return
    setBusy(true)
    setPanelError(null)
    try {
      const derived = await deriveUniverse(universe.id, selected.id)
      if (derived) navigate(`/simulation/${derived.id}`)
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : '派生失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Timeline"
        title={`${universe.name} · 时间线`}
        description={`全部 ${Object.keys(universe.nodes).length} 个节点 · ${orderedRoutes.length} 条路线 · 点击节点查看详情与回溯。`}
        actions={
          <Link to={`/simulation/${universe.id}`}>
            <Button variant="secondary" size="sm">
              <Play size={14} />
              回到模拟
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[420px] overflow-hidden rounded-lg border border-line bg-white md:h-[560px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.6}
            nodesConnectable={false}
          >
            <AutoFit
              signature={`${universe.id}:${Object.keys(universe.nodes).length}:${route.id}`}
            />
            <Background color="#DDDDDA" gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(245, 245, 243, 0.65)"
              nodeColor={(node) => (node.data as LifeNodeData).color ?? '#BFC3C7'}
              className="!border !border-line !bg-white hidden md:block"
            />
          </ReactFlow>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <span className="pl-label">Routes</span>
            </CardHeader>
            <CardBody className="space-y-2">
              {orderedRoutes.map((r, index) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void selectRoute(universe.id, r.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                    r.id === route.id
                      ? 'border-ink bg-white'
                      : 'border-line bg-white hover:border-silver',
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
                  />
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-silver">
                    {r.nodeIds.length} 节点
                  </span>
                  {r.id === route.id && <Badge tone="dark">当前</Badge>}
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <span className="pl-label">Node Detail</span>
            </CardHeader>
            <CardBody>
              {!selected ? (
                <p className="text-xs leading-relaxed text-muted">
                  点击画布中的任意节点：查看该年的选择、事件与属性快照，并从该年回溯创建分支路线，或派生一个独立的新宇宙。
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[10px] text-silver">AGE {selected.age}</p>
                    <h3 className="mt-1 text-[15px] font-medium tracking-tight">
                      {selected.choiceLabel ?? '宇宙诞生'}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedRoutes.map((r) => (
                        <Badge key={r.id} tone="silver">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {selectedEvent && (
                    <p className="text-xs leading-relaxed text-muted">
                      <span className="font-medium text-ink">{selectedEvent.title}</span>
                      {' — '}
                      {selectedEvent.description}
                    </p>
                  )}
                  {selectedNarratives.map((narrative) => (
                    <p key={narrative.id} className="text-xs leading-relaxed text-muted">
                      <span className="font-medium text-ink">{narrative.title}</span>
                      {' — '}
                      {narrative.text}
                    </p>
                  ))}
                  {selectedAchievements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAchievements.map((achievement) => (
                        <Badge key={achievement.id} tone="dark">
                          成就 · {achievement.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3">
                    {STAT_KEYS.map((key) => (
                      <Progress
                        key={key}
                        label={STAT_LABELS[key]}
                        value={selected.stats[key]}
                      />
                    ))}
                  </div>
                  <div className="space-y-2 border-t border-line pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => void handleBranch()}
                    >
                      <Split size={14} />
                      在此年创建分支路线
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={busy}
                      onClick={() => void handleDerive()}
                    >
                      <Sparkles size={14} />
                      回溯派生新宇宙
                    </Button>
                    <p className="text-[11px] leading-relaxed text-silver">
                      分支路线共享不可变历史；派生宇宙以相同种子复现此前缀后独立推进。
                    </p>
                    {panelError && (
                      <p className="text-xs text-ink" role="alert">
                        {panelError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">
              <GitBranch size={12} />
              {Object.keys(universe.nodes).length} 节点
            </Badge>
            <Badge tone={route.status === 'ended' ? 'dark' : 'silver'}>
              {route.status === 'ended' ? '时间线已闭合' : '时间线延伸中'}
            </Badge>
            <Badge tone="silver">当前 {current.age} 岁</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}