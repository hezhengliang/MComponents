/**
 * 瓦片图像查看器
 * 支持大图分块加载，类似地图瓦片或 Deep Zoom 效果
 * 集成标尺、缩放、平移功能
 */

import { Leafer, Group, Rect, Image as LeaferImage } from 'leafer-ui'
import { RulerCanvas, type RulerOptions, type RulerTransform } from '../ruler/RulerCanvas'

export interface TileProvider {
  /** 获取瓦片 URL 或 DataURL */
  getTileUrl(x: number, y: number, z: number): string
  /** 获取指定缩放级别的瓦片总数 */
  getTileCount(z: number): { cols: number; rows: number }
}

export interface TileImageOptions {
  /** 容器宽度 */
  width: number
  /** 容器高度 */
  height: number
  /** 原始图像宽度（像素） */
  imageWidth: number
  /** 原始图像高度（像素） */
  imageHeight: number
  /** 瓦片大小（默认 256） */
  tileSize?: number
  /** 最小缩放 */
  minZoom?: number
  /** 最大缩放 */
  maxZoom?: number
  /** 初始缩放 */
  initialZoom?: number
  /** 瓦片提供者 */
  tileProvider?: TileProvider
  /** 是否启用标尺 */
  enableRuler?: boolean
  /** 标尺配置 */
  rulerOptions?: RulerOptions
  /** 背景色 */
  backgroundColor?: string
  /** 是否显示网格 */
  showGrid?: boolean
  /** 是否显示调试信息 */
  debug?: boolean
  /** 缩放变化回调 */
  onZoomChange?: (zoom: number) => void
}

export interface TileInfo {
  col: number
  row: number
  x: number
  y: number
  size: number
  url: string
}

/**
 * 默认瓦片提供者 - 使用 Canvas 生成测试瓦片
 */
export class CanvasTileProvider implements TileProvider {
  private imageWidth: number
  private imageHeight: number
  private tileSize: number
  private cache = new Map<string, string>()

  constructor(imageWidth: number, imageHeight: number, tileSize: number = 256) {
    this.imageWidth = imageWidth
    this.imageHeight = imageHeight
    this.tileSize = tileSize
  }

  getTileCount(z: number): { cols: number; rows: number } {
    const scale = Math.pow(2, z)
    return {
      cols: Math.ceil(this.imageWidth / scale / this.tileSize),
      rows: Math.ceil(this.imageHeight / scale / this.tileSize),
    }
  }

  getTileUrl(col: number, row: number, z: number): string {
    const key = `${col},${z},${row}`
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const canvas = document.createElement('canvas')
    canvas.width = this.tileSize
    canvas.height = this.tileSize
    const ctx = canvas.getContext('2d')!

    // 当前层级每个瓦片覆盖的原始像素范围
    const pixelScale = Math.pow(2, z)
    const actualW = Math.min(this.tileSize, Math.ceil(this.imageWidth / pixelScale) - col * this.tileSize)
    const actualH = Math.min(this.tileSize, Math.ceil(this.imageHeight / pixelScale) - row * this.tileSize)

    // 生成有规律的图案，便于观察层级差异
    const hue = ((col * 137 + row * 53 + z * 100) % 360 + 360) % 360
    const lightness = 50 + ((col + row + z) % 3) * 15

    // 背景
    ctx.fillStyle = `hsl(${hue}, 40%, ${lightness}%)`
    ctx.fillRect(0, 0, actualW, actualH)

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, actualW, actualH)

    // 内部十字
    ctx.beginPath()
    ctx.moveTo(actualW / 2, 0)
    ctx.lineTo(actualW / 2, actualH)
    ctx.moveTo(0, actualH / 2)
    ctx.lineTo(actualW, actualH / 2)
    ctx.stroke()

    // 文字标注（层级越高字体越大，便于观察差异）
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    const fontSize = Math.min(24, 10 + z * 4)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${z}:${col},${row}`, actualW / 2, actualH / 2)

    // 小圆点装饰
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.arc(actualW * 0.25, actualH * 0.25, 3 + z, 0, Math.PI * 2)
    ctx.arc(actualW * 0.75, actualH * 0.75, 3 + z, 0, Math.PI * 2)
    ctx.fill()

    const url = canvas.toDataURL('image/png')
    this.cache.set(key, url)
    return url
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/**
 * 瓦片图像查看器
 */
export class TileImageViewer {
  private container: HTMLElement
  private options: Required<Omit<TileImageOptions, 'onZoomChange'>> & Pick<TileImageOptions, 'onZoomChange'>
  private leafer: Leafer | null = null
  private tileGroup: Group | null = null
  private tileProvider: TileProvider

  // 变换状态
  private currentScale = 1
  private panX = 0
  private panY = 0

  // 金字塔层级
  private currentZoomLevel = 0

  // 标尺
  private ruler: RulerCanvas | null = null

  // 瓦片管理
  private visibleTiles = new Map<string, LeaferImage>()
  private tileSize: number

  // DOM 引用
  private contentEl: HTMLElement | null = null

  // 交互
  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0

  // 动画
  private animationId: number | null = null

  // ResizeObserver
  private resizeObserver: ResizeObserver | null = null

  constructor(container: string | HTMLElement, options: TileImageOptions) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!this.container) {
      throw new Error('TileImageViewer: Container not found')
    }

    this.options = {
      tileProvider: undefined as unknown as TileProvider,
      rulerOptions: {},
      ...options,
      width: options.width ?? 800,
      height: options.height ?? 600,
      imageWidth: options.imageWidth ?? 2048,
      imageHeight: options.imageHeight ?? 2048,
      tileSize: options.tileSize ?? 256,
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 1.28,
      initialZoom: options.initialZoom ?? 1.28,
      enableRuler: options.enableRuler ?? true,
      backgroundColor: options.backgroundColor ?? '#1a1a2e',
      showGrid: options.showGrid ?? true,
      debug: options.debug ?? false,
      onZoomChange: options.onZoomChange ?? undefined,
    }

    this.tileSize = this.options.tileSize
    this.tileProvider = this.options.tileProvider
      || new CanvasTileProvider(this.options.imageWidth, this.options.imageHeight, this.tileSize)

    this.init()
  }

  private init(): void {
    this.setupContainer()
    this.initLeafer()
    this.initRuler()
    this.setupInteractions()
    this.setupResizeObserver()
    this.updateVisibleTiles()
  }

  private setupContainer(): void {
    const { width, height } = this.options
    this.container.style.cssText = `
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${this.options.backgroundColor};
    `
  }

  private initLeafer(): void {
    const { width, height, backgroundColor } = this.options

    // 创建内容容器（用于放置 leafer）
    const contentEl = document.createElement('div')
    contentEl.className = 'tile-viewer-content'
    contentEl.style.cssText = `
      position: absolute;
      top: ${this.options.enableRuler ? 24 : 0}px;
      left: ${this.options.enableRuler ? 24 : 0}px;
      right: 0;
      bottom: 0;
    `
    this.container.appendChild(contentEl)

    this.contentEl = contentEl

    const contentWidth = width - (this.options.enableRuler ? 24 : 0)
    const contentHeight = height - (this.options.enableRuler ? 24 : 0)

    this.leafer = new Leafer({
      view: contentEl,
      width: contentWidth,
      height: contentHeight,
      fill: backgroundColor,
      hittable: true,
    })

    // 添加一个背景矩形表示图像范围
    const bgGroup = new Group()
    const bgRect = new Rect({
      x: 0,
      y: 0,
      width: this.options.imageWidth,
      height: this.options.imageHeight,
      fill: '#0f0f1a',
      stroke: '#333355',
      strokeWidth: 2,
    })
    bgGroup.add(bgRect)

    // 添加网格线（可选）
    if (this.options.showGrid) {
      const gridGroup = new Group()
      const gridSize = 100
      const { imageWidth, imageHeight } = this.options

      for (let x = 0; x <= imageWidth; x += gridSize) {
        const line = new Rect({
          x, y: 0,
          width: 0.5,
          height: imageHeight,
          fill: 'rgba(100,100,150,0.15)',
        })
        gridGroup.add(line)
      }
      for (let y = 0; y <= imageHeight; y += gridSize) {
        const line = new Rect({
          x: 0, y,
          width: imageWidth,
          height: 0.5,
          fill: 'rgba(100,100,150,0.15)',
        })
        gridGroup.add(line)
      }
      bgGroup.add(gridGroup)
    }

    this.leafer.add(bgGroup)

    // 瓦片组
    this.tileGroup = new Group()
    this.leafer.add(this.tileGroup)

    // 初始化位置，让图像居中
    const contentW = this.leafer.width ?? contentWidth
    const contentH = this.leafer.height ?? contentHeight
    this.panX = (contentW - this.options.imageWidth) / 2
    this.panY = (contentH - this.options.imageHeight) / 2
    this.applyTransform()
  }

  private initRuler(): void {
    if (!this.options.enableRuler) return

    this.ruler = new RulerCanvas(this.container, {
      size: 24,
      unit: 'px',
      showCrosshair: true,
      ...this.options.rulerOptions,
    })

    const contentWidth = this.options.width
    const contentHeight = this.options.height
    this.ruler.resize(contentWidth, contentHeight)
    this.ruler.updateTransform({
      scale: this.currentScale,
      offsetX: this.panX,
      offsetY: this.panY,
    })
  }

  private applyTransform(): void {
    if (!this.leafer) return

    // 限制平移：图像起点 (0,0) 不能在视口左/上边缘之外
    // 即视口不能显示负坐标区域 (x<0 或 y<0)
    this.panX = Math.min(0, this.panX)
    this.panY = Math.min(0, this.panY)

    this.leafer.scale = this.currentScale
    this.leafer.x = this.panX
    this.leafer.y = this.panY

    this.ruler?.updateTransform({
      scale: this.currentScale,
      offsetX: this.panX,
      offsetY: this.panY,
    })
  }

  private setupInteractions(): void {
    const contentEl = this.contentEl
    if (!contentEl) return

    // 获取或创建用于事件监听的透明覆盖层
    // 这样可以避免依赖 leafer 内部 canvas 的具体结构
    let eventOverlay = contentEl.querySelector('.tile-event-overlay') as HTMLElement | null
    if (!eventOverlay) {
      eventOverlay = document.createElement('div')
      eventOverlay.className = 'tile-event-overlay'
      eventOverlay.style.cssText = `
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 5;
        cursor: grab;
      `
      contentEl.appendChild(eventOverlay)
    }

    // 鼠标滚轮缩放
    eventOverlay.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()

      // 检测触摸板双指缩放（macOS 会发送 ctrlKey=true 的 wheel 事件）
      // 缩放步进按 /2 规则：每次翻倍或减半
      const delta = e.deltaY > 0 ? 0.5 : 2

      const newScale = Math.max(
        this.options.minZoom,
        Math.min(this.options.maxZoom, this.currentScale * delta)
      )

      if (newScale !== this.currentScale) {
        const rect = contentEl.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        this.zoomAt(mouseX, mouseY, newScale)
      }
    }, { passive: false })

    // 鼠标拖拽平移
    eventOverlay.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0 || e.button === 1) {
        this.isDragging = true
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY
        eventOverlay!.style.cursor = 'grabbing'
      }
    })

    const handleMouseMove = (e: MouseEvent) => {
      const contentRect = contentEl.getBoundingClientRect()
      const localX = e.clientX - contentRect.left
      const localY = e.clientY - contentRect.top

      // 更新标尺鼠标位置
      this.ruler?.updateMousePosition(localX, localY)

      if (!this.isDragging) return

      const dx = e.clientX - this.lastMouseX
      const dy = e.clientY - this.lastMouseY

      this.panX += dx
      this.panY += dy

      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY

      this.applyTransform()
      this.scheduleTileUpdate()
    }

    const handleMouseUp = () => {
      this.isDragging = false
      if (eventOverlay) {
        eventOverlay.style.cursor = 'grab'
      }
    }

    // 鼠标离开窗口也停止拖拽
    const handleMouseLeave = () => {
      this.isDragging = false
      if (eventOverlay) {
        eventOverlay.style.cursor = 'grab'
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)

    // 存储清理函数
    ;(contentEl as any).__cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }

  private setupResizeObserver(): void {
    if (!this.container || typeof ResizeObserver === 'undefined') return

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        // 更新标尺大小
        this.ruler?.resize(width, height)
      }
    })

    this.resizeObserver.observe(this.container)
  }

  /**
   * 以指定点为中心缩放
   */
  private zoomAt(centerX: number, centerY: number, newScale: number): void {
    const scaleRatio = newScale / this.currentScale
    this.panX = centerX - (centerX - this.panX) * scaleRatio
    this.panY = centerY - (centerY - this.panY) * scaleRatio
    this.currentScale = newScale

    this.applyTransform()
    this.scheduleTileUpdate()

    // 通知缩放变化
    this.options.onZoomChange?.(this.currentScale)
  }

  /**
   * 调度瓦片更新（防抖）
   */
  private scheduleTileUpdate(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
    }
    this.animationId = requestAnimationFrame(() => {
      this.animationId = null
      this.updateVisibleTiles()
    })
  }

  /**
   * 计算最佳金字塔层级
   * z=0: 原始分辨率，z=1: 0.5x，z=2: 0.25x，...
   * 目标：瓦片在屏幕上显示大小接近 tileSize（256px）
   */
  private getOptimalZoomLevel(): number {
    if (this.currentScale >= 1) return 0
    const z = Math.round(-Math.log2(this.currentScale))
    return Math.max(0, z)
  }

  /**
   * 更新可见瓦片（支持金字塔多层）
   */
  private updateVisibleTiles(): void {
    if (!this.leafer || !this.tileGroup) return

    const contentWidth = this.leafer.width ?? 800
    const contentHeight = this.leafer.height ?? 600

    // 计算最佳层级
    const z = this.getOptimalZoomLevel()

    // 层级变化时清空旧瓦片，重新加载
    if (z !== this.currentZoomLevel) {
      this.currentZoomLevel = z
      for (const tile of this.visibleTiles.values()) {
        this.tileGroup.remove(tile)
      }
      this.visibleTiles.clear()
    }

    // 当前层级每个瓦片代表的世界坐标大小
    const tileWorldSize = this.tileSize * Math.pow(2, z)

    // 计算当前视口在世界坐标系中的范围
    const viewLeft = -this.panX / this.currentScale
    const viewTop = -this.panY / this.currentScale
    const viewRight = viewLeft + contentWidth / this.currentScale
    const viewBottom = viewTop + contentHeight / this.currentScale

    // 获取当前层级的瓦片总数
    const tileCount = this.tileProvider.getTileCount(z)

    // 计算需要显示的瓦片范围
    const startCol = Math.max(0, Math.floor(viewLeft / tileWorldSize))
    const startRow = Math.max(0, Math.floor(viewTop / tileWorldSize))
    const endCol = Math.min(tileCount.cols - 1, Math.ceil(viewRight / tileWorldSize))
    const endRow = Math.min(tileCount.rows - 1, Math.ceil(viewBottom / tileWorldSize))

    const neededTiles = new Set<string>()

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const key = `${z}:${col}:${row}`
        neededTiles.add(key)

        if (!this.visibleTiles.has(key)) {
          this.loadTile(col, row, z)
        }
      }
    }

    // 移除不需要的瓦片
    for (const [key, tile] of this.visibleTiles) {
      if (!neededTiles.has(key)) {
        this.tileGroup.remove(tile)
        this.visibleTiles.delete(key)
      }
    }

    // 调试信息
    if (this.options.debug) {
      console.log(`Level: ${z}, Tiles: ${this.visibleTiles.size}, Range: [${startCol}-${endCol}, ${startRow}-${endRow}]`)
    }
  }

  /**
   * 加载单个瓦片（支持金字塔层级）
   */
  private loadTile(col: number, row: number, z: number): void {
    const url = this.tileProvider.getTileUrl(col, row, z)
    const tileWorldSize = this.tileSize * Math.pow(2, z)
    const x = col * tileWorldSize
    const y = row * tileWorldSize

    try {
      const img = new LeaferImage({
        x,
        y,
        width: tileWorldSize,
        height: tileWorldSize,
        url,
      })

      if (this.tileGroup) {
        this.tileGroup.add(img)
        this.visibleTiles.set(`${z}:${col}:${row}`, img)
      }
    } catch (err) {
      console.warn('Failed to load tile:', col, row, z, err)
    }
  }

  /**
   * 设置缩放
   */
  setZoom(scale: number): void {
    const clamped = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, scale))
    const contentW = this.leafer?.width ?? this.options.width
    const contentH = this.leafer?.height ?? this.options.height
    this.zoomAt(contentW / 2, contentH / 2, clamped)
  }

  /**
   * 重置视图：以 initialZoom 显示图像右下角（x y 最大位置对齐视口右下角）
   */
  resetView(): void {
    this.currentScale = this.options.initialZoom
    const contentW = this.leafer?.width ?? this.options.width - (this.options.enableRuler ? 24 : 0)
    const contentH = this.leafer?.height ?? this.options.height - (this.options.enableRuler ? 24 : 0)
    // 图像右下角对齐视口右下角，使 X Y 都显示最大值
    this.panX = contentW - this.options.imageWidth * this.currentScale
    this.panY = contentH - this.options.imageHeight * this.currentScale
    this.applyTransform()
    this.scheduleTileUpdate()
  }

  /**
   * 适应窗口
   */
  fitToView(): void {
    const contentW = this.leafer?.width ?? this.options.width - (this.options.enableRuler ? 24 : 0)
    const contentH = this.leafer?.height ?? this.options.height - (this.options.enableRuler ? 24 : 0)
    const scaleX = contentW / this.options.imageWidth
    const scaleY = contentH / this.options.imageHeight
    this.currentScale = Math.min(scaleX, scaleY) * 0.9
    this.panX = (contentW - this.options.imageWidth * this.currentScale) / 2
    this.panY = (contentH - this.options.imageHeight * this.currentScale) / 2
    this.applyTransform()
    this.scheduleTileUpdate()
  }

  /**
   * 获取当前变换状态
   */
  getTransform(): RulerTransform {
    return {
      scale: this.currentScale,
      offsetX: this.panX,
      offsetY: this.panY,
    }
  }

  /**
   * 获取当前缩放
   */
  getZoom(): number {
    return this.currentScale
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.contentEl) {
      const cleanup = (this.contentEl as any).__cleanup
      if (cleanup) cleanup()
    }

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }



    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    this.ruler?.destroy()
    this.ruler = null

    this.leafer?.destroy()
    this.leafer = null

    this.visibleTiles.clear()
    this.container.innerHTML = ''
    this.contentEl = null
  }
}

export function createTileImageViewer(
  container: string | HTMLElement,
  options: TileImageOptions
): TileImageViewer {
  return new TileImageViewer(container, options)
}
