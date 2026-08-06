import type { DieData, WaferConfig, WaferStats } from './types'

export interface CompactWaferGridShape {
  minX: number
  minY: number
  width: number
  height: number
}

export interface CompactWaferGridOptions extends CompactWaferGridShape {
  dieSize?: number
  data?: Uint8Array
}

/**
 * 基于 Uint8Array 的紧凑 Wafer 网格存储
 *
 * 每个 die 占用 1 字节（bin 值 0-255），坐标通过数组下标隐式推导，
 * 相比 { x, y, bin } 对象数组可节省约 20-50 倍内存。
 */
export class CompactWaferGrid {
  public readonly minX: number
  public readonly minY: number
  public readonly width: number
  public readonly height: number
  public readonly dieSize: number
  public readonly data: Uint8Array

  constructor(options: CompactWaferGridOptions) {
    const { minX, minY, width, height, dieSize = 1, data } = options

    if (width <= 0 || height <= 0) {
      throw new Error('CompactWaferGrid width and height must be positive')
    }

    const length = width * height

    this.minX = minX
    this.minY = minY
    this.width = width
    this.height = height
    this.dieSize = dieSize
    this.data = data && data.length === length ? data : new Uint8Array(length)
  }

  get length(): number {
    return this.data.length
  }

  /** 检查坐标是否在网格范围内 */
  has(x: number, y: number): boolean {
    const ix = x - this.minX
    const iy = y - this.minY
    return ix >= 0 && ix < this.width && iy >= 0 && iy < this.height
  }

  private index(x: number, y: number): number {
    return (y - this.minY) * this.width + (x - this.minX)
  }

  /** 获取指定坐标的 bin 值 */
  get(x: number, y: number): number {
    return this.data[this.index(x, y)]
  }

  /** 设置指定坐标的 bin 值 */
  set(x: number, y: number, bin: number): void {
    this.data[this.index(x, y)] = bin
  }

  /** 将数组下标转为网格坐标 */
  coordFromIndex(index: number): { x: number; y: number } {
    const iy = Math.floor(index / this.width)
    const ix = index - iy * this.width
    return {
      x: ix + this.minX,
      y: iy + this.minY,
    }
  }

  /** 遍历所有非空（bin !== 0）的 die */
  forEachNonEmpty(callback: (x: number, y: number, bin: number) => void | false): void {
    const { data, width, minX, minY } = this
    let iy = 0
    let ix = 0

    for (let i = 0; i < data.length; i++) {
      const bin = data[i]
      if (bin !== 0) {
        const shouldContinue = callback(ix + minX, iy + minY, bin)
        if (shouldContinue === false) break
      }

      ix++
      if (ix === width) {
        ix = 0
        iy++
      }
    }
  }

  /** 遍历网格内所有 die */
  forEach(callback: (x: number, y: number, bin: number) => void | false): void {
    const { data, width, minX, minY } = this
    let iy = 0
    let ix = 0

    for (let i = 0; i < data.length; i++) {
      const shouldContinue = callback(ix + minX, iy + minY, data[i])
      if (shouldContinue === false) break

      ix++
      if (ix === width) {
        ix = 0
        iy++
      }
    }
  }

  /** 将单个坐标还原为 DieData 对象（用于事件和 tooltip） */
  toDieData(x: number, y: number): DieData {
    return {
      x,
      y,
      bin: this.get(x, y),
    }
  }

  /** 导出为传统 DieData[]（兼容性/序列化用，会重新分配对象数组） */
  toDies(): DieData[] {
    const dies: DieData[] = []
    this.forEachNonEmpty((x, y, bin) => {
      dies.push({ x, y, bin })
    })
    return dies
  }

  /** 导出为普通对象，便于 JSON 序列化 */
  toJSON(): CompactWaferGridShape & { dieSize: number; data: number[] } {
    return {
      minX: this.minX,
      minY: this.minY,
      width: this.width,
      height: this.height,
      dieSize: this.dieSize,
      data: Array.from(this.data),
    }
  }

  /** 从传统 DieData[] 构建紧凑网格 */
  static fromDies(dies: DieData[], dieSize: number = 1): CompactWaferGrid {
    if (dies.length === 0) {
      return new CompactWaferGrid({ minX: 0, minY: 0, width: 1, height: 1, dieSize })
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const die of dies) {
      if (die.x < minX) minX = die.x
      if (die.y < minY) minY = die.y
      if (die.x > maxX) maxX = die.x
      if (die.y > maxY) maxY = die.y
    }

    const width = maxX - minX + 1
    const height = maxY - minY + 1
    const grid = new CompactWaferGrid({ minX, minY, width, height, dieSize })

    for (const die of dies) {
      grid.set(die.x, die.y, die.bin)
    }

    return grid
  }

  /** 从 WaferConfig 创建空网格（覆盖整个晶圆直径范围） */
  static fromConfig(config: WaferConfig): CompactWaferGrid {
    const radius = config.diameter / 2
    const diesPerRadius = Math.ceil(radius / config.dieSize)
    const min = -diesPerRadius
    const max = diesPerRadius
    const size = max - min + 1

    return new CompactWaferGrid({
      minX: min,
      minY: min,
      width: size,
      height: size,
      dieSize: config.dieSize,
    })
  }
}

/**
 * 将 WaferMapData.dies 统一转为 CompactWaferGrid
 * 兼容旧的 DieData[] 输入（例如从 JSON 加载的数据）
 */
export function ensureCompactWaferGrid(dies: CompactWaferGrid | DieData[], dieSize?: number): CompactWaferGrid {
  if (dies instanceof CompactWaferGrid) {
    return dies
  }
  return CompactWaferGrid.fromDies(dies, dieSize)
}

/**
 * 基于紧凑网格计算统计信息
 * scale 用于把 die 坐标转换为像素距离，从而应用边缘排除区过滤
 */
export function calculateWaferStats(
  grid: CompactWaferGrid,
  config: WaferConfig,
  scale: number
): WaferStats {
  const radius = config.diameter / 2
  const edgeExclusionPx = config.edgeExclusion * scale
  const effectiveRadius = radius * scale - edgeExclusionPx
  const diePixelSize = config.dieSize * scale

  const binCounts = new Map<number, number>()
  let goodDies = 0
  let totalDies = 0

  grid.forEachNonEmpty((x, y, bin) => {
    const dieCenterX = x * diePixelSize
    const dieCenterY = y * diePixelSize
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY)

    if (distance + diePixelSize / 2 <= effectiveRadius) {
      totalDies++
      if (bin === 1) {
        goodDies++
      }
      binCounts.set(bin, (binCounts.get(bin) ?? 0) + 1)
    }
  })

  const badDies = totalDies - goodDies
  const yield_ = totalDies > 0 ? (goodDies / totalDies) * 100 : 0

  return {
    totalDies,
    goodDies,
    badDies,
    yield: Math.round(yield_ * 100) / 100,
    binCounts,
  }
}
