import { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { clamp } from '@/utils/format'

interface ProgressProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
}

export const Progress = memo(function Progress({
  value,
  max = 100,
  label,
  showValue = true,
  className,
}: ProgressProps) {
  const ratio = clamp(value / max, 0, 1)
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between">
          {label && <span className="text-xs text-muted">{label}</span>}
          {showValue && (
            <span className="font-mono text-xs tabular-nums text-ink">{Math.round(value)}</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-[3px] w-full overflow-hidden rounded-full bg-line"
      >
        <motion.div
          className="h-full rounded-full bg-dark"
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
})