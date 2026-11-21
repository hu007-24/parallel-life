import { useEffect } from 'react'
import { useUniverseStore } from '@/stores/universeStore'

export function useUniverse(universeId: string | undefined) {
  const universes = useUniverseStore((s) => s.universes)
  const loaded = useUniverseStore((s) => s.loaded)
  const load = useUniverseStore((s) => s.load)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  return {
    universe: universes.find((u) => u.id === universeId) ?? null,
    loaded,
  }
}