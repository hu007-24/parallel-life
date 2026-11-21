/**
 * 本地合成音效（WebAudio，无音频资源、无网络）。
 * 每个 cue 都绑定一个可见交互：选择/确认/成就/结局/分支。
 * 不支持 AudioContext 的环境静默降级，不影响核心体验。
 */
export type CueKind = 'select' | 'confirm' | 'achievement' | 'ending' | 'branch'

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null
  if (!ctx) ctx = new window.AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneSpec {
  freq: number
  at: number
  duration: number
  gain: number
  type?: OscillatorType
}

function tone(ac: AudioContext, spec: ToneSpec) {
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  const t0 = ac.currentTime + 0.01 + spec.at
  osc.type = spec.type ?? 'sine'
  osc.frequency.setValueAtTime(spec.freq, t0)
  amp.gain.setValueAtTime(0, t0)
  amp.gain.linearRampToValueAtTime(spec.gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration)
  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + spec.duration + 0.03)
}

const CUES: Record<CueKind, ToneSpec[]> = {
  select: [{ freq: 660, at: 0, duration: 0.07, gain: 0.025 }],
  confirm: [
    { freq: 523.25, at: 0, duration: 0.1, gain: 0.04 },
    { freq: 783.99, at: 0.07, duration: 0.14, gain: 0.035 },
  ],
  branch: [{ freq: 440, at: 0, duration: 0.09, gain: 0.03, type: 'triangle' }],
  achievement: [
    { freq: 880, at: 0, duration: 0.12, gain: 0.035 },
    { freq: 1174.66, at: 0.1, duration: 0.16, gain: 0.03 },
    { freq: 1567.98, at: 0.2, duration: 0.22, gain: 0.025 },
  ],
  ending: [
    { freq: 261.63, at: 0, duration: 0.9, gain: 0.03 },
    { freq: 329.63, at: 0.02, duration: 0.9, gain: 0.026 },
    { freq: 392, at: 0.04, duration: 0.9, gain: 0.024 },
    { freq: 523.25, at: 0.18, duration: 0.7, gain: 0.02 },
  ],
}

export function playCue(kind: CueKind, enabled: boolean): void {
  if (!enabled) return
  try {
    const ac = context()
    if (!ac) return
    for (const spec of CUES[kind]) tone(ac, spec)
  } catch {
    // 音频不可用时保持静默，绝不阻断交互
  }
}