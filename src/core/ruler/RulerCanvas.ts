/**
 * 标尺画布
 * 为图像/画布查看器提供类似 CAD/Photoshop 的标尺功能
 */

export interface RulerOptions {
  /** 标尺高度（水平）/ 宽度（垂直），默认 24 */
  size?: number
  /** 标尺背景色 */
  backgroundColor?: string
  /** 刻度线颜色 */
  tickColor?: string
  /** 文字颜色 */
  textColor?: string
  /** 高亮颜色（鼠标指示线） */
  highlightColor?: string
  /** 字体 */
  font?: string
  /** 单位名称（显示在角落） */
  unit?: string
  /** 是否显示鼠标十字线 */
  showCrosshair?: boolean
  /** 每单位对应的像素数（如 1mm = 10px，则 pixelPerUnit = 10） */
  pixelPerUnit?: number
  /** X 轴每单位对应的像素数，未设置时 fallback 到 pixelPerUnit */
  pixelPerUnitX?: number
  /** Y 轴每单位对应的像素数，未设置时 fallback 到 pixelPerUnit */
  pixelPerUnitY?: number
  /** 坐标起点 X（单位，对应图像左上角），默认 0 */
  originX?: number
  /** 坐标起点 Y（单位，对应图像左上角），默认 0 */
  originY?: number
  /** 坐标最大值 X（单位），超出后不再显示刻度，默认 Infinity */
  maxX?: number
  /** 坐标最大值 Y（单位），超出后不再显示刻度，默认 Infinity */
  maxY?: number
  /** 是否使用地图/工程图风格的 1-2-5 刻度序列，默认 false（2 的幂次） */
  mapStyle?: boolean
  /** 最小刻度线在屏幕上的目标间距（像素），默认 24 */
  targetTickSpacing?: number
  /** 大数字是否使用 k/M/G 等量级缩写，默认 true */
  abbreviateLargeNumbers?: boolean
}

export interface RulerTransform {
  /** 缩放比例 */
  scale: number
  /** X 方向偏移（像素） */
  offsetX: number
  /** Y 方向偏移（像素） */
  offsetY: number
}

interface TickInterval {
  step: number
  midEvery: number
  majorEvery: number
}

/**
 * 计算合适的刻度间隔
 * 支持两种风格：
 * - 默认：2 的幂次（...0.25, 0.5, 1, 2, 4, 8...）
 * - mapStyle：地图/工程图风格的 1-2-5 序列（...1, 2, 5, 10, 20, 50...）
 */
function getTickInterval(
  scale: number,
  pixelPerUnit: number = 1,
  targetTickSpacing: number = 24,
  mapStyle: boolean = false,
): TickInterval {
  // 基础像素间隔 = 缩放比例 × 每单位像素数
  const pixelsPerUnit = scale * pixelPerUnit
  const rawStep = targetTickSpacing / pixelsPerUnit

  if (!mapStyle) {
    // step 取 2 的幂次：1, 2, 4, 8...（最小为 1，不展示小数刻度）
    const z = Math.round(Math.log2(rawStep))
    const step = Math.max(1, Math.pow(2, z))
    return { step, midEvery: 2, majorEvery: 4 }
  }

  // 地图风格：1-2-5 序列，标签落在 5/10/20/50... 等整数上（最小 step 为 1）
  const exp = Math.floor(Math.log10(rawStep))
  const base = Math.pow(10, exp)
  const ratio = rawStep / base

  let step: number
  if (ratio < Math.sqrt(2)) {
    step = base
  } else if (ratio < Math.sqrt(10)) {
    step = base * 2
  } else {
    step = base * 5
  }

  // 大刻度每 5 格，保证标签是 5/10/20/25/50... 这类整数
  return { step: Math.max(1, step), midEvery: 2, majorEvery: 5 }
}

export class RulerCanvas {
  private container: HTMLElement
  private options: Required<RulerOptions>

  // DOM 元素
  private wrapper: HTMLElement | null = null
  private topCanvas: HTMLCanvasElement | null = null
  private leftCanvas: HTMLCanvasElement | null = null
  // Context
  private topCtx: CanvasRenderingContext2D | null = null
  private leftCtx: CanvasRenderingContext2D | null = null

  // 状态
  private transform: RulerTransform = { scale: 1, offsetX: 0, offsetY: 0 }
  private mouseX = -1
  private mouseY = -1
  private contentWidth = 0
  private contentHeight = 0
  private dpr = window.devicePixelRatio || 1

  constructor(container: string | HTMLElement, options: RulerOptions = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!this.container) {
      throw new Error('RulerCanvas: Container not found')
    }

    this.options = {
      size: 24,
      backgroundColor: '#2b2b2b',
      tickColor: '#888888',
      textColor: '#cccccc',
      highlightColor: '#ff6b6b',
      font: '10px -apple-system, BlinkMacSystemFont, sans-serif',
      unit: 'px',
      showCrosshair: true,
      pixelPerUnit: 1,
      pixelPerUnitX: options.pixelPerUnitX ?? options.pixelPerUnit ?? 1,
      pixelPerUnitY: options.pixelPerUnitY ?? options.pixelPerUnit ?? 1,
      originX: 0,
      originY: 0,
      maxX: Infinity,
      maxY: Infinity,
      mapStyle: false,
      targetTickSpacing: 24,
      abbreviateLargeNumbers: true,
      ...options,
    }

    this.initDOM()
    this.bindEvents()
  }

  private initDOM(): void {
    const { size, backgroundColor } = this.options

    // 确保容器定位正确
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative'
    }

    // 创建 wrapper
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 10;
    `
    this.wrapper = wrapper

    // 左上角角落（显示单位）
    const corner = document.createElement('div')
    corner.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: ${size}px; height: ${size}px;
      background: ${backgroundColor};
      border-right: 1px solid #444;
      border-bottom: 1px solid #444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: ${this.options.textColor};
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
    `
    corner.textContent = this.options.unit
    corner.title = `单位: ${this.options.unit}`
    wrapper.appendChild(corner)

    // 顶部水平标尺
    const topCanvas = document.createElement('canvas')
    topCanvas.style.cssText = `
      position: absolute;
      top: 0; left: ${size}px;
      height: ${size}px;
      display: block;
      pointer-events: auto;
      cursor: col-resize;
      z-index: 11;
    `
    this.topCanvas = topCanvas
    this.topCtx = topCanvas.getContext('2d')
    wrapper.appendChild(topCanvas)

    // 左侧垂直标尺
    const leftCanvas = document.createElement('canvas')
    leftCanvas.style.cssText = `
      position: absolute;
      top: ${size}px; left: 0;
      bottom: 0;
      width: ${size}px;
      display: block;
      pointer-events: auto;
      cursor: row-resize;
      z-index: 11;
    `
    this.leftCanvas = leftCanvas
    this.leftCtx = leftCanvas.getContext('2d')
    wrapper.appendChild(leftCanvas)

    this.container.appendChild(wrapper)
  }

  private bindEvents(): void {
    if (!this.topCanvas || !this.leftCanvas) return

    // 鼠标在顶部标尺上移动
    this.topCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.topCanvas!.getBoundingClientRect()
      this.mouseX = e.clientX - rect.left
      this.mouseY = -1
      this.draw()
    })

    this.topCanvas.addEventListener('mouseleave', () => {
      this.mouseX = -1
      this.draw()
    })

    // 鼠标在左侧标尺上移动
    this.leftCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.leftCanvas!.getBoundingClientRect()
      this.mouseY = e.clientY - rect.top
      this.mouseX = -1
      this.draw()
    })

    this.leftCanvas.addEventListener('mouseleave', () => {
      this.mouseY = -1
      this.draw()
    })

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.dpr = window.devicePixelRatio || 1
      this.resize(this.contentWidth, this.contentHeight)
    })
  }

  /**
   * 调整大小
   */
  resize(contentWidth: number, contentHeight: number): void {
    this.contentWidth = contentWidth
    this.contentHeight = contentHeight

    const { size } = this.options
    const dpr = this.dpr

    if (this.topCanvas && this.topCtx) {
      const width = Math.max(0, contentWidth - size)
      this.topCanvas.width = width * dpr
      this.topCanvas.height = size * dpr
      this.topCanvas.style.width = `${width}px`
      this.topCanvas.style.height = `${size}px`
      this.topCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    if (this.leftCanvas && this.leftCtx) {
      const height = Math.max(0, contentHeight - size)
      this.leftCanvas.width = size * dpr
      this.leftCanvas.height = height * dpr
      this.leftCanvas.style.width = `${size}px`
      // 只有当 height > 0 时才设置 style.height，否则保留 bottom: 0 的自动高度
      if (height > 0) {
        this.leftCanvas.style.height = `${height}px`
      }
      this.leftCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    this.draw()
  }

  /**
   * 更新变换（同步主视图的缩放/平移）
   */
  updateTransform(transform: Partial<RulerTransform>): void {
    this.transform = { ...this.transform, ...transform }
    this.draw()
  }

  /**
   * 更新鼠标位置（用于主内容区的十字线）
   */
  updateMousePosition(x: number, y: number): void {
    this.mouseX = x
    this.mouseY = y
    this.draw()
  }

  private draw(): void {
    this.drawTopRuler()
    this.drawLeftRuler()
  }

  /**
   * 绘制顶部水平标尺
   */
  private drawTopRuler(): void {
    if (!this.topCtx || !this.topCanvas) return

    const ctx = this.topCtx
    const { size, backgroundColor, textColor, highlightColor } = this.options
    const width = this.topCanvas.width / this.dpr
    const height = size

    // 清空
    ctx.clearRect(0, 0, width, height)

    // 背景
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // 底部边框
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height - 0.5)
    ctx.lineTo(width, height - 0.5)
    ctx.stroke()

    const { scale, offsetX } = this.transform
    const { pixelPerUnitX, originX, maxX, mapStyle, targetTickSpacing } = this.options
    const pixelPerUnit = pixelPerUnitX
    const origin = originX
    const { step, midEvery, majorEvery } = getTickInterval(scale, pixelPerUnit, targetTickSpacing, mapStyle)

    // 计算可见的数值范围（v 为相对于 origin 的偏移），最小刻度值为图像原点 v=0
    const vMin = -offsetX / (scale * pixelPerUnit)
    const vMax = (width - offsetX) / (scale * pixelPerUnit)
    const rawStart = Math.floor(vMin / step) * step
    const rawEnd = Math.min((maxX - origin), Math.ceil(vMax / step) * step)
    const startValue = Math.max(0, rawStart)
    const endValue = Math.max(0, rawEnd)

    // 相邻刻度在屏幕上的像素间距，用于决定是否显示数字（避免重叠）
    const minorSpacingPx = step * pixelPerUnit * scale
    const midSpacingPx = midEvery * minorSpacingPx

    ctx.font = this.options.font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // 标签碰撞避让：用 measureText 计算宽度，重叠时跳过
    let lastLabelRight = -Infinity
    const labelGap = 6

    for (let v = startValue; v <= endValue; v += step) {
      const x = v * pixelPerUnit * scale + offsetX
      if (x < -10 || x > width + 10) continue

      const tickIndex = Math.round(v / step)
      const isMajor = tickIndex % majorEvery === 0
      const isMid = !isMajor && tickIndex % midEvery === 0

      // 刻度线长度：大刻度 55%，中刻度 40%，小刻度 28%
      let tickHeight: number
      if (isMajor) {
        tickHeight = height * 0.55
      } else if (isMid) {
        tickHeight = height * 0.40
      } else {
        tickHeight = height * 0.28
      }

      // 刻度线颜色：在深色背景上确保可见
      if (isMajor) {
        ctx.strokeStyle = '#cccccc'
      } else if (isMid) {
        ctx.strokeStyle = '#aaaaaa'
      } else {
        ctx.strokeStyle = '#888888'
      }

      // 刻度线
      ctx.lineWidth = isMajor ? 1.2 : isMid ? 1.0 : 1.0
      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, height - tickHeight)
      ctx.stroke()

      // 刻度文字：按区域内像素间距动态决定显示级别，并用碰撞避让防止重叠
      let label: string | null = null
      let labelFont = this.options.font
      let labelColor = textColor
      let labelY = 2

      if (isMajor) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
      } else if (isMid && midSpacingPx >= 16) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
        labelFont = '9px Inter, -apple-system, sans-serif'
        labelColor = '#aaaaaa'
        labelY = 3
      } else if (!isMajor && !isMid && minorSpacingPx >= 20) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
        labelFont = '8px Inter, -apple-system, sans-serif'
        labelColor = '#777777'
        labelY = 4
      }

      if (label != null) {
        ctx.font = labelFont
        const textWidth = ctx.measureText(label).width
        const left = x - textWidth / 2
        if (left >= lastLabelRight + labelGap) {
          ctx.fillStyle = labelColor
          ctx.fillText(label, x, labelY)
          lastLabelRight = left + textWidth
        }
      }
    }

    // 确保 0 刻度线始终可见（特殊标记）
    const zeroX = offsetX
    if (zeroX >= -size && zeroX <= width + size && !(startValue <= 0 && endValue >= 0)) {
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(zeroX, height)
      ctx.lineTo(zeroX, height * 0.6)
      ctx.stroke()
    }

    // 鼠标指示线
    if (this.mouseX >= 0 && this.options.showCrosshair) {
      ctx.strokeStyle = highlightColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(this.mouseX + 0.5, 0)
      ctx.lineTo(this.mouseX + 0.5, height)
      ctx.stroke()
    }
  }

  /**
   * 绘制左侧垂直标尺
   */
  private drawLeftRuler(): void {
    if (!this.leftCtx || !this.leftCanvas) return

    const ctx = this.leftCtx
    const { size, backgroundColor, textColor, highlightColor } = this.options
    const width = size
    const height = this.leftCanvas.height / this.dpr

    // 清空
    ctx.clearRect(0, 0, width, height)

    // 背景
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // 右边框
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(width - 0.5, 0)
    ctx.lineTo(width - 0.5, height)
    ctx.stroke()

    const { scale, offsetY } = this.transform
    const { pixelPerUnitY, originY, maxY, mapStyle, targetTickSpacing } = this.options
    const pixelPerUnit = pixelPerUnitY
    const origin = originY
    const { step, midEvery, majorEvery } = getTickInterval(scale, pixelPerUnit, targetTickSpacing, mapStyle)

    // 计算可见的数值范围（v 为相对于 origin 的偏移），最小刻度值为图像原点 v=0
    const vMin = -offsetY / (scale * pixelPerUnit)
    const vMax = (height - offsetY) / (scale * pixelPerUnit)
    const rawStart = Math.floor(vMin / step) * step
    const rawEnd = Math.min((maxY - origin), Math.ceil(vMax / step) * step)
    const startValue = Math.max(0, rawStart)
    const endValue = Math.max(0, rawEnd)

    // 相邻刻度在屏幕上的像素间距，用于决定是否显示数字（避免重叠）
    const minorSpacingPx = step * pixelPerUnit * scale
    const midSpacingPx = midEvery * minorSpacingPx

    ctx.font = this.options.font
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    // 标签碰撞避让：旋转后文字高度约等于文本宽度
    let lastLabelBottom = -Infinity
    const labelGap = 6

    for (let v = startValue; v <= endValue; v += step) {
      const y = v * pixelPerUnit * scale + offsetY
      if (y < -10 || y > height + 10) continue

      const tickIndex = Math.round(v / step)
      const isMajor = tickIndex % majorEvery === 0
      const isMid = !isMajor && tickIndex % midEvery === 0

      // 刻度线长度：大刻度 55%，中刻度 40%，小刻度 28%
      let tickWidth: number
      if (isMajor) {
        tickWidth = width * 0.55
      } else if (isMid) {
        tickWidth = width * 0.40
      } else {
        tickWidth = width * 0.28
      }

      // 刻度线颜色：在深色背景上确保可见
      if (isMajor) {
        ctx.strokeStyle = '#cccccc'
      } else if (isMid) {
        ctx.strokeStyle = '#aaaaaa'
      } else {
        ctx.strokeStyle = '#888888'
      }

      // 刻度线
      ctx.lineWidth = isMajor ? 1.2 : isMid ? 1.0 : 1.0
      ctx.beginPath()
      ctx.moveTo(width, y)
      ctx.lineTo(width - tickWidth, y)
      ctx.stroke()

      // 刻度文字：按区域内像素间距动态决定显示级别，并用碰撞避让防止重叠
      let label: string | null = null
      let labelFont = this.options.font
      let labelColor = textColor

      if (isMajor) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
      } else if (isMid && midSpacingPx >= 16) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
        labelFont = '9px Inter, -apple-system, sans-serif'
        labelColor = '#aaaaaa'
      } else if (!isMajor && !isMid && minorSpacingPx >= 20) {
        label = formatRulerValue(v + origin, this.options.abbreviateLargeNumbers)
        labelFont = '8px Inter, -apple-system, sans-serif'
        labelColor = '#777777'
      }

      if (label != null) {
        ctx.font = labelFont
        const textWidth = ctx.measureText(label).width
        const top = y - textWidth / 2
        if (top >= lastLabelBottom + labelGap) {
          ctx.fillStyle = labelColor
          ctx.save()
          ctx.translate(width / 2, y)
          ctx.rotate(-Math.PI / 2)
          ctx.textAlign = 'center'
          ctx.fillText(label, 0, 0)
          ctx.restore()
          lastLabelBottom = top + textWidth
        }
      }
    }

    // 确保 0 刻度线始终可见（特殊标记）
    const zeroY = offsetY
    if (zeroY >= -size && zeroY <= height + size && !(startValue <= 0 && endValue >= 0)) {
      ctx.strokeStyle = '#ff6b6b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(width, zeroY)
      ctx.lineTo(width * 0.4, zeroY)
      ctx.stroke()
    }

    // 鼠标指示线
    if (this.mouseY >= 0 && this.options.showCrosshair) {
      ctx.strokeStyle = highlightColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, this.mouseY + 0.5)
      ctx.lineTo(width, this.mouseY + 0.5)
      ctx.stroke()
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.wrapper && this.wrapper.parentElement) {
      this.wrapper.parentElement.removeChild(this.wrapper)
    }
    this.wrapper = null
    this.topCanvas = null
    this.leftCanvas = null

    this.topCtx = null
    this.leftCtx = null
  }
}

/**
 * 格式化标尺数值
 * 类似 wafer/工程图纸的简洁标签格式
 * 放大时隔变小后可能出现小数刻度，最多保留 10 位并去掉末尾 0
 * 大数字使用 k/M/G 等量级缩写
 */
function formatRulerValue(v: number, abbreviate: boolean = true): string {
  if (v === 0) return '0'

  const abs = Math.abs(v)
  if (!abbreviate || abs < 1000) {
    const fixed = v.toFixed(10)
    const trimmed = fixed.replace(/\.?0+$/, '')
    return trimmed || '0'
  }

  const units = ['', 'k', 'M', 'G', 'T', 'P']
  let tier = Math.min(Math.floor(Math.log10(abs) / 3), units.length - 1)
  const scale = Math.pow(1000, tier)
  let scaled = v / scale

  // 999999 这类接近进位的数字显示为 1M 而非 1000k
  if (Math.round(Math.abs(scaled)) >= 1000 && tier < units.length - 1) {
    tier++
    scaled /= 1000
  }

  // 根据数值大小选择合适的小数位数
  let fixed: string
  const absScaled = Math.abs(scaled)
  if (absScaled >= 100) {
    fixed = scaled.toFixed(0)
  } else if (absScaled >= 10) {
    fixed = scaled.toFixed(1)
  } else {
    fixed = scaled.toFixed(2)
  }

  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return trimmed + units[tier]
}
