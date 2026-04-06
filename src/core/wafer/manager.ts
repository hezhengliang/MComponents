import { WaferRenderer } from './renderer'
import type {
  WaferMapData,
  WaferInstanceConfig,
  RenderOptions,
  WaferEvents,
  EventHandler,
} from './types'

/**
 * Wafer 实例信息
 */
export interface WaferInstance {
  /** 实例 ID */
  id: string
  /** 渲染器实例 */
  renderer: WaferRenderer
  /** 容器元素 */
  container: HTMLElement
}

/**
 * Wafer 管理器
 * 支持同时管理多个 wafer 实例
 */
export class WaferManager {
  private instances: Map<string, WaferInstance> = new Map()
  private container: HTMLElement | null = null

  /**
   * 创建单个 wafer 实例
   */
  public create(
    id: string,
    config: WaferInstanceConfig
  ): WaferRenderer {
    // 如果已存在，先销毁
    if (this.instances.has(id)) {
      this.destroy(id)
    }

    const container = typeof config.container === 'string'
      ? document.querySelector(config.container) as HTMLElement
      : config.container

    if (!container) {
      throw new Error(`Container not found for wafer: ${id}`)
    }

    const renderer = new WaferRenderer(container, config.data, config.options)

    this.instances.set(id, {
      id,
      renderer,
      container,
    })

    return renderer
  }

  /**
   * 批量创建 wafer 实例
   */
  public createBatch(
    container: string | HTMLElement,
    dataList: WaferMapData[],
    options?: Partial<RenderOptions>
  ): WaferRenderer[] {
    const parentContainer = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!parentContainer) {
      throw new Error('Container not found')
    }

    this.container = parentContainer
    const renderers: WaferRenderer[] = []

    // 清空容器
    parentContainer.innerHTML = ''

    for (const data of dataList) {
      // 为每个 wafer 创建子容器
      const waferContainer = document.createElement('div')
      waferContainer.className = 'wafer-item'
      waferContainer.style.cssText = `
        display: inline-block;
        margin: 10px;
        vertical-align: top;
      `
      parentContainer.appendChild(waferContainer)

      const renderer = this.create(data.waferId, {
        container: waferContainer,
        data,
        options,
      })

      renderers.push(renderer)
    }

    return renderers
  }

  /**
   * 创建网格布局的 wafer 实例
   */
  public createGrid(
    container: string | HTMLElement,
    dataList: WaferMapData[],
    columns: number,
    options?: Partial<RenderOptions>
  ): WaferRenderer[] {
    const parentContainer = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container

    if (!parentContainer) {
      throw new Error('Container not found')
    }

    this.container = parentContainer
    const renderers: WaferRenderer[] = []

    // 清空容器
    parentContainer.innerHTML = ''

    // 创建网格容器
    const gridContainer = document.createElement('div')
    gridContainer.className = 'wafer-grid'
    gridContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(300px, 1fr));
      gap: 20px;
      padding: 20px;
    `
    parentContainer.appendChild(gridContainer)

    for (const data of dataList) {
      // 为每个 wafer 创建卡片容器
      const waferCard = document.createElement('div')
      waferCard.className = 'wafer-card'
      waferCard.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `

      // 添加标题
      const title = document.createElement('h4')
      title.textContent = `${data.lotId} - ${data.waferId}`
      title.style.cssText = `
        margin: 0 0 12px 0;
        color: #333;
        font-size: 14px;
      `
      waferCard.appendChild(title)

      // 创建画布容器
      const canvasContainer = document.createElement('div')
      canvasContainer.className = 'wafer-canvas'
      waferCard.appendChild(canvasContainer)

      gridContainer.appendChild(waferCard)

      const renderer = this.create(data.waferId, {
        container: canvasContainer,
        data,
        options: {
          width: 280,
          height: 280,
          ...options,
        },
      })

      renderers.push(renderer)
    }

    return renderers
  }

  /**
   * 获取实例
   */
  public get(id: string): WaferInstance | undefined {
    return this.instances.get(id)
  }

  /**
   * 获取渲染器
   */
  public getRenderer(id: string): WaferRenderer | undefined {
    return this.instances.get(id)?.renderer
  }

  /**
   * 获取所有实例 ID
   */
  public getAllIds(): string[] {
    return Array.from(this.instances.keys())
  }

  /**
   * 获取所有渲染器
   */
  public getAllRenderers(): WaferRenderer[] {
    return Array.from(this.instances.values()).map(i => i.renderer)
  }

  /**
   * 批量更新数据
   */
  public updateAllData(dataList: WaferMapData[]): void {
    for (const data of dataList) {
      const instance = this.instances.get(data.waferId)
      if (instance) {
        instance.renderer.updateData(data)
      }
    }
  }

  /**
   * 批量更新选项
   */
  public updateAllOptions(options: Partial<RenderOptions>): void {
    for (const instance of this.instances.values()) {
      instance.renderer.updateOptions(options)
    }
  }

  /**
   * 为所有实例添加事件监听
   */
  public onAll<T extends keyof WaferEvents>(
    event: T,
    handler: EventHandler<T>
  ): () => void {
    const unsubscribes: (() => void)[] = []

    for (const instance of this.instances.values()) {
      const unsubscribe = instance.renderer.on(event, handler)
      unsubscribes.push(unsubscribe)
    }

    // 返回取消所有订阅的函数
    return () => {
      unsubscribes.forEach(fn => fn())
    }
  }

  /**
   * 销毁指定实例
   */
  public destroy(id: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.renderer.destroy()
      this.instances.delete(id)
    }
  }

  /**
   * 销毁所有实例
   */
  public destroyAll(): void {
    for (const instance of this.instances.values()) {
      instance.renderer.destroy()
    }
    this.instances.clear()
    
    if (this.container) {
      this.container.innerHTML = ''
    }
  }

  /**
   * 获取实例数量
   */
  public get count(): number {
    return this.instances.size
  }
}

/**
 * 创建管理器实例的快捷函数
 */
export function createWaferManager(): WaferManager {
  return new WaferManager()
}
