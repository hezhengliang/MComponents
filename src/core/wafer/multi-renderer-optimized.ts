import { Leafer, Rect, Group, Ellipse, Text } from 'leafer-ui'
import { WaferTooltip } from './tooltip'
import { RenderScheduler, WaferWorkerManager } from './index'
import { ensureCompactWaferGrid, calculateWaferStats } from './compact-grid'
import type { CompactWaferGrid } from './compact-grid'
import type {
  DieData,
  WaferMapData,
  WaferStats,
  RenderOptions,
  WaferEvents,
  EventHandler,
} from './types'

interface WaferRenderInfo {
  id: string
  data: WaferMapData
  x: number
  y: number
  scale: number
  centerX: number
  centerY: number
  diePixelSize: number
  radius: number
}

export type TitlePosition = 'top' | 'bottom' | 'left' | 'right'

export interface GridLayout {
  columns: number
  rows?: number
  gapX?: number
  gapY?: number
  padding?: number
}

export interface MultiRenderOptions extends Omit<RenderOptions, 'width' | 'height'> {
  width?: number
  height?: number
  grid?: GridLayout
  showTitles?: boolean
  titlePosition?: TitlePosition
  enableZoom?: boolean
  minZoom?: number
  maxZoom?: number
  initialZoom?: number
  /** 是否启用分批次渲染 */
  progressiveRender?: boolean
  /** 每批次渲染的 die 数量 */
  batchSize?: number
  /** 是否启用 Web Worker */
  useWorker?: boolean
}

/**
 * 优化版 Multi Wafer Renderer
 * - 分批次渐进渲染
 * - Web Worker 数据计算
 * - 渲染调度器
 */
export class OptimizedMultiWaferRenderer {
  private leafer: Leafer | null = null
  private container: HTMLElement
  private waferDataList: WaferMapData[] = []
  private renderInfos: Map<string, WaferRenderInfo> = new Map()
  private options: Required<MultiRenderOptions>
  private tooltip: WaferTooltip | null = null
  private eventHandlers: Map<keyof WaferEvents, Set<EventHandler<keyof WaferEvents>>> = new Map()
  
  private currentScale = 1
  private panX = 0
  private panY = 0
  private currentMouseX = -1
  private currentMouseY = -1
  
  // 性能优化组件
  private scheduler: RenderScheduler | null = null
  private workerManager: WaferWorkerManager | null = null
  private abortController: AbortController | null = null

  constructor(container: string | HTMLElement, options: MultiRenderOptions = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!this.container) {
      throw new Error('Container not found')
    }

    this.options = {
      width: 0,
      height: 0,
      dieGap: 0.5,
      showGrid: true,
      showNotch: true,
      showLabels: false,
      showTitles: true,
      titlePosition: 'top',
      enableZoom: true,
      minZoom: 0.5,
      maxZoom: 10,
      initialZoom: 1,
      progressiveRender: true,
      batchSize: 100,
      useWorker: true,
      tooltip: {
        enabled: true,
        placement: 'top',
        offsetDistance: 8,
        showArrow: true,
        delayShow: 0, // 无延迟，提升响应
        delayHide: 150,
      },
      grid: {
        columns: 5,
        gapX: 20,
        gapY: 40,
        padding: 40,
      },
      ...options,
    }

    this.currentScale = this.options.initialZoom
    this.initComponents()
  }

  private initComponents(): void {
    // 初始化渲染调度器
    if (this.options.progressiveRender) {
      this.scheduler = new RenderScheduler({
        maxFrameTime: 16,
        batchSize: this.options.batchSize,
        useIdleCallback: true,
        debounceMs: 0,
      })
    }

    // 初始化 Web Worker
    if (this.options.useWorker) {
      try {
        this.workerManager = new WaferWorkerManager()
      } catch {
        // Web Worker initialization failed, will use main thread
      }
    }

    this.initTooltip()
  }

  private initTooltip(): void {
    if (this.options.tooltip?.enabled) {
      this.tooltip = new WaferTooltip({
        placement: this.options.tooltip.placement,
        offsetDistance: this.options.tooltip.offsetDistance,
        showArrow: this.options.tooltip.showArrow,
        delayShow: this.options.tooltip.delayShow,
        delayHide: this.options.tooltip.delayHide,
      })
    }
  }

  /**
   * 渐进式渲染所有 wafer
   */
  public async render(dataList: WaferMapData[]): Promise<void> {
    // 取消之前的渲染
    this.cancelRender()
    this.abortController = new AbortController()

    this.waferDataList = dataList
    this.renderInfos.clear()

    if (this.leafer) {
      this.leafer.destroy()
    }

    const { width, height } = this.calculateCanvasSize()

    this.leafer = new Leafer({
      view: this.container,
      width,
      height,
      fill: '#fafafa',
      hittable: true,
    })

    this.tooltip?.setBinColors(this.getBinColors())
    if (this.waferDataList.length > 0) {
      this.tooltip?.setWaferData(this.waferDataList[0])
    }

    // 使用 Web Worker 计算统计
    if (this.workerManager && this.options.useWorker) {
      try {
        const statsList = await this.workerManager.calculateBatchStats(dataList)
        this.emit('stats-update', this.aggregateStats(statsList))
      } catch {
        // Worker stats calculation failed, fallback to main thread
        this.calculateAndEmitStats()
      }
    } else {
      this.calculateAndEmitStats()
    }

    // 渐进式渲染
    if (this.options.progressiveRender && this.scheduler) {
      await this.renderProgressive()
    } else {
      this.renderImmediate()
    }

    if (this.options.enableZoom) {
      this.setupZoomAndPan()
    }
  }

  /**
   * 取消当前渲染
   */
  private cancelRender(): void {
    this.abortController?.abort()
    this.scheduler?.clear()
  }

  /**
   * 渐进式渲染
   */
  private async renderProgressive(): Promise<void> {
    if (!this.scheduler || !this.leafer) return

    const { grid } = this.options
    const columns = grid?.columns ?? 5
    const padding = grid?.padding ?? 40
    const gapX = grid?.gapX ?? 20
    const gapY = grid?.gapY ?? 40

    const { width } = this.calculateCanvasSize()
    const availableWidth = width - padding * 2
    const waferWidth = (availableWidth - gapX * (columns - 1)) / columns
    const waferHeight = waferWidth

    const renderPromises: Promise<void>[] = []

    this.waferDataList.forEach((data, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = padding + col * (waferWidth + gapX)
      const y = padding + row * (waferHeight + gapY)

      const info = this.calculateWaferLayout(data, x, y, waferWidth, waferHeight)
      this.renderInfos.set(data.waferId, info)

      renderPromises.push(
        this.renderWaferProgressive(info, this.abortController!.signal)
      )
    })

    // 所有任务添加完成后，启动调度器
    this.scheduler!.start()

    await Promise.all(renderPromises)
  }

  /**
   * 渐进式渲染单个 wafer
   */
  private renderWaferProgressive(
    info: WaferRenderInfo,
    signal: AbortSignal
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.leafer || !this.scheduler) {
        resolve()
        return
      }

      const waferGroup = new Group({ hitChildren: true })
      this.drawWaferBackground(waferGroup, info)

      // 分批添加 die 渲染任务（按数组下标区间切分，避免产生临时 DieData[]）
      const grid = ensureCompactWaferGrid(info.data.dies, info.data.config.dieSize)
      const totalCells = grid.length
      const batchSize = this.options.batchSize
      const totalBatches = Math.ceil(totalCells / batchSize)

      let completedBatches = 0

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, totalCells)

        this.scheduler!.addTask({
          id: `${info.id}-batch-${batchIndex}`,
          priority: batchIndex,
          data: { grid, start, end, info, waferGroup, signal },
          render: ({ grid, start, end, info, waferGroup, signal }) => {
            if (signal.aborted) return
            this.renderDieBatch(grid, start, end, info, waferGroup)
          },
          onComplete: () => {
            completedBatches++
            if (completedBatches === totalBatches) {
              // 最后添加 title（在最上层）
              this.drawTitle(waferGroup, info)
              this.leafer!.add(waferGroup)
              resolve()
            }
          },
        })
      }
    })
  }

  /**
   * 分批渲染 die
   */
  private renderDieBatch(
    grid: CompactWaferGrid,
    start: number,
    end: number,
    info: WaferRenderInfo,
    waferGroup: Group
  ): void {
    const { data, centerX, centerY, diePixelSize } = info
    const halfDieSize = diePixelSize / 2

    for (let i = start; i < end; i++) {
      const bin = grid.data[i]
      if (bin === 0) continue

      const { x: dieGridX, y: dieGridY } = grid.coordFromIndex(i)
      if (!this.isDieInWafer(dieGridX, dieGridY, info)) continue

      const die = grid.toDieData(dieGridX, dieGridY)
      const dieX = centerX + dieGridX * diePixelSize - halfDieSize + this.options.dieGap / 2
      const dieY = centerY + dieGridY * diePixelSize - halfDieSize + this.options.dieGap / 2
      const size = Math.max(0.5, diePixelSize - this.options.dieGap)

      const rect = new Rect({
        x: dieX,
        y: dieY,
        width: size,
        height: size,
        fill: this.getBinColor(bin, info),
        cornerRadius: 0.5,
        stroke: this.options.showGrid ? 'rgba(0,0,0,0.2)' : undefined,
        strokeWidth: this.options.showGrid ? 0.3 : 0,
        evented: true,
      })

      const currentDie = die
      const currentWaferData = data

      rect.on('click', () => this.emit('die-click', die))
      rect.on('pointer.enter', () => {
        rect.stroke = '#fff'
        rect.strokeWidth = 2
        this.showTooltipAtCursor(currentWaferData, currentDie)
      })
      rect.on('pointer.leave', () => {
        rect.stroke = this.options.showGrid ? 'rgba(0,0,0,0.2)' : undefined
        rect.strokeWidth = this.options.showGrid ? 0.3 : 0
        this.tooltip?.hide()
      })

      waferGroup.add(rect)

      // 添加文字（如果 die 足够大）
      if (size >= 12) {
        const text = new Text({
          x: dieX,
          y: dieY + size / 2 - 4,
          width: size,
          text: String(bin),
          fill: bin === 1 ? '#fff' : 'rgba(255,255,255,0.8)',
          fontSize: Math.min(size * 0.5, 10),
          textAlign: 'center',
          fontWeight: 'bold',
        })
        waferGroup.add(text)
      }
    }
  }

  /**
   * 立即渲染（非渐进式）
   */
  private renderImmediate(): void {
    const { grid } = this.options
    const columns = grid?.columns ?? 5
    const padding = grid?.padding ?? 40
    const gapX = grid?.gapX ?? 20
    const gapY = grid?.gapY ?? 40

    const { width } = this.calculateCanvasSize()
    const availableWidth = width - padding * 2
    const waferWidth = (availableWidth - gapX * (columns - 1)) / columns
    const waferHeight = waferWidth

    this.waferDataList.forEach((data, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = padding + col * (waferWidth + gapX)
      const y = padding + row * (waferHeight + gapY)

      const info = this.calculateWaferLayout(data, x, y, waferWidth, waferHeight)
      this.renderInfos.set(data.waferId, info)
      this.drawWafer(info)
    })
  }

  // 绘制 title（在所有元素之上）
  private drawTitle(group: Group, info: WaferRenderInfo): void {
    if (!this.options.showTitles) return
    
    const { data, x, y, radius, centerY } = info
    const titlePosition = this.options.titlePosition ?? 'top'
    let titleX = x
    let titleY = y + 10
    let titleWidth = radius * 2
    let textAlign: 'center' | 'left' = 'center'
    
    switch (titlePosition) {
      case 'top':
        titleX = x
        titleY = y + 10
        titleWidth = radius * 2
        textAlign = 'center'
        break
      case 'bottom':
        titleX = x
        titleY = y + radius * 2 - 25
        titleWidth = radius * 2
        textAlign = 'center'
        break
      case 'left':
        titleX = x - radius * 0.5
        titleY = centerY - 6
        titleWidth = radius
        textAlign = 'center'
        break
      case 'right':
        titleX = x + radius * 1.5
        titleY = centerY - 6
        titleWidth = radius
        textAlign = 'center'
        break
    }
    
    const title = new Text({
      x: titleX,
      y: titleY,
      width: titleWidth,
      text: data.waferId,
      fill: '#333',
      fontSize: 12,
      textAlign,
    })
    group.add(title)
  }

  // 其他方法保持不变...
  private drawWaferBackground(group: Group, info: WaferRenderInfo): void {
    const { radius, centerX, centerY } = info

    const waferCircle = new Ellipse({
      x: centerX - radius,
      y: centerY - radius,
      width: radius * 2,
      height: radius * 2,
      fill: '#1a1a2e',
      stroke: '#333344',
      strokeWidth: 1,
    })
    group.add(waferCircle)

    if (this.options.showNotch) {
      const notchSize = radius * 0.06
      const notch = new Ellipse({
        x: centerX - notchSize / 2,
        y: centerY + radius - notchSize / 2,
        width: notchSize,
        height: notchSize,
        fill: '#0f0f1a',
      })
      group.add(notch)
    }
  }

  // 保持原有方法...
  private calculateCanvasSize(): { width: number; height: number } {
    let width = this.options.width
    let height = this.options.height

    if (width === 0) {
      const rect = this.container.getBoundingClientRect()
      width = Math.max(Math.floor(rect.width), 400)
      height = Math.max(Math.floor(rect.height), 400)
    }

    if (height === 0) {
      const { grid } = this.options
      const columns = grid?.columns ?? 5
      const waferCount = this.waferDataList.length
      const rows = Math.ceil(waferCount / columns)
      const padding = grid?.padding ?? 40
      const gapX = grid?.gapX ?? 20
      const gapY = grid?.gapY ?? 40
      const availableWidth = width - padding * 2
      const waferWidth = (availableWidth - gapX * (columns - 1)) / columns
      const waferHeight = waferWidth
      height = padding * 2 + rows * waferHeight + (rows - 1) * gapY
      height = Math.max(height, 400)
    }

    return { width, height }
  }

  private calculateWaferLayout(
    data: WaferMapData,
    gridX: number,
    gridY: number,
    waferWidth: number,
    waferHeight: number
  ): WaferRenderInfo {
    const { config } = data
    const radius = config.diameter / 2
    const scale = Math.min(
      (waferWidth - 20) / config.diameter,
      (waferHeight - 40) / config.diameter
    )

    return {
      id: data.waferId,
      data,
      x: gridX,
      y: gridY,
      scale,
      centerX: gridX + waferWidth / 2,
      centerY: gridY + (waferHeight - 20) / 2,
      diePixelSize: config.dieSize * scale,
      radius: radius * scale,
    }
  }

  private drawWafer(info: WaferRenderInfo): void {
    if (!this.leafer) return
    const waferGroup = new Group({ hitChildren: true })
    this.drawWaferBackground(waferGroup, info)
    const grid = ensureCompactWaferGrid(info.data.dies, info.data.config.dieSize)
    this.renderDieBatch(grid, 0, grid.length, info, waferGroup)
    // 最后添加 title（在最上层）
    this.drawTitle(waferGroup, info)
    this.leafer.add(waferGroup)
  }

  private showTooltipAtCursor(waferData: WaferMapData, die: DieData): void {
    if (!this.tooltip) return
    this.tooltip.setWaferData(waferData)
    this.tooltip.showAtPoint(this.currentMouseX, this.currentMouseY - 10, die)
  }

  private setupZoomAndPan(): void {
    if (!this.container || !this.leafer) return
    const canvas = this.container.querySelector('canvas')
    if (!canvas) return

    let isDragging = false
    let lastX = 0
    let lastY = 0

    const trackMouse = (e: MouseEvent) => {
      this.currentMouseX = e.clientX
      this.currentMouseY = e.clientY
    }
    canvas.addEventListener('mousemove', trackMouse)
    window.addEventListener('mousemove', trackMouse)

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(
        this.options.minZoom,
        Math.min(this.options.maxZoom, this.currentScale * delta)
      )
      if (newScale !== this.currentScale) {
        this.zoomToCenter(newScale)
      }
    }, { passive: false })

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 1) {
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
        canvas.style.cursor = 'grabbing'
      }
    })

    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging) return
      this.panX += e.clientX - lastX
      this.panY += e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      this.applyTransform()
    }

    const handleMouseUp = (): void => {
      isDragging = false
      canvas.style.cursor = 'grab'
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  private zoomToCenter(newScale: number): void {
    if (!this.leafer) return
    const width = this.leafer.width ?? 800
    const height = this.leafer.height ?? 600
    const centerX = width / 2
    const centerY = height / 2
    const scaleRatio = newScale / this.currentScale
    this.panX = centerX - (centerX - this.panX) * scaleRatio
    this.panY = centerY - (centerY - this.panY) * scaleRatio
    this.currentScale = newScale
    this.applyTransform()
  }

  private applyTransform(): void {
    if (!this.leafer) return
    this.leafer.scale = this.currentScale
    this.leafer.x = this.panX
    this.leafer.y = this.panY
  }

  private isDieInWafer(x: number, y: number, info: WaferRenderInfo): boolean {
    const { diePixelSize, radius } = info
    const dieCenterX = x * diePixelSize
    const dieCenterY = y * diePixelSize
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY)
    return distance + diePixelSize / 2 <= radius
  }

  private getBinColor(bin: number, info: WaferRenderInfo): string {
    return info.data.binColors.find(b => b.bin === bin)?.color ?? '#cccccc'
  }

  private getBinColors() {
    return this.waferDataList[0]?.binColors ?? []
  }

  private calculateAndEmitStats(): void {
    const statsList = this.waferDataList.map(d => {
      const info = this.renderInfos.get(d.waferId)
      if (!info) return { totalDies: 0, goodDies: 0, badDies: 0, yield: 0, binCounts: new Map() }
      
      const grid = ensureCompactWaferGrid(d.dies, d.config.dieSize)
      return calculateWaferStats(grid, d.config, info.scale)
    })
    this.emit('stats-update', this.aggregateStats(statsList))
  }

  private aggregateStats(statsList: WaferStats[]): WaferStats {
    let totalDies = 0, goodDies = 0, badDies = 0
    const binCounts = new Map<number, number>()
    
    for (const stats of statsList) {
      totalDies += stats.totalDies
      goodDies += stats.goodDies
      badDies += stats.badDies
      for (const [bin, count] of stats.binCounts) {
        binCounts.set(bin, (binCounts.get(bin) ?? 0) + count)
      }
    }
    
    return {
      totalDies,
      goodDies,
      badDies,
      yield: totalDies > 0 ? (goodDies / totalDies) * 100 : 0,
      binCounts,
    }
  }

  public on<T extends keyof WaferEvents>(event: T, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    const handlers = this.eventHandlers.get(event) as Set<EventHandler<T>>
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  private emit<T extends keyof WaferEvents>(event: T, data: WaferEvents[T]): void {
    this.eventHandlers.get(event)?.forEach(h => (h as EventHandler<T>)(data))
  }

  public destroy(): void {
    this.cancelRender()
    this.scheduler?.destroy()
    this.workerManager?.terminate()
    this.leafer?.destroy()
    this.tooltip?.destroy()
    this.leafer = null
    this.tooltip = null
    this.scheduler = null
    this.workerManager = null
  }
}

export function createOptimizedMultiWaferRenderer(
  container: string | HTMLElement,
  options?: MultiRenderOptions
): OptimizedMultiWaferRenderer {
  return new OptimizedMultiWaferRenderer(container, options)
}
