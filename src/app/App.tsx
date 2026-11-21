import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { ErrorBoundary } from '@/app/ErrorBoundary'

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ErrorBoundary>
  )
}