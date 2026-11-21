import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Layout } from '@/app/Layout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// 首屏仅 Home 同步加载；其余路由全部懒加载，拆分初始 bundle
const CreatePage = lazy(() => import('@/pages/CreatePage').then((m) => ({ default: m.CreatePage })))
const SimulationPage = lazy(() =>
  import('@/pages/SimulationPage').then((m) => ({ default: m.SimulationPage })),
)
const TimelinePage = lazy(() =>
  import('@/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })),
)
const MultiversePage = lazy(() =>
  import('@/pages/MultiversePage').then((m) => ({ default: m.MultiversePage })),
)
const ComparisonPage = lazy(() =>
  import('@/pages/ComparisonPage').then((m) => ({ default: m.ComparisonPage })),
)
const EndingPage = lazy(() => import('@/pages/EndingPage').then((m) => ({ default: m.EndingPage })))
const CollectionPage = lazy(() =>
  import('@/pages/CollectionPage').then((m) => ({ default: m.CollectionPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function withSuspense(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-silver">
          <Loader2 size={20} className="animate-spin" />
        </div>
      }
    >
      {node}
    </Suspense>
  )
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'create', element: withSuspense(<CreatePage />) },
        { path: 'simulation/:universeId', element: withSuspense(<SimulationPage />) },
        { path: 'timeline/:universeId', element: withSuspense(<TimelinePage />) },
        { path: 'multiverse', element: withSuspense(<MultiversePage />) },
        { path: 'comparison', element: withSuspense(<ComparisonPage />) },
        { path: 'ending/:universeId', element: withSuspense(<EndingPage />) },
        { path: 'collection', element: withSuspense(<CollectionPage />) },
        { path: 'settings', element: withSuspense(<SettingsPage />) },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { future: { v7_relativeSplatPath: true } },
)