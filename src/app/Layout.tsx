import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Sparkles,
  Orbit,
  GitCompareArrows,
  BookOpen,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUniverseStore } from '@/stores/universeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCollectionStore } from '@/stores/collectionStore'

const NAV_ITEMS = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/create', label: '创建宇宙', icon: Sparkles },
  { to: '/multiverse', label: '平行宇宙', icon: Orbit },
  { to: '/comparison', label: '对照实验', icon: GitCompareArrows },
  { to: '/collection', label: '宇宙图鉴', icon: BookOpen },
  { to: '/settings', label: '系统设置', icon: Settings },
]

export function Layout() {
  const location = useLocation()
  const loadUniverses = useUniverseStore((s) => s.load)
  const loadSettings = useSettingsStore((s) => s.load)
  const loadCollections = useCollectionStore((s) => s.load)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const sound = useSettingsStore((s) => s.settings.sound)
  const updateSettings = useSettingsStore((s) => s.update)

  useEffect(() => {
    void loadUniverses()
    void loadSettings()
    void loadCollections()
  }, [loadUniverses, loadSettings, loadCollections])

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg md:flex">
        <div className="flex h-16 items-center border-b border-line px-6">
          <NavLink to="/" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Parallel Life</span>
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-silver">
              Lab
            </span>
          </NavLink>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-6">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors duration-200',
                  isActive
                    ? 'bg-dark text-bg'
                    : 'text-muted hover:bg-white hover:text-ink',
                )
              }
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-6 py-4">
          <p className="font-mono text-[10px] leading-relaxed text-silver">
            LOCAL ENGINE v0.1
            <br />
            NO AI · NO BACKEND
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-6 backdrop-blur-sm md:px-10">
          <nav className="flex gap-4 overflow-x-auto md:hidden">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 text-xs',
                    isActive ? 'font-medium text-ink' : 'text-muted',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <p className="hidden font-mono text-[11px] uppercase tracking-widest2 text-silver md:block">
            {location.pathname === '/' ? 'Observatory' : location.pathname.slice(1)}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-pressed={sound}
              aria-label={sound ? '关闭音效' : '开启音效'}
              title={sound ? '音效开（点击静音）' : '音效关（点击开启）'}
              onClick={() => void updateSettings({ sound: !sound })}
              className={cn(
                'rounded-md border p-1.5 transition-colors',
                sound
                  ? 'border-line bg-white text-ink hover:border-silver'
                  : 'border-transparent text-silver hover:text-ink',
              )}
            >
              {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <p className="font-mono text-[11px] text-silver">平行人生实验室</p>
          </div>
        </header>

        <motion.main
          key={reduceMotion ? undefined : location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 px-6 py-10 md:px-10 lg:px-14"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}