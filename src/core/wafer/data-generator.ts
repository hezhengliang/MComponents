import type { DieData, WaferMapData, BinColor, WaferConfig } from './types'

/**
 * 默认 bin 颜色配置
 */
export const DEFAULT_BIN_COLORS: BinColor[] = [
  { bin: 0, name: 'Empty', color: '#2a2a3e' },
  { bin: 1, name: 'Pass', color: '#4caf50' },
  { bin: 2, name: 'Fail - Open', color: '#f44336' },
  { bin: 3, name: 'Fail - Short', color: '#ff9800' },
  { bin: 4, name: 'Fail - Param', color: '#9c27b0' },
  { bin: 5, name: 'Fail - Leakage', color: '#2196f3' },
]

/**
 * 默认晶圆配置
 */
export const DEFAULT_WAFER_CONFIG: WaferConfig = {
  diameter: 200,
  dieSize: 5,
  edgeExclusion: 5,
  notchAngle: 0,
}

/**
 * Wafer 数据生成器选项
 */
export interface DataGeneratorOptions {
  /** 晶圆直径（毫米） */
  diameter?: number
  /** Die 尺寸（毫米） */
  dieSize?: number
  /** 边缘排除区（毫米） */
  edgeExclusion?: number
  /** 合格率（0-1） */
  passRate?: number
  /** 边缘不良率（0-1） */
  edgeFailRate?: number
  /** 随机种子 */
  seed?: number
}

/**
 * Wafer 数据生成器
 */
export class WaferDataGenerator {
  private seed: number

  constructor(seed: number = Date.now()) {
    this.seed = seed
  }

  /**
   * 伪随机数生成器
   */
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  /**
   * 设置随机种子
   */
  public setSeed(seed: number): void {
    this.seed = seed
  }

  /**
   * 生成单个晶圆数据
   */
  public generate(
    waferId: string,
    lotId: string,
    options: DataGeneratorOptions = {}
  ): WaferMapData {
    const {
      diameter = DEFAULT_WAFER_CONFIG.diameter,
      dieSize = DEFAULT_WAFER_CONFIG.dieSize,
      edgeExclusion = DEFAULT_WAFER_CONFIG.edgeExclusion,
      passRate = 0.85,
      edgeFailRate = 0.3,
    } = options

    const dies: DieData[] = []
    const radius = diameter / 2
    const diesPerRadius = Math.ceil(radius / dieSize)

    for (let x = -diesPerRadius; x <= diesPerRadius; x++) {
      for (let y = -diesPerRadius; y <= diesPerRadius; y++) {
        const distance = Math.sqrt(x * x + y * y) * dieSize

        // 在晶圆范围内的 die
        if (distance <= radius) {
          let bin = 1 // 默认为合格

          // 边缘区域
          if (distance > radius - edgeExclusion - 10) {
            bin = this.random() > edgeFailRate ? 1 : 2
          }
          // 中心区域
          else if (distance < 30 && this.random() > 0.9) {
            bin = 3
          }
          // 随机不良
          else if (this.random() > passRate) {
            bin = Math.floor(this.random() * 4) + 2
          }

          dies.push({ x, y, bin })
        }
      }
    }

    return {
      waferId,
      lotId,
      config: {
        diameter,
        dieSize,
        edgeExclusion,
        notchAngle: 0,
      },
      binColors: DEFAULT_BIN_COLORS,
      dies,
    }
  }

  /**
   * 生成批次数据
   */
  public generateLot(
    lotId: string,
    waferCount: number,
    options: DataGeneratorOptions = {}
  ): WaferMapData[] {
    const wafers: WaferMapData[] = []
    
    for (let i = 0; i < waferCount; i++) {
      const waferId = `W${String(i + 1).padStart(3, '0')}`
      wafers.push(this.generate(waferId, lotId, options))
    }
    
    return wafers
  }
}

/**
 * 创建数据生成器实例的快捷函数
 */
export function createDataGenerator(seed?: number): WaferDataGenerator {
  return new WaferDataGenerator(seed)
}

/**
 * 生成单个晶圆数据的快捷函数
 */
export function generateWaferData(
  waferId: string,
  lotId: string,
  options?: DataGeneratorOptions
): WaferMapData {
  const generator = new WaferDataGenerator()
  return generator.generate(waferId, lotId, options)
}

/**
 * 生成批次数据的快捷函数
 */
export function generateLotData(
  lotId: string,
  waferCount: number,
  options?: DataGeneratorOptions
): WaferMapData[] {
  const generator = new WaferDataGenerator()
  return generator.generateLot(lotId, waferCount, options)
}
