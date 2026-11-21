import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Compass, FastForward, Hand } from 'lucide-react'
import { Button, Card, CardBody, Modal, PageHeader, Progress } from '@/components/ui'
import { ARCHETYPES } from '@/data/archetypes'
import { CHAPTERS } from '@/data/chapters'
import { STAT_KEYS, STAT_LABELS, type SimulationMode } from '@/types'
import { useUniverseStore } from '@/stores/universeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/utils/cn'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const MODES: { id: SimulationMode; name: string; description: string; icon: typeof Hand }[] = [
  {
    id: 'manual',
    name: '手动步进',
    description: '逐年选择行动，确认后推进，含属性变化与转场动效。',
    icon: Hand,
  },
  {
    id: 'auto',
    name: '自动推演',
    description: '引擎按种子自动推进普通年份；主线剧情年暂停，等你亲自抉择。',
    icon: FastForward,
  },
]

export function CreatePage() {
  const navigate = useNavigate()
  const createUniverse = useUniverseStore((s) => s.createUniverse)
  const [name, setName] = useState('')
  const [seedText, setSeedText] = useState('')
  const [archetypeId, setArchetypeId] = useState(ARCHETYPES[0]?.id ?? 'campus')
  const [startChapter, setStartChapter] = useState(1)
  const [mode, setMode] = useState<SimulationMode>('manual')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [launching, setLaunching] = useState<{ name: string; seed: number; identity: string } | null>(null)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const launchTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (launchTimer.current !== null) window.clearTimeout(launchTimer.current)
  }, [])

  const selected = ARCHETYPES.find((a) => a.id === archetypeId) ?? ARCHETYPES[0]
  const chapter = CHAPTERS.find((c) => c.id === startChapter) ?? CHAPTERS[0]
  const parsedSeed = seedText.trim() === '' ? undefined : Number(seedText)
  const seed = parsedSeed !== undefined && Number.isFinite(parsedSeed) ? parsedSeed : undefined

  function openConfirm(e: FormEvent) {
    e.preventDefault()
    setConfirmOpen(true)
  }

  async function confirmCreate() {
    if (submitting) return
    setSubmitting(true)
    setCreateError(null)
    try {
      const universe = await createUniverse({
        name,
        archetypeId,
        seed,
        startChapter,
        mode,
      })
      setConfirmOpen(false)
      if (reduceMotion) {
        navigate(`/simulation/${universe.id}`)
      } else {
        setLaunching({
          name: universe.name,
          seed: universe.seed,
          identity: selected?.name ?? '',
        })
        launchTimer.current = window.setTimeout(() => {
          navigate(`/simulation/${universe.id}`)
        }, 850)
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const motionProps = (index: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: index * 0.07, ease: EASE },
        }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Genesis"
        title="创建宇宙"
        description="设定身份、起始阶段与模拟模式。种子决定命运的全部分支——相同种子将复现完全相同的人生。"
      />

      <form onSubmit={openConfirm} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <motion.section {...motionProps(0)}>
            <p className="pl-label mb-3">01 · 人生身份</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ARCHETYPES.map((identity) => (
                <button
                  key={identity.id}
                  type="button"
                  onClick={() => setArchetypeId(identity.id)}
                  aria-pressed={identity.id === archetypeId}
                  className={cn(
                    'rounded-lg border bg-white p-5 text-left transition-all duration-200',
                    identity.id === archetypeId
                      ? 'border-ink shadow-card'
                      : 'border-line hover:border-silver',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-medium tracking-tight">{identity.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-silver">
                      {identity.tagline}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {identity.description}
                  </p>
                </button>
              ))}
            </div>
            {selected && (
              <div className="mt-4 grid gap-4 rounded-md border border-line bg-white px-5 py-4 sm:grid-cols-2">
                {STAT_KEYS.map((key) => (
                  <Progress key={key} label={STAT_LABELS[key]} value={selected.baseStats[key]} />
                ))}
              </div>
            )}
          </motion.section>

          <motion.section {...motionProps(1)}>
            <p className="pl-label mb-3">02 · 起始阶段</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {CHAPTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStartChapter(item.id)}
                  aria-pressed={item.id === startChapter}
                  className={cn(
                    'rounded-md border bg-white px-4 py-3 text-left transition-all duration-200',
                    item.id === startChapter
                      ? 'border-ink shadow-card'
                      : 'border-line hover:border-silver',
                  )}
                >
                  <p className="font-mono text-[10px] tracking-widest2 text-silver">
                    CHAPTER 0{item.id}
                  </p>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted">{item.minAge} 岁起</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {chapter && chapter.minAge > 0
                ? `从 ${chapter.minAge} 岁开始：此前的 ${chapter.minAge} 年由引擎按种子自动模拟，全部为真实节点，可在时间线中回看与回溯。`
                : '从 0 岁开始，完整经历五章人生。'}
            </p>
          </motion.section>

          <motion.section {...motionProps(2)}>
            <p className="pl-label mb-3">03 · 模拟模式</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODES.map(({ id, name: modeName, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  aria-pressed={id === mode}
                  className={cn(
                    'rounded-lg border bg-white p-5 text-left transition-all duration-200',
                    id === mode ? 'border-ink shadow-card' : 'border-line hover:border-silver',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} strokeWidth={1.5} className="text-muted" />
                    <span className="text-[15px] font-medium tracking-tight">{modeName}</span>
                    {id === mode && <Check size={14} className="ml-auto text-ink" />}
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>
                </button>
              ))}
            </div>
          </motion.section>

          <motion.section {...motionProps(3)} className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="universe-name" className="pl-label">
                04 · 宇宙名称
              </label>
              <input
                id="universe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：如果当年学了物理"
                maxLength={40}
                className="mt-2 h-11 w-full rounded-md border border-line bg-bg px-4 text-sm outline-none transition-colors placeholder:text-silver focus:border-ink"
              />
            </div>
            <div>
              <label htmlFor="universe-seed" className="pl-label">
                05 · 命运种子（可选）
              </label>
              <input
                id="universe-seed"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder="留空随机；输入数字可复现特定人生"
                inputMode="numeric"
                className="mt-2 h-11 w-full rounded-md border border-line bg-bg px-4 font-mono text-sm outline-none transition-colors placeholder:font-sans placeholder:text-silver focus:border-ink"
              />
            </div>
          </motion.section>
        </div>

        <motion.aside {...motionProps(4)} className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <p className="pl-label">创建预览</p>
              <dl className="space-y-2 text-sm">
                {[
                  ['身份', selected?.name ?? '—'],
                  ['起始阶段', chapter ? `CHAPTER 0${chapter.id} · ${chapter.title}` : '—'],
                  ['模拟模式', MODES.find((m) => m.id === mode)?.name ?? '—'],
                  ['种子', seed !== undefined ? String(seed) : '随机'],
                  ['名称', name.trim() || '（自动命名）'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-start gap-2 rounded-md border border-line bg-bg px-3 py-2 text-xs leading-relaxed text-muted">
                <Compass size={14} className="mt-0.5 shrink-0" />
                创建前会再次确认全部设定；创建成功后自动进入人生模拟。
              </div>
              <Button type="submit" className="w-full" size="lg">
                生成创建确认
                <ArrowRight size={16} />
              </Button>
            </CardBody>
          </Card>
        </motion.aside>
      </form>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="创建确认"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              返回修改
            </Button>
            <Button size="sm" disabled={submitting} onClick={() => void confirmCreate()}>
              {submitting ? '正在初始化…' : '确认并启动'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p>
            即将创建宇宙「{name.trim() || '（自动命名）'}」：
            {selected?.name} · CHAPTER 0{chapter?.id} {chapter?.title}（{chapter?.minAge} 岁起）·
            {MODES.find((m) => m.id === mode)?.name} · 种子 {seed !== undefined ? seed : '随机'}。
          </p>
          {chapter && chapter.minAge > 0 && (
            <p className="text-xs text-silver">
              0–{chapter.minAge - 1} 岁将由引擎按种子自动模拟为真实历史节点，可随时回溯。
            </p>
          )}
          {createError && (
            <p className="text-xs text-ink" role="alert">
              {createError}
            </p>
          )}
        </div>
      </Modal>

      {launching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark px-6 text-bg"
          role="status"
          aria-label="宇宙初始化中"
        >
          <div className="w-full max-w-sm">
            <p className="font-mono text-[10px] tracking-widest2 text-silver">
              IGNITION · SEED {launching.seed}
            </p>
            <p className="mt-4 text-2xl font-medium tracking-tight">{launching.name}</p>
            <p className="mt-2 font-mono text-xs text-silver">
              {launching.identity} · 时间线展开中
            </p>
            <div className="mt-8 h-px w-full overflow-hidden bg-white/15">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="pl-hairline-metal h-full origin-left"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}