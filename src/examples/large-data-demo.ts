/**
 * 大数据量 Wafer 渲染示例
 * 模拟 100万+ die 的渲染性能
 */

import { 
  OptimizedMultiWaferRenderer, 
  type WaferMapData,
  type BinColor,
} from '../core/wafer'

// 配置 - 默认10万die，可调整到100万
const CONFIG = {
  // 10 个 wafer，每个 1万 die = 10万（默认）
  // 可调整为 100 个 wafer = 100万
  WAFER_COUNT: 10,
  DIES_PER_WAFER: 10000,
  
  // 晶圆配置
  WAFER_DIAMETER: 300, // 12英寸晶圆
  DIE_SIZE: 0.3, // 小die尺寸
  EDGE_EXCLUSION: 3,
  
  // 渲染配置
  BATCH_SIZE: 100, // 更小的批次，避免卡顿
  MAX_FRAME_TIME: 16,
}

// Bin 颜色配置
const BIN_COLORS: BinColor[] = [
  { bin: 1, name: 'Pass', color: '#4ade80' },
  { bin: 2, name: 'Fail-Bin2', color: '#f87171' },
  { bin: 3, name: 'Fail-Bin3', color: '#fbbf24' },
  { bin: 4, name: 'Fail-Bin4', color: '#a78bfa' },
  { bin: 5, name: 'Fail-Bin5', color: '#60a5fa' },
  { bin: 6, name: 'Fail-Bin6', color: '#f472b6' },
  { bin: 7, name: 'Fail-Bin7', color: '#fb923c' },
  { bin: 8, name: 'Fail-Bin8', color: '#a3a3a3' },
]

/**
 * 异步生成随机 die 数据（分块避免阻塞）
 */
async function generateDiesAsync(
  count: number, 
  passRate: number,
  onProgress?: (current: number) => void
): Promise<Array<{ x: number; y: number; bin: number }>> {
  const dies: Array<{ x: number; y: number; bin: number }> = []
  const gridSize = Math.ceil(Math.sqrt(count))
  const halfGrid = gridSize / 2
  const batchSize = 1000 // 每批次生成1000个
  
  for (let batch = 0; batch < count; batch += batchSize) {
    const end = Math.min(batch + batchSize, count)
    
    for (let i = batch; i < end; i++) {
      const x = (i % gridSize) - halfGrid
      const y = Math.floor(i / gridSize) - halfGrid
      
      // 随机 bin，基于良率
      const rand = Math.random()
      let bin = 1
      if (rand > passRate) {
        bin = Math.floor(Math.random() * 7) + 2 // 2-8
      }
      
      dies.push({ x, y, bin })
    }
    
    // 每批次完成后让出主线程
    if (onProgress) {
      onProgress(end)
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return dies
}

/**
 * 异步生成单个 wafer 数据
 */
async function generateLargeWaferDataAsync(
  index: number,
  onProgress?: (current: number) => void
): Promise<WaferMapData> {
  const passRate = 0.85 + Math.random() * 0.1 // 85-95% 良率
  const dies = await generateDiesAsync(CONFIG.DIES_PER_WAFER, passRate, onProgress)
  
  return {
    waferId: `W${String(index + 1).padStart(3, '0')}`,
    lotId: 'LOT_LARGE_001',
    dies,
    binColors: BIN_COLORS,
    config: {
      diameter: CONFIG.WAFER_DIAMETER,
      dieSize: CONFIG.DIE_SIZE,
      edgeExclusion: CONFIG.EDGE_EXCLUSION,
      notchAngle: 0,
    },
  }
}

/**
 * 异步生成大数据集
 */
export async function generateLargeDatasetAsync(
  waferCount: number = CONFIG.WAFER_COUNT,
  onWaferProgress?: (waferIndex: number) => void
): Promise<WaferMapData[]> {
  const data: WaferMapData[] = []
  
  for (let i = 0; i < waferCount; i++) {
    const waferData = await generateLargeWaferDataAsync(i)
    data.push(waferData)
    if (onWaferProgress) {
      onWaferProgress(i + 1)
    }
    // 让出主线程
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return data
}

/**
 * 同步生成（用于小数据量测试）
 */
export function generateLargeDataset(waferCount: number = 5): WaferMapData[] {
  const data: WaferMapData[] = []
  
  for (let i = 0; i < waferCount; i++) {
    const passRate = 0.85 + Math.random() * 0.1
    const dies: Array<{ x: number; y: number; bin: number }> = []
    const gridSize = Math.ceil(Math.sqrt(CONFIG.DIES_PER_WAFER))
    const halfGrid = gridSize / 2
    
    for (let j = 0; j < CONFIG.DIES_PER_WAFER; j++) {
      const x = (j % gridSize) - halfGrid
      const y = Math.floor(j / gridSize) - halfGrid
      const rand = Math.random()
      let bin = 1
      if (rand > passRate) {
        bin = Math.floor(Math.random() * 7) + 2
      }
      dies.push({ x, y, bin })
    }
    
    data.push({
      waferId: `W${String(i + 1).padStart(3, '0')}`,
      lotId: 'LOT_LARGE_001',
      dies,
      binColors: BIN_COLORS,
      config: {
        diameter: CONFIG.WAFER_DIAMETER,
        dieSize: CONFIG.DIE_SIZE,
        edgeExclusion: CONFIG.EDGE_EXCLUSION,
        notchAngle: 0,
      },
    })
  }
  
  return data
}

/**
 * 性能监控
 */
class DemoPerformanceMonitor {
  private metrics = {
    renderStartTime: 0,
    renderEndTime: 0,
    frameCount: 0,
    droppedFrames: 0,
    lastFrameTime: 0,
  }
  
  private rafId: number | null = null
  private onUpdate: (metrics: typeof this.metrics) => void
  
  constructor(onUpdate: (metrics: typeof this.metrics) => void) {
    this.onUpdate = onUpdate
  }
  
  start(): void {
    this.metrics.renderStartTime = performance.now()
    this.metrics.lastFrameTime = performance.now()
    
    const measure = () => {
      const now = performance.now()
      const frameTime = now - this.metrics.lastFrameTime
      
      // 检测掉帧 (> 33ms 认为是掉帧，即 < 30fps)
      if (frameTime > 33) {
        this.metrics.droppedFrames++
      }
      
      this.metrics.frameCount++
      this.metrics.lastFrameTime = now
      
      this.onUpdate({ ...this.metrics })
      this.rafId = requestAnimationFrame(measure)
    }
    
    this.rafId = requestAnimationFrame(measure)
  }
  
  stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }
    this.metrics.renderEndTime = performance.now()
  }
  
  getTotalTime(): number {
    return this.metrics.renderEndTime - this.metrics.renderStartTime
  }
}

/**
 * 初始化大数据示例
 */
export async function initLargeDataDemo(
  container: HTMLElement | string,
  statusCallback: (status: string) => void
): Promise<() => void> {
  const containerEl = typeof container === 'string' 
    ? document.querySelector(container) as HTMLElement
    : container
    
  if (!containerEl) {
    throw new Error('Container not found')
  }
  
  // 使用传入的容器作为渲染区域，不替换 innerHTML
  // 创建性能统计条
  const statsBar = document.createElement('div')
  statsBar.style.cssText = `
    padding: 10px 16px;
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    font-family: monospace;
    font-size: 12px;
    display: flex;
    gap: 20px;
    align-items: center;
  `
  statsBar.innerHTML = '<span style="font-weight: bold;">⏳ 准备中...</span>'
  
  // 创建 wafer 容器
  const waferContainer = document.createElement('div')
  waferContainer.style.cssText = `
    flex: 1;
    overflow: auto;
    background: #fafafa;
  `
  
  // 设置容器样式
  containerEl.style.display = 'flex'
  containerEl.style.flexDirection = 'column'
  containerEl.style.height = '100%'
  containerEl.innerHTML = '' // 清空
  containerEl.appendChild(statsBar)
  containerEl.appendChild(waferContainer)
  
  const statsContainer = statsBar
  
  // 异步生成数据
  const totalWafers = CONFIG.WAFER_COUNT
  const totalDies = totalWafers * CONFIG.DIES_PER_WAFER
  statusCallback(`正在生成 ${(totalDies / 10000).toFixed(0)}万 die 数据...`)
  
  const data = await generateLargeDatasetAsync(
    totalWafers,
    (completed) => {
      statusCallback(`正在生成数据... ${completed}/${totalWafers} wafers`)
    }
  )
  
  // 创建性能监控
  const monitor = new DemoPerformanceMonitor((metrics) => {
    const totalTime = (performance.now() - metrics.renderStartTime) / 1000
    statsContainer.innerHTML = `
      <span style="font-weight: bold;">🚀 渲染中</span>
      <span>总Die数: <b>${(data.length * CONFIG.DIES_PER_WAFER).toLocaleString()}</b></span>
      <span>Wafer数: <b>${data.length}</b></span>
      <span>每Wafer: <b>${CONFIG.DIES_PER_WAFER.toLocaleString()}</b></span>
      <span>渲染时间: <b>${totalTime.toFixed(2)}s</b></span>
      <span>帧数: <b>${metrics.frameCount}</b></span>
      <span>掉帧: <b style="color: ${metrics.droppedFrames > 10 ? '#ef4444' : '#22c55e'}">${metrics.droppedFrames}</b></span>
    `
  })
  
  // 创建优化版渲染器
  statusCallback('初始化渲染器...')
  
  // 获取容器尺寸
  const containerRect = waferContainer.getBoundingClientRect()
  const renderer = new OptimizedMultiWaferRenderer(waferContainer, {
    width: Math.max(containerRect.width, 800),
    height: Math.max(containerRect.height, 600),
    progressiveRender: true,
    batchSize: CONFIG.BATCH_SIZE,
    useWorker: true,
    showGrid: false,
    showNotch: true,
    showTitles: true,
    grid: {
      columns: 5,
      gapX: 30,
      gapY: 50,
      padding: 40,
    },
    tooltip: {
      enabled: true,
      delayShow: 0,
      showArrow: true,
    },
  })
  
  // 监听事件
  renderer.on('stats-update', (stats) => {
    console.log('[Large Data Demo] Stats updated:', stats)
  })
  
  renderer.on('die-click', (die) => {
    console.log('[Large Data Demo] Die clicked:', die)
  })
  
  // 开始渲染
  statusCallback('开始渲染...')
  monitor.start()
  
  const renderStartTime = performance.now()
  await renderer.render(data)
  const renderTime = performance.now() - renderStartTime
  
  monitor.stop()
  
  // 最终统计
  const finalTotalDies = data.length * CONFIG.DIES_PER_WAFER
  statsContainer.innerHTML = `
    <span style="font-weight: bold; color: #22c55e;">✅ 渲染完成</span>
    <span>总Die数: <b>${finalTotalDies.toLocaleString()}</b></span>
    <span>Wafer数: <b>${data.length}</b></span>
    <span>总渲染时间: <b>${(renderTime / 1000).toFixed(2)}s</b></span>
    <span>平均每秒: <b>${(finalTotalDies / (renderTime / 1000)).toFixed(0)}</b> dies</span>
  `
  
  // 返回清理函数
  return () => {
    monitor.stop()
    renderer.destroy()
    // 清理 DOM，但不使用 innerHTML = ''，避免 Vue 问题
    while (containerEl.firstChild) {
      containerEl.removeChild(containerEl.firstChild)
    }
  }
}

// 导出配置供外部使用
export { CONFIG }
