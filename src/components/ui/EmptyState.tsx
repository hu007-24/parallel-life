import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-8 py-20 text-center">
      {icon && <div className="mb-4 text-silver">{icon}</div>}
      <h3 className="text-base font-medium tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}