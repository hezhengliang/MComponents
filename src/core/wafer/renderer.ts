import { Leafer, Rect, Group, Ellipse, Text } from 'leafer-ui'
import { WaferTooltip } from './tooltip'
import type {
  DieData,
  WaferMapData,
  WaferStats,
  RenderOptions,
  WaferEvents,
  EventHandler,
  TooltipConfig,
} from './types'

/**
 * 默认 Tooltip 配置
 */
const DEFAULT_TOOLTIP_CONFIG: Required<TooltipConfig> = {
  enabled: true,
  placement: 'top',
  offsetDistance: 8,
  showArrow: true,
  delayShow: 100,
  delayHide: 150,
}

/**
 * Wafer 渲染引擎
 * 负责单个 wafer 的渲染和交互
 */
export class WaferRenderer {
  private leafer: Leafer | null = null
  private dieGroup: Group | null = null
  private data: WaferMapData
  private options: Required<RenderOptions>
  private eventHandlers: Map<keyof WaferEvents, Set<EventHandler<keyof WaferEvents>>> = new Map()
  private container: HTMLElement
  private tooltip: WaferTooltip | null = null

  constructor(container: string | HTMLElement, data: WaferMapData, options?: Partial<RenderOptions>) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) as HTMLElement 
      : container
    
    if (!this.container) {
      throw new Error('Container not found')
    }

    this.data = data
    this.options = {
      width: 400,
      height: 400,
      dieGap: 1,
      showGrid: true,
      showNotch: true,
      showLabels: true,
      tooltip: DEFAULT_TOOLTIP_CONFIG,
      ...options,
    }

    // 初始化 tooltip
    this.initTooltip()

    this.init()
  }

  /**
   * 初始化 tooltip
   */
  private initTooltip(): void {
    const tooltipConfig = { ...DEFAULT_TOOLTIP_CONFIG, ...this.options.tooltip }
    
    if (tooltipConfig.enabled) {
      this.tooltip = new WaferTooltip({
        placement: tooltipConfig.placement,
        offsetDistance: tooltipConfig.offsetDistance,
        showArrow: tooltipConfig.showArrow,
        delayShow: tooltipConfig.delayShow,
        delayHide: tooltipConfig.delayHide,
      })
      this.tooltip.setBinColors(this.data.binColors)
      this.tooltip.setWaferData(this.data)
    }
  }

  /**
   * 计算布局信息
   */
  private get layoutInfo() {
    const { config } = this.data
    const radius = config.diameter / 2
    
    const padding = 30
    const availableWidth = this.options.width - padding * 2
    const availableHeight = this.options.height - padding * 2
    const scale = Math.min(
      availableWidth / config.diameter,
      availableHeight / config.diameter
    )
    
    return {
      scale,
      centerX: this.options.width / 2,
      centerY: this.options.height / 2,
      diePixelSize: config.dieSize * scale,
      radius: radius * scale,
    }
  }

  /**
   * 获取 bin 对应的颜色
   */
  private getBinColor(bin: number): string {
    const binColor = this.data.binColors.find(b => b.bin === bin)
    return binColor?.color ?? '#cccccc'
  }

  /**
   * 检查 die 是否在晶圆范围内
   */
  private isDieInWafer(die: DieData): boolean {
    const { config } = this.data
    const { diePixelSize, radius } = this.layoutInfo
    const edgeExclusionPx = config.edgeExclusion * this.layoutInfo.scale
    const effectiveRadius = radius - edgeExclusionPx
    
    const dieCenterX = die.x * diePixelSize
    const dieCenterY = die.y * diePixelSize
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY)
    
    return distance + diePixelSize / 2 <= effectiveRadius
  }

  /**
   * 计算统计信息
   */
  private calculateStats(dies: DieData[]): WaferStats {
    const binCounts = new Map<number, number>()
    let goodDies = 0
    
    for (const die of dies) {
      const count = binCounts.get(die.bin) ?? 0
      binCounts.set(die.bin, count + 1)
      
      if (die.bin === 1) {
        goodDies++
      }
    }
    
    const totalDies = dies.length
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

  /**
   * 初始化渲染器
   */
  private init(): void {
    this.leafer = new Leafer({
      view: this.container,
      width: this.options.width,
      height: this.options.height,
    })

    this.render()
  }

  /**
   * 绘制晶圆背景
   */
  private drawWaferBackground(): void {
    if (!this.leafer) return
    
    const { radius, centerX, centerY } = this.layoutInfo
    
    // 晶圆底色
    const waferCircle = new Ellipse({
      x: centerX - radius,
      y: centerY - radius,
      width: radius * 2,
      height: radius * 2,
      fill: '#1a1a2e',
      stroke: '#333344',
      strokeWidth: 2,
    })
    
    this.leafer.add(waferCircle)
    
    // 绘制 notch
    if (this.options.showNotch) {
      const notchSize = radius * 0.08
      const notch = new Ellipse({
        x: centerX - notchSize / 2,
        y: centerY + radius - notchSize / 2,
        width: notchSize,
        height: notchSize,
        fill: '#0f0f1a',
      })
      this.leafer.add(notch)
    }
  }

  /**
   * 绘制坐标轴标签
   */
  private drawAxisLabels(): void {
    if (!this.leafer || !this.options.showLabels) return
    
    const { radius, centerX, centerY, scale } = this.layoutInfo
    const { config } = this.data
    const step = Math.ceil(config.diameter / 10 / config.dieSize) * config.dieSize
    
    // X 轴标签
    for (let x = -config.diameter / 2; x <= config.diameter / 2; x += step) {
      const px = centerX + x * scale
      const label = new Text({
        x: px - 10,
        y: centerY + radius + 5,
        text: String(Math.round(x / config.dieSize)),
        fill: '#666',
        fontSize: 10,
      })
      this.leafer.add(label)
    }
    
    // Y 轴标签
    for (let y = -config.diameter / 2; y <= config.diameter / 2; y += step) {
      const py = centerY + y * scale
      const label = new Text({
        x: centerX - radius - 25,
        y: py - 6,
        text: String(Math.round(-y / config.dieSize)),
        fill: '#666',
        fontSize: 10,
      })
      this.leafer.add(label)
    }
  }

  /**
   * 绘制所有 die
   */
  private drawDies(): void {
    if (!this.leafer) return
    
    if (this.dieGroup) {
      this.leafer.remove(this.dieGroup)
    }
    
    this.dieGroup = new Group()
    const { diePixelSize, centerX, centerY } = this.layoutInfo
    const halfDieSize = diePixelSize / 2
    
    for (const die of this.data.dies) {
      if (!this.isDieInWafer(die)) {
        continue
      }
      
      const x = centerX + die.x * diePixelSize - halfDieSize + this.options.dieGap / 2
      const y = centerY + die.y * diePixelSize - halfDieSize + this.options.dieGap / 2
      const size = Math.max(0.5, diePixelSize - this.options.dieGap)
      
      const rect = new Rect({
        x,
        y,
        width: size,
        height: size,
        fill: this.getBinColor(die.bin),
        cornerRadius: 1,
        stroke: this.options.showGrid ? 'rgba(0,0,0,0.2)' : undefined,
        strokeWidth: this.options.showGrid ? 0.5 : 0,
      })
      
      // 点击事件
      rect.on('click', () => {
        this.emit('die-click', die)
      })
      
      // 悬停效果 - 同时触发 tooltip
      rect.on('pointer.enter', () => {
        rect.stroke = '#fff'
        rect.strokeWidth = 2
        
        // 显示 tooltip
        this.showTooltip(x, y, size, die)
      })
      
      rect.on('pointer.leave', () => {
        rect.stroke = this.options.showGrid ? 'rgba(0,0,0,0.2)' : undefined
        rect.strokeWidth = this.options.showGrid ? 0.5 : 0
        
        // 隐藏 tooltip
        this.tooltip?.hide()
      })
      
      this.dieGroup.add(rect)

      // 如果 die 足够大，显示 bin 数值
      if (size >= 12) {
        const text = new Text({
          x,
          y: y + size / 2 - 5,
          width: size,
          text: String(die.bin),
          fill: die.bin === 1 ? '#fff' : 'rgba(255,255,255,0.8)',
          fontSize: Math.min(size * 0.5, 12),
          textAlign: 'center',
          fontWeight: 'bold',
        })
        this.dieGroup.add(text)
      }
    }
    
    this.leafer.add(this.dieGroup)
  }

  /**
   * 显示 tooltip
   */
  private showTooltip(dieX: number, dieY: number, dieSize: number, die: DieData): void {
    if (!this.tooltip) return

    // 获取 canvas 元素和其在视口中的位置
    const canvas = this.container.querySelector('canvas')
    if (!canvas) return

    const canvasRect = canvas.getBoundingClientRect()

    // 计算 canvas 的显示缩放比例
    const leaferWidth = this.leafer?.width ?? 1
    const leaferHeight = this.leafer?.height ?? 1
    const scaleX = canvasRect.width / leaferWidth
    const scaleY = canvasRect.height / leaferHeight

    // 计算 die 在屏幕上的位置
    const screenX = canvasRect.left + dieX * scaleX
    const screenY = canvasRect.top + dieY * scaleY
    const screenWidth = dieSize * scaleX
    const screenHeight = dieSize * scaleY

    // 显示 tooltip
    this.tooltip.show(screenX, screenY, screenWidth, screenHeight, die)
  }

  /**
   * 渲染 wafer
   */
  private render(): void {
    if (!this.leafer) return
    
    this.leafer.clear()
    this.drawWaferBackground()
    this.drawDies()
    this.drawAxisLabels()
    
    // 触发统计更新
    const stats = this.calculateStats(this.data.dies.filter(d => this.isDieInWafer(d)))
    this.emit('stats-update', stats)
  }

  /**
   * 事件监听
   */
  public on<T extends keyof WaferEvents>(
    event: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    
    const handlers = this.eventHandlers.get(event) as Set<EventHandler<T>>
    handlers.add(handler)
    
    // 返回取消订阅函数
    return () => {
      handlers.delete(handler)
    }
  }

  /**
   * 触发事件
   */
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

  /**
   * 更新数据
   */
  public updateData(data: WaferMapData): void {
    this.data = data
    this.tooltip?.setBinColors(data.binColors)
    this.tooltip?.setWaferData(data)
    this.render()
  }

  /**
   * 更新选项
   */
  public updateOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options }
    
    // 如果 tooltip 配置变化，重新初始化
    if (options.tooltip) {
      this.tooltip?.destroy()
      this.initTooltip()
    }
    
    // 如果尺寸变化，需要重新初始化
    if (options.width !== undefined || options.height !== undefined) {
      this.leafer?.resize({
        width: this.options.width,
        height: this.options.height,
      })
    }
    
    this.render()
  }

  /**
   * 获取当前统计信息
   */
  public getStats(): WaferStats {
    return this.calculateStats(this.data.dies.filter(d => this.isDieInWafer(d)))
  }

  /**
   * 销毁渲染器
   */
  public destroy(): void {
    if (this.leafer) {
      this.leafer.destroy()
      this.leafer = null
      this.dieGroup = null
    }
    
    if (this.tooltip) {
      this.tooltip.destroy()
      this.tooltip = null
    }
    
    this.eventHandlers.clear()
  }
}
