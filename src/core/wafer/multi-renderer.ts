import { Leafer, Rect, Group, Ellipse, Text } from 'leafer-ui'
import { WaferTooltip } from './tooltip'
import { ensureCompactWaferGrid, calculateWaferStats } from './compact-grid'
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
}

export class MultiWaferRenderer {
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
      tooltip: {
        enabled: true,
        placement: 'top',
        offsetDistance: 8,
        showArrow: true,
        delayShow: 100,
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

  private getContainerSize(): { width: number; height: number } {
    const rect = this.container.getBoundingClientRect()
    return {
      width: Math.max(Math.floor(rect.width), 400),
      height: Math.max(Math.floor(rect.height), 400),
    }
  }

  private calculateCanvasSize(): { width: number; height: number } {
    let width = this.options.width
    let height = this.options.height

    if (width === 0) {
      const containerSize = this.getContainerSize()
      width = containerSize.width
      height = containerSize.height
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

    const centerX = gridX + waferWidth / 2
    const centerY = gridY + (waferHeight - 20) / 2

    return {
      id: data.waferId,
      data,
      x: gridX,
      y: gridY,
      scale,
      centerX,
      centerY,
      diePixelSize: config.dieSize * scale,
      radius: radius * scale,
    }
  }

  private getBinColors(): import('./types').BinColor[] {
    return this.waferDataList[0]?.binColors ?? []
  }

  private getBinColor(bin: number, info: WaferRenderInfo): string {
    const binColor = info.data.binColors.find(b => b.bin === bin)
    return binColor?.color ?? '#cccccc'
  }

  private isDieInWafer(x: number, y: number, info: WaferRenderInfo): boolean {
    const { diePixelSize, radius } = info
    const edgeExclusionPx = info.data.config.edgeExclusion * info.scale
    const effectiveRadius = radius - edgeExclusionPx

    const dieCenterX = x * diePixelSize
    const dieCenterY = y * diePixelSize
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY)

    return distance + diePixelSize / 2 <= effectiveRadius
  }

  private calculateStats(data: WaferMapData): WaferStats {
    const info = this.renderInfos.get(data.waferId)
    if (!info) {
      return {
        totalDies: 0,
        goodDies: 0,
        badDies: 0,
        yield: 0,
        binCounts: new Map(),
      }
    }

    const grid = ensureCompactWaferGrid(data.dies, data.config.dieSize)
    return calculateWaferStats(grid, data.config, info.scale)
  }

  public render(dataList: WaferMapData[]): void {
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
    // 设置默认 waferData，确保 tooltip 可以正常显示
    if (this.waferDataList.length > 0) {
      this.tooltip?.setWaferData(this.waferDataList[0])
    }
    this.drawWafers()

    if (this.options.enableZoom) {
      this.setupZoomAndPan()
    }
  }

  private applyTransform(): void {
    if (!this.leafer) return
    this.leafer.scale = this.currentScale
    this.leafer.x = this.panX
    this.leafer.y = this.panY
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

  private setupZoomAndPan(): void {
    if (!this.container || !this.leafer) return

    const canvas = this.container.querySelector('canvas')
    if (!canvas) return

    let isDragging = false
    let lastX = 0
    let lastY = 0
    
    // 跟踪鼠标位置用于 tooltip
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
      
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY

      this.panX += dx
      this.panY += dy

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

    ;(canvas as unknown as { __cleanup: () => void }).__cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    canvas.style.cursor = 'grab'
  }

  public setZoom(scale: number): void {
    const clampedScale = Math.max(
      this.options.minZoom,
      Math.min(this.options.maxZoom, scale)
    )
    this.zoomToCenter(clampedScale)
  }

  public resetView(): void {
    this.currentScale = this.options.initialZoom
    this.panX = 0
    this.panY = 0
    this.applyTransform()
  }

  private drawWafers(): void {
    if (!this.leafer) return

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

    const allStats = this.waferDataList.map(d => this.calculateStats(d))
    this.emit('stats-update', this.aggregateStats(allStats))
  }

  private drawWafer(info: WaferRenderInfo): void {
    if (!this.leafer) return

    const waferGroup = new Group({
      hitChildren: true,
    })
    const { data, x, y, radius, centerX, centerY, diePixelSize } = info

    // 1. 先添加 wafer 背景（在最底层）
    const waferCircle = new Ellipse({
      x: centerX - radius,
      y: centerY - radius,
      width: radius * 2,
      height: radius * 2,
      fill: '#1a1a2e',
      stroke: '#333344',
      strokeWidth: 1,
    })
    waferGroup.add(waferCircle)

    if (this.options.showNotch) {
      const notchSize = radius * 0.06
      const notch = new Ellipse({
        x: centerX - notchSize / 2,
        y: centerY + radius - notchSize / 2,
        width: notchSize,
        height: notchSize,
        fill: '#0f0f1a',
      })
      waferGroup.add(notch)
    }

    const halfDieSize = diePixelSize / 2
    const grid = ensureCompactWaferGrid(data.dies, data.config.dieSize)

    grid.forEachNonEmpty((dieGridX, dieGridY, bin) => {
      if (!this.isDieInWafer(dieGridX, dieGridY, info)) {
        return
      }

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

      // 使用闭包保存当前 die 的信息和位置
      const currentDieX = dieX
      const currentDieY = dieY
      const currentDieSize = size
      const currentDie = die
      const currentWaferData = data

      rect.on('click', () => {
        this.emit('die-click', die)
      })

      rect.on('pointer.enter', () => {
        rect.stroke = '#fff'
        rect.strokeWidth = 2
        // 使用 die 中心点显示 tooltip
        this.showTooltipAtDieCenter(currentDieX, currentDieY, currentDieSize, currentWaferData, currentDie)
      })

      rect.on('pointer.leave', () => {
        rect.stroke = this.options.showGrid ? 'rgba(0,0,0,0.2)' : undefined
        rect.strokeWidth = this.options.showGrid ? 0.3 : 0
        this.tooltip?.hide()
      })

      waferGroup.add(rect)

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
    })

    // 最后添加 title（在最上层显示，避免被遮盖）
    if (this.options.showTitles) {
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
        text: `${data.waferId}`,
        fill: '#333',
        fontSize: 12,
        textAlign,
      })
      waferGroup.add(title)
    }

    this.leafer.add(waferGroup)
  }

  /**
   * 显示 tooltip - 在鼠标位置显示
   */
  private showTooltipAtDieCenter(
    _dieX: number,
    _dieY: number,
    _dieSize: number,
    waferData: WaferMapData,
    die: DieData
  ): void {
    if (!this.tooltip) return

    this.tooltip.setWaferData(waferData)

    // 使用当前鼠标位置 + 微小偏移
    const x = this.currentMouseX
    const y = this.currentMouseY - 10

    this.tooltip.showAtPoint(x, y, die)
  }

  private aggregateStats(statsList: WaferStats[]): WaferStats {
    let totalDies = 0
    let goodDies = 0
    let badDies = 0
    const binCounts = new Map<number, number>()

    for (const stats of statsList) {
      totalDies += stats.totalDies
      goodDies += stats.goodDies
      badDies += stats.badDies

      for (const [bin, count] of stats.binCounts) {
        const current = binCounts.get(bin) ?? 0
        binCounts.set(bin, current + count)
      }
    }

    const yield_ = totalDies > 0 ? (goodDies / totalDies) * 100 : 0

    return {
      totalDies,
      goodDies,
      badDies,
      yield: Math.round(yield_ * 100) / 100,
      binCounts,
    }
  }

  public on<T extends keyof WaferEvents>(
    event: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    const handlers = this.eventHandlers.get(event) as Set<EventHandler<T>>
    handlers.add(handler)

    return () => {
      handlers.delete(handler)
    }
  }

  private emit<T extends keyof WaferEvents>(
    event: T,
    data: WaferEvents[T]
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        (handler as EventHandler<T>)(data)
      })
    }
  }

  public updateOptions(options: Partial<MultiRenderOptions>): void {
    this.options = { ...this.options, ...options }

    if (options.tooltip) {
      this.tooltip?.destroy()
      this.initTooltip()
    }

    this.render(this.waferDataList)
  }

  public getCanvasSize(): { width: number; height: number } {
    return {
      width: this.leafer?.width ?? 0,
      height: this.leafer?.height ?? 0,
    }
  }

  public destroy(): void {
    const canvas = this.container?.querySelector('canvas')
    if (canvas) {
      const cleanup = (canvas as unknown as { __cleanup?: () => void }).__cleanup
      if (cleanup) cleanup()
    }

    if (this.leafer) {
      this.leafer.destroy()
      this.leafer = null
    }

    if (this.tooltip) {
      this.tooltip.destroy()
      this.tooltip = null
    }

    this.eventHandlers.clear()
    this.renderInfos.clear()
    this.waferDataList = []
  }
}

export function createMultiWaferRenderer(
  container: string | HTMLElement,
  options?: MultiRenderOptions
): MultiWaferRenderer {
  return new MultiWaferRenderer(container, options)
}
