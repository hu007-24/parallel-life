import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p className="pl-label">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}