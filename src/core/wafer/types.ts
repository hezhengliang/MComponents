/**
 * Wafer Core 类型定义
 */

/** 晶圆 Die 数据 */
export interface DieData {
  /** X 坐标（以 die 为单位） */
  x: number
  /** Y 坐标（以 die 为单位） */
  y: number
  /** Bin 值（测试结果分类） */
  bin: number
}

/** Bin 颜色配置 */
export interface BinColor {
  /** Bin 值 */
  bin: number
  /** 显示名称 */
  name: string
  /** 颜色值 */
  color: string
}

/** 晶圆配置 */
export interface WaferConfig {
  /** 晶圆直径（毫米） */
  diameter: number
  /** Die 尺寸（毫米） */
  dieSize: number
  /** 边缘排除区（毫米） */
  edgeExclusion: number
  /** Notch 方向（底部缺口角度） */
  notchAngle: number
}

/** Wafer Map 数据 */
export interface WaferMapData {
  /** 晶圆 ID */
  waferId: string
  /** 批次 ID */
  lotId: string
  /** 晶圆配置 */
  config: WaferConfig
  /** Bin 颜色定义 */
  binColors: BinColor[]
  /** Die 数据数组 */
  dies: DieData[]
}

/** 统计信息 */
export interface WaferStats {
  /** 总 die 数 */
  totalDies: number
  /** 合格 die 数 */
  goodDies: number
  /** 不良 die 数 */
  badDies: number
  /** 良率 */
  yield: number
  /** 各 bin 数量统计 */
  binCounts: Map<number, number>
}

/** Tooltip 配置 */
export interface TooltipConfig {
  /** 是否启用 tooltip */
  enabled?: boolean
  /** 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 偏移距离 */
  offsetDistance?: number
  /** 是否显示箭头 */
  showArrow?: boolean
  /** 延迟显示时间（毫秒） */
  delayShow?: number
  /** 延迟隐藏时间（毫秒） */
  delayHide?: number
}

/** 渲染选项 */
export interface RenderOptions {
  /** 画布宽度 */
  width: number
  /** 画布高度 */
  height: number
  /** die 之间的间隙（像素） */
  dieGap?: number
  /** 是否显示网格线 */
  showGrid?: boolean
  /** 是否显示 notch */
  showNotch?: boolean
  /** 是否显示坐标轴标签 */
  showLabels?: boolean
  /** Tooltip 配置 */
  tooltip?: TooltipConfig
}

/** Wafer 渲染实例配置 */
export interface WaferInstanceConfig {
  /** 容器元素或选择器 */
  container: string | HTMLElement
  /** 晶圆数据 */
  data: WaferMapData
  /** 渲染选项 */
  options?: Partial<RenderOptions>
}

/** Wafer 实例事件 */
export interface WaferEvents {
  /** die 点击事件 */
  'die-click': DieData
  /** 统计信息更新 */
  'stats-update': WaferStats
}

/** 事件处理器类型 */
export type EventHandler<T extends keyof WaferEvents> = (
  data: WaferEvents[T]
) => void
