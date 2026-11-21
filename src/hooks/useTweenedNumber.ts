import { useEffect, useRef, useState } from 'react'

/** 数值缓动：属性变化时从旧值平滑过渡到新值（rAF，ease-out cubic） */
export function useTweenedNumber(value: number, duration = 600, enabled = true): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (!enabled) {
      fromRef.current = value
      setDisplay(value)
      return
    }
    const from = fromRef.current
    if (from === value) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (value - from) * eased
      fromRef.current = current
      setDisplay(current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, enabled])

  return display
}