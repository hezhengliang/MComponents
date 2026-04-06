import type { DieData, BinColor, WaferMapData } from './types'

/**
 * Tooltip 配置选项
 */
export interface TooltipOptions {
  placement?: 'top' | 'bottom' | 'left' | 'right'
  offsetDistance?: number
  showArrow?: boolean
  contentRenderer?: (die: DieData, waferData: WaferMapData, binColor?: BinColor) => HTMLElement | string
  delayShow?: number
  delayHide?: number
}

/**
 * Tooltip 管理器
 */
export class WaferTooltip {
  private tooltipElement: HTMLElement | null = null
  private arrowElement: HTMLElement | null = null
  private options: Required<TooltipOptions>
  private showTimeout: ReturnType<typeof setTimeout> | null = null
  private hideTimeout: ReturnType<typeof setTimeout> | null = null
  private currentDie: DieData | null = null
  private binColors: BinColor[] = []
  private waferData: WaferMapData | null = null

  constructor(options: TooltipOptions = {}) {
    this.options = {
      placement: 'top',
      offsetDistance: 8,
      showArrow: true,
      contentRenderer: this.defaultContentRenderer,
      delayShow: 100,
      delayHide: 150,
      ...options,
    }
    this.createTooltipElement()
  }

  private defaultContentRenderer(die: DieData, waferData: WaferMapData, binColor?: BinColor): HTMLElement {
    const container = document.createElement('div')
    container.className = 'wafer-tooltip-content'
    
    container.innerHTML = `
      <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2);">
        <div style="font-weight: 600; font-size: 13px; color: #fff;">${waferData.waferId}</div>
        <div style="font-size: 11px; color: #aaa;">${waferData.lotId}</div>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <span style="color: #aaa; font-size: 12px;">Position:</span>
        <span style="color: #fff; font-weight: 500; font-size: 12px;">(${die.x}, ${die.y})</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 16px;">
        <span style="color: #aaa; font-size: 12px;">Bin:</span>
        <span style="color: ${binColor?.color ?? '#fff'}; font-weight: 500; font-size: 12px;">
          ${binColor?.name ?? `Bin ${die.bin}`}
        </span>
      </div>
    `
    return container
  }

  private createTooltipElement(): void {
    this.tooltipElement = document.createElement('div')
    this.tooltipElement.className = 'wafer-tooltip'
    this.tooltipElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      background: rgba(30, 30, 40, 0.95);
      color: white;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      min-width: 140px;
    `

    if (this.options.showArrow) {
      this.arrowElement = document.createElement('div')
      this.arrowElement.className = 'wafer-tooltip-arrow'
      this.arrowElement.style.cssText = `
        position: absolute;
        width: 6px;
        height: 6px;
        background: rgba(30, 30, 40, 0.95);
        transform: rotate(45deg);
      `
      this.tooltipElement.appendChild(this.arrowElement)
    }

    document.body.appendChild(this.tooltipElement)
    
    // 确保 tooltip 在顶层
    this.tooltipElement.style.zIndex = '99999'
  }

  public setBinColors(binColors: BinColor[]): void {
    this.binColors = binColors
  }

  public setWaferData(waferData: WaferMapData): void {
    this.waferData = waferData
  }

  private getBinColor(bin: number): BinColor | undefined {
    return this.binColors.find(b => b.bin === bin)
  }

  private updateArrow(placement: 'top' | 'bottom'): void {
    if (!this.arrowElement) return

    this.arrowElement.style.top = ''
    this.arrowElement.style.bottom = ''
    this.arrowElement.style.left = '50%'
    this.arrowElement.style.transform = 'translateX(-50%) rotate(45deg)'

    if (placement === 'top') {
      this.arrowElement.style.bottom = '-3px'
    } else {
      this.arrowElement.style.top = '-3px'
    }
  }

  public show(screenX: number, screenY: number, width: number, height: number, die: DieData): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    if (this.currentDie === die && this.isVisible()) {
      return
    }

    this.currentDie = die

    if (this.showTimeout) {
      clearTimeout(this.showTimeout)
    }

    this.showTimeout = setTimeout(() => {
      this.doShow(screenX, screenY, width, height, die)
    }, this.options.delayShow)
  }

  private doShow(screenX: number, screenY: number, width: number, height: number, die: DieData): void {
    if (!this.tooltipElement || !this.waferData) return

    // 更新内容
    this.updateContent(die)

    // 先让 tooltip 可见但透明，以便获取尺寸
    this.tooltipElement.style.visibility = 'visible'
    this.tooltipElement.style.opacity = '0'
    
    // 获取 tooltip 尺寸
    const tooltipRect = this.tooltipElement.getBoundingClientRect()
    const offset = this.options.offsetDistance
    const viewportWidth = window.innerWidth

    // 计算 die 中心
    const dieCenterX = screenX + width / 2
    const dieTop = screenY

    // 默认在 die 上方显示，tooltip 水平居中
    let x = dieCenterX - tooltipRect.width / 2
    let y = dieTop - tooltipRect.height - offset

    // 边界检查
    if (x < 10) x = 10
    if (x + tooltipRect.width > viewportWidth - 10) {
      x = viewportWidth - tooltipRect.width - 10
    }
    if (y < 10) {
      // 如果上方空间不够，显示在 die 下方
      y = screenY + height + offset
    }

    // 应用位置
    this.tooltipElement.style.left = `${x}px`
    this.tooltipElement.style.top = `${y}px`

    // 更新箭头
    this.updateArrow(y < dieTop ? 'top' : 'bottom')

    // 淡入显示
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.opacity = '1'
      }
    })
  }

  private updateContent(die: DieData): void {
    if (!this.tooltipElement || !this.waferData) return

    const oldContent = this.tooltipElement.querySelector('.wafer-tooltip-content')
    if (oldContent) {
      oldContent.remove()
    }

    const content = this.options.contentRenderer(die, this.waferData, this.getBinColor(die.bin))
    if (typeof content === 'string') {
      const wrapper = document.createElement('div')
      wrapper.className = 'wafer-tooltip-content'
      wrapper.innerHTML = content
      this.tooltipElement.insertBefore(wrapper, this.arrowElement)
    } else {
      this.tooltipElement.insertBefore(content, this.arrowElement)
    }
  }

  public hide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout)
      this.showTimeout = null
    }

    this.hideTimeout = setTimeout(() => {
      this.doHide()
    }, this.options.delayHide)
  }

  public hideImmediately(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout)
      this.showTimeout = null
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
    this.doHide()
  }

  private doHide(): void {
    if (!this.tooltipElement) return

    this.tooltipElement.style.opacity = '0'
    
    setTimeout(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.visibility = 'hidden'
      }
    }, 150)

    this.currentDie = null
  }

  public isVisible(): boolean {
    return this.tooltipElement?.style.opacity === '1'
  }

  /**
   * 在指定屏幕坐标点显示 tooltip
   */
  public showAtPoint(screenX: number, screenY: number, die: DieData): void {
    if (!this.tooltipElement || !this.waferData) return

    // 清除之前的隐藏定时器
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    this.currentDie = die

    if (this.showTimeout) {
      clearTimeout(this.showTimeout)
    }

    this.showTimeout = setTimeout(() => {
      this.doShowAtPoint(screenX, screenY, die)
    }, this.options.delayShow)
  }

  private doShowAtPoint(screenX: number, screenY: number, die: DieData): void {
    if (!this.tooltipElement || !this.waferData) return

    // 更新内容
    this.updateContent(die)

    // 直接使用传入的坐标，不做额外计算
    const x = screenX
    const y = screenY

    // 应用位置
    this.tooltipElement.style.left = `${x}px`
    this.tooltipElement.style.top = `${y}px`
    this.tooltipElement.style.visibility = 'visible'
    this.tooltipElement.style.opacity = '1'

    // 更新箭头（默认上方）
    this.updateArrow('top')
  }

  public destroy(): void {
    this.hideImmediately()
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement)
    }
    this.tooltipElement = null
    this.arrowElement = null
  }
}

export function createWaferTooltip(options?: TooltipOptions): WaferTooltip {
  return new WaferTooltip(options)
}
