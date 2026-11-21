import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Cpu, GitBranch, Library } from 'lucide-react'
import { Button, Card, CardBody } from '@/components/ui'
import { useUniverseStore } from '@/stores/universeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTweenedNumber } from '@/hooks/useTweenedNumber'
import { autoAdvance, branch, createUniverse, getRoute, getRoutePath } from '@/engine/ple'
import { CHAPTERS } from '@/data/chapters'
import { ARCHETYPES } from '@/data/archetypes'
import { STORY_NODES } from '@/data/stories'
import { ENDINGS } from '@/data/endings'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

function HeroCounter({ label, value, animate }: { label: string; value: number; animate: boolean }) {
  const display = useTweenedNumber(value, 900, animate)
  return (
    <div>
      <p className="font-mono text-3xl font-light tabular-nums">{Math.round(display)}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest2 text-silver">{label}</p>
    </div>
  )
}

/** 主视觉：用真实引擎跑一条演示宇宙并分岔，把两条人生路径画成线图（非装饰性静态图） */
function useDemoBranches() {
  return useMemo(() => {
    const base = autoAdvance(
      createUniverse({ id: 'demo', name: 'demo', seed: 7, archetypeId: 'campus' }),
      18,
    )
    const origin = getRoute(base).nodeIds[8] as string
    const branched = autoAdvance(branch(base, origin, 'demo-branch'), 18)
    return [getRoutePath(branched, 'r_root'), getRoutePath(branched)]
  }, [])
}

function BranchVisual({ paths, animate }: { paths: ReturnType<typeof useDemoBranches>; animate: boolean }) {
  const point = (age: number, lane: number) => ({ x: 20 + age * 15, y: 52 + lane * 74 })
  const toPolyline = (path: (typeof paths)[number], lane: number) =>
    path.map((node) => {
      const { x, y } = point(node.age, lane)
      return `${x},${y}`
    }).join(' ')
  const root = paths[0] ?? []
  const fork = paths[1] ?? []
  const forkStart = fork.findIndex((node) => node.age === 8)
  const endRoot = point(root[root.length - 1]?.age ?? 18, 0)
  const endFork = point(fork[fork.length - 1]?.age ?? 18, 1)
  return (
    <svg viewBox="0 0 310 178" className="w-full" role="img" aria-label="演示宇宙的两条分支人生路径">
      {/* 年龄坐标刻度 */}
      <line x1="20" y1="160" x2="290" y2="160" stroke="#3A3F45" strokeWidth="1" />
      {[0, 6, 12, 18].map((age) => (
        <g key={age}>
          <line x1={20 + age * 15} y1="156" x2={20 + age * 15} y2="160" stroke="#777777" strokeWidth="1" />
          <text x={20 + age * 15} y="170" fill="#777777" fontSize="6" fontFamily="monospace" textAnchor="middle">
            {age}
          </text>
        </g>
      ))}
      <motion.polyline
        points={toPolyline(root, 0)}
        fill="none"
        stroke="#BFC3C7"
        strokeWidth="1.2"
        pathLength={1}
        strokeDasharray={1}
        initial={animate ? { strokeDashoffset: 1 } : false}
        animate={animate ? { strokeDashoffset: 0 } : undefined}
        transition={animate ? { duration: 1.4, ease: EASE } : undefined}
      />
      <motion.polyline
        points={toPolyline(fork.slice(Math.max(forkStart, 0)), 1)}
        fill="none"
        stroke="#F5F5F3"
        strokeWidth="1.2"
        pathLength={1}
        strokeDasharray={1}
        initial={animate ? { strokeDashoffset: 1 } : false}
        animate={animate ? { strokeDashoffset: 0 } : undefined}
        transition={animate ? { duration: 1.4, ease: EASE } : undefined}
      />
      {root.map((node) => {
        const { x, y } = point(node.age, 0)
        return <circle key={node.id} cx={x} cy={y} r="1.6" fill="#777777" />
      })}
      {fork.slice(Math.max(forkStart, 0)).map((node) => {
        const { x, y } = point(node.age, 1)
        return <circle key={node.id} cx={x} cy={y} r="1.6" fill="#BFC3C7" />
      })}
      <circle cx={endRoot.x} cy={endRoot.y} r="3.2" fill="#BFC3C7" />
      <circle cx={endFork.x} cy={endFork.y} r="3.2" fill="#F5F5F3" />
      <text x="20" y="30" fill="#777777" fontSize="7" fontFamily="monospace" letterSpacing="2">
        ROUTE A
      </text>
      <text x="20" y="104" fill="#BFC3C7" fontSize="7" fontFamily="monospace" letterSpacing="2">
        ROUTE B · FORK AT AGE 8
      </text>
    </svg>
  )
}

export function HomePage() {
  const universes = useUniverseStore((s) => s.universes)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const paths = useDemoBranches()
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 46])

  const activeCount = universes.filter((u) => getRoute(u).status === 'active').length
  const endedCount = universes.length - activeCount

  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.55, delay, ease: EASE },
        }

  return (
    <div className="mx-auto max-w-6xl">
      <section ref={heroRef} className="pl-register relative overflow-hidden rounded-lg bg-dark text-bg">
        <div className="pl-hairline-metal h-px w-full opacity-60" />
        <div className="grid gap-10 px-8 py-12 md:grid-cols-2 md:px-12 md:py-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tracking-widest2 text-silver">PARALLEL LIFE</span>
              <span className="h-px flex-1 bg-white/15" />
              <span className="font-mono text-[10px] text-silver">平行人生实验室</span>
            </div>
            <p className="mt-3 font-mono text-[10px] tracking-wider text-silver/70">
              PL-0001 · LOCAL ENGINE · DETERMINISTIC SEED SPACE
            </p>
            <h1 className="mt-10 text-4xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              每一个选择，
              <br />
              都分裂出一个
              <span className="text-silver">平行宇宙</span>。
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-silver">
              在本地确定性引擎中运行另一种人生：五维状态、五章剧情、不可变分支。
              观察、回溯、对照——如果当初做了另一个选择，现在的你会在哪里？
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/create">
                <Button size="lg" className="border-bg bg-bg text-dark hover:opacity-85">
                  开启人生实验
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/multiverse">
                <Button
                  size="lg"
                  variant="ghost"
                  className="border-white/20 text-bg hover:bg-white/10 hover:text-bg"
                >
                  查看平行宇宙
                </Button>
              </Link>
            </div>
          </div>
          <motion.div style={{ y: visualY }} className="self-center">
            <BranchVisual paths={paths} animate={!reduceMotion} />
            <p className="mt-4 font-mono text-[10px] tracking-wider text-silver">
              LIVE SAMPLE · SEED 7 · 由 PLE 引擎实时计算的两条分支路径
            </p>
          </motion.div>
        </div>
        <div className="grid grid-cols-2 gap-6 border-t border-white/10 px-8 py-6 md:grid-cols-4 md:px-12">
          {[
            { label: '已探索宇宙', value: universes.length },
            { label: '运行中', value: activeCount },
            { label: '已抵达结局', value: endedCount },
            { label: '可解锁结局', value: ENDINGS.length },
          ].map((stat) => (
            <HeroCounter key={stat.label} label={stat.label} value={stat.value} animate={!reduceMotion} />
          ))}
        </div>
      </section>

      <motion.section {...reveal()} className="py-16">
        <p className="pl-label">Capabilities</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Cpu,
              title: '确定性本地引擎',
              description: '无大模型、无后端。同一种子与决策路径，必然复现同一段人生。',
            },
            {
              icon: GitBranch,
              title: '不可变分支时间线',
              description: '历史节点永不修改。回溯任意一年，派生一条独立的新人生。',
            },
            {
              icon: Library,
              title: '人工设计剧情库',
              description: `${STORY_NODES.length} 个主线节点、25 个事件、12 个隐藏成就，全部由本地数据与组合规则驱动。`,
            },
          ].map(({ icon: Icon, title, description }, index) => (
            <motion.div
              key={title}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
            >
              <Card className="h-full transition-shadow duration-300 hover:shadow-card">
                <CardBody>
                  <Icon size={18} strokeWidth={1.5} className="text-muted" />
                  <h3 className="mt-4 text-[15px] font-medium tracking-tight">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section {...reveal()} className="border-t border-line py-14">
        <p className="pl-label">Five Chapters</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CHAPTERS.map((chapter) => (
            <div key={chapter.id} className="rounded-md border border-line bg-white px-4 py-4">
              <p className="font-mono text-[10px] tracking-widest2 text-silver">
                CHAPTER 0{chapter.id}
              </p>
              <p className="mt-2 text-[15px] font-medium tracking-tight">{chapter.title}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {chapter.minAge}–{chapter.maxAge} 岁
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section {...reveal()} className="border-t border-line py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="pl-label">Identities</p>
            <p className="mt-2 text-sm text-muted">四种初始身份，四种命运分布与初始剧情。</p>
          </div>
          <Link to="/collection">
            <Button variant="ghost" size="sm">
              浏览宇宙图鉴
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ARCHETYPES.map((identity) => (
            <Card key={identity.id}>
              <CardBody>
                <p className="font-mono text-[10px] uppercase tracking-wider text-silver">
                  {identity.tagline}
                </p>
                <h3 className="mt-2 text-[15px] font-medium tracking-tight">{identity.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{identity.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.section {...reveal()} className="pb-16">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-dark px-8 py-8 text-bg md:px-12">
          <div>
            <p className="font-mono text-[10px] tracking-widest2 text-silver">START NOW</p>
            <p className="mt-2 text-xl font-medium tracking-tight">
              你的人生实验，从第一个选择开始。
            </p>
          </div>
          <Link to="/create">
            <Button size="lg" className="border-bg bg-bg text-dark hover:opacity-85">
              开启人生实验
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-center font-mono text-[10px] tracking-wider text-silver">
          100% LOCAL ENGINE — 无大模型 API · 无 AI 服务 · 无后端生成内容
        </p>
      </motion.section>
    </div>
  )
}