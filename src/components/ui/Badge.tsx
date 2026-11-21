import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'neutral' | 'dark' | 'outline' | 'silver'

const TONES: Record<Tone, string> = {
  neutral: 'bg-bg text-muted border-line',
  dark: 'bg-dark text-bg border-dark',
  outline: 'bg-transparent text-ink border-line',
  silver: 'bg-silver/20 text-muted border-silver/40',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
        'font-mono text-[10px] uppercase tracking-wider',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}