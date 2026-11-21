import { Link } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl py-16">
      <EmptyState
        title="404 · 这条时间线不存在"
        description="你访问的坐标不在任何已知宇宙中。"
        action={
          <Link to="/">
            <Button variant="secondary">返回观测站</Button>
          </Link>
        }
      />
    </div>
  )
}