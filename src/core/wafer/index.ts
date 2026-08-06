/**
 * Wafer Map Core Package
 * 
 * 提供晶圆图可视化核心功能
 * 
 * @example
 * // 单 wafer 模式
 * import { WaferRenderer, generateWaferData } from '@/core/wafer'
 * 
 * const data = generateWaferData('W001', 'LOT001')
 * const renderer = new WaferRenderer('#container', data, {
 *   width: 600,
 *   height: 600,
 * })
 * 
 * renderer.on('die-click', (die) => {
 *   console.log('Clicked die:', die)
 * })
 * 
 * @example
 * // 多 wafer 模式
 * import { WaferManager, generateLotData } from '@/core/wafer'
 * 
 * const manager = new WaferManager()
 * const dataList = generateLotData('LOT001', 25)
 * 
 * manager.createGrid('#container', dataList, 5, {
 *   width: 280,
 *   height: 280,
 * })
 */

// 类型导出
export type {
  DieData,
  BinColor,
  WaferConfig,
  WaferMapData,
  WaferStats,
  RenderOptions,
  WaferInstanceConfig,
  WaferEvents,
  EventHandler,
  TooltipConfig,
} from './types'

export type {
  DataGeneratorOptions,
} from './data-generator'

export type {
  CompactWaferGridOptions,
  CompactWaferGridShape,
} from './compact-grid'

export type {
  WaferInstance,
} from './manager'

export type {
  TooltipOptions,
} from './tooltip'

export type {
  MultiRenderOptions,
  GridLayout,
  TitlePosition,
} from './multi-renderer'

export type {
  SchedulerOptions,
} from './scheduler'

// 类导出
export { WaferRenderer } from './renderer'
export { WaferDataGenerator, DEFAULT_BIN_COLORS, DEFAULT_WAFER_CONFIG } from './data-generator'
export { CompactWaferGrid, ensureCompactWaferGrid, calculateWaferStats } from './compact-grid'
export { WaferManager, createWaferManager } from './manager'
export { WaferTooltip, createWaferTooltip } from './tooltip'
export { MultiWaferRenderer, createMultiWaferRenderer } from './multi-renderer'

// 性能优化组件
export { RenderScheduler, VirtualRenderer, PerformanceMonitor } from './scheduler'
export { WaferWorkerManager } from './worker'
export { OptimizedMultiWaferRenderer, createOptimizedMultiWaferRenderer } from './multi-renderer-optimized'

// 快捷函数导出
export {
  createDataGenerator,
  generateWaferData,
  generateLotData,
} from './data-generator'
