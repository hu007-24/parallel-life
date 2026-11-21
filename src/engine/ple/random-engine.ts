/**
 * random-engine：带种子的伪随机数。
 * 核心约定：随机流由 (universe.seed, 路径 pathKey, 用途 salt) 唯一决定，
 * 因此「相同 seed + 相同决策路径」必然得到一致的随机结果，
 * 而不同分支（pathKey 不同）自然获得独立随机流。
 */

/** mulberry32：32 位种子、周期 2^32、分布均匀，适合模拟类应用 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a：把字符串稳定地散列为 32 位整数，用于派生子随机流种子 */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function deriveSeed(seed: number, salt: string, pathKey: string): number {
  return hashString(`${seed}|${salt}|${pathKey}`)
}

export function rngFor(seed: number, salt: string, pathKey: string): () => number {
  return createRng(deriveSeed(seed, salt, pathKey))
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: () => number): T {
  if (items.length === 0) throw new RangeError('pickWeighted: empty items')
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll <= 0) return item
  }
  return items[items.length - 1] as T
}

/** 不放回加权抽样：用于从选择池生成互不相同的选项 */
export function sampleWeighted<T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  rng: () => number,
): T[] {
  const pool = [...items]
  const result: T[] = []
  while (result.length < count && pool.length > 0) {
    const picked = pickWeighted(pool, weightOf, rng)
    result.push(picked)
    pool.splice(pool.indexOf(picked), 1)
  }
  return result
}

export function chance(probability: number, rng: () => number): boolean {
  return rng() < probability
}