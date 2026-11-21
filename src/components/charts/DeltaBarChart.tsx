import { memo } from 'react'
import { motion } from 'framer-motion'
import { STAT_KEYS, STAT_LABELS, type StatKey } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/utils/cn'

interface DeltaBarChartProps {
  delta: Record<StatKey, number>
  leftName: string
  rightName: string
  height?: number
}

/**
 * 仪器式双向 Δ 条：零轴居中，正向深墨向右、负向银灰向左，直接标注数值。
 * 纯 CSS/motion 实现（无 canvas 实例），与雷达图共用同一套灰阶语言。
 */
export const DeltaBarChart = memo(function DeltaBarChart({
  delta,
  leftName,
  rightName,
}: DeltaBarChartProps) {
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  return (
    <div className="w-full">
      <div className="space-y-3">
        {STAT_KEYS.map((key) => {
          const value = delta[key]
          const magnitude = Math.min(100, Math.abs(value)) / 2
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-xs text-muted">{STAT_LABELS[key]}</span>
              <div
                className="relative h-2 flex-1 overflow-hidden rounded-full bg-line"
                role="img"
                aria-label={`${STAT_LABELS[key]} 差值 ${value}`}
              >
                <span className="absolute left-1/2 top-0 h-full w-px bg-muted" aria-hidden />
                <motion.span
                  className={cn(
                    'absolute top-0 h-full rounded-full',
                    value >= 0 ? 'left-1/2 bg-dark' : 'right-1/2 bg-silver',
                  )}
                  initial={false}
                  animate={{ width: `${magnitude}%` }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                {value > 0 ? '+' : ''}
                {value}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[9px] text-silver">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
      <p className="mt-2 text-center font-mono text-[10px] text-silver">
        Δ = {leftName} − {rightName}
      </p>
    </div>
  )
})