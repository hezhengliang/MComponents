/**
 * 渲染调度器 - 优化多 Wafer 渲染性能
 * 支持分批次渲染、优先级队列、防抖等
 */

export interface RenderTask<T = unknown> {
  id: string
  priority: number // 数值越小优先级越高
  data: T
  render: (data: T) => void
  onComplete?: () => void
}

export interface SchedulerOptions {
  /** 每帧最大渲染时间 (ms) */
  maxFrameTime?: number
  /** 每批次最大任务数 */
  batchSize?: number
  /** 是否启用 requestIdleCallback */
  useIdleCallback?: boolean
  /** 防抖延迟 (ms) */
  debounceMs?: number
}

/**
 * 渲染调度器
 */
export class RenderScheduler {
  private taskQueue: RenderTask[] = []
  private isRunning = false
  private rafId: number | null = null
  private options: Required<SchedulerOptions>
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: SchedulerOptions = {}) {
    this.options = {
      maxFrameTime: 16, // 约 60fps
      batchSize: 10,
      useIdleCallback: true,
      debounceMs: 50,
      ...options,
    }
  }

  /**
   * 添加渲染任务
   */
  public addTask<T>(task: RenderTask<T>): void {
    // 插入到优先级位置（数值小的优先）
    const insertIndex = this.taskQueue.findIndex(t => t.priority > task.priority)
    if (insertIndex === -1) {
      this.taskQueue.push(task as RenderTask)
    } else {
      this.taskQueue.splice(insertIndex, 0, task as RenderTask)
    }
    this.schedule()
  }

  /**
   * 批量添加任务
   */
  public addTasks<T>(tasks: RenderTask<T>[]): void {
    for (const task of tasks) {
      this.addTask(task)
    }
  }

  /**
   * 移除任务
   */
  public removeTask(id: string): void {
    this.taskQueue = this.taskQueue.filter(t => t.id !== id)
  }

  /**
   * 清空队列
   */
  public clear(): void {
    this.taskQueue = []
    this.cancel()
  }

  /**
   * 防抖调度
   */
  private schedule(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.start()
    }, this.options.debounceMs)
  }

  /**
   * 开始渲染
   */
  public start(): void {
    if (this.isRunning || this.taskQueue.length === 0) return

    this.isRunning = true
    this.processNextBatch()
  }

  /**
   * 取消渲染
   */
  public cancel(): void {
    this.isRunning = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * 处理下一批次
   */
  private processNextBatch(): void {
    if (!this.isRunning || this.taskQueue.length === 0) {
      this.isRunning = false
      return
    }

    const startTime = performance.now()
    const batch: RenderTask[] = []

    // 收集本批次任务
    while (
      batch.length < this.options.batchSize &&
      this.taskQueue.length > 0
    ) {
      const task = this.taskQueue.shift()
      if (task) batch.push(task)
    }

    // 执行渲染
    const executeRender = () => {
      for (const task of batch) {
        // 检查是否超时
        if (performance.now() - startTime > this.options.maxFrameTime) {
          // 将未完成的任务放回队列
          this.taskQueue.unshift(...batch.slice(batch.indexOf(task)))
          break
        }

        try {
          task.render(task.data)
          task.onComplete?.()
        } catch {
          // Task failed silently
        }
      }

      // 继续下一批次
      if (this.taskQueue.length > 0) {
        this.scheduleNextBatch()
      } else {
        this.isRunning = false
      }
    }

    // 优先使用 requestIdleCallback，否则使用 requestAnimationFrame
    if (this.options.useIdleCallback && 'requestIdleCallback' in window) {
      window.requestIdleCallback(
        () => {
          this.rafId = requestAnimationFrame(executeRender)
        },
        { timeout: 100 }
      )
    } else {
      this.rafId = requestAnimationFrame(executeRender)
    }
  }

  /**
   * 调度下一批次
   */
  private scheduleNextBatch(): void {
    this.rafId = requestAnimationFrame(() => {
      this.processNextBatch()
    })
  }

  /**
   * 获取队列长度
   */
  public getQueueLength(): number {
    return this.taskQueue.length
  }

  /**
   * 是否正在运行
   */
  public isActive(): boolean {
    return this.isRunning
  }

  /**
   * 销毁
   */
  public destroy(): void {
    this.cancel()
    this.taskQueue = []
  }
}

/**
 * 创建虚拟列表渲染器
 * 只渲染可见区域的 wafer
 */
export class VirtualRenderer<T> {
  private items: T[] = []
  private visibleRange = { start: 0, end: 0 }
  private itemHeight: number
  private renderFn: (item: T, index: number) => void
  private scrollContainer: HTMLElement

  constructor(
    scrollContainer: HTMLElement,
    itemHeight: number,
    renderFn: (item: T, index: number) => void
  ) {
    this.scrollContainer = scrollContainer
    this.itemHeight = itemHeight
    this.renderFn = renderFn
    this.bindScroll()
  }

  public setItems(items: T[]): void {
    this.items = items
    this.updateVisibleRange()
  }

  private bindScroll(): void {
    this.scrollContainer.addEventListener('scroll', () => {
      this.updateVisibleRange()
    }, { passive: true })
  }

  private updateVisibleRange(): void {
    const scrollTop = this.scrollContainer.scrollTop
    const containerHeight = this.scrollContainer.clientHeight

    const startIndex = Math.floor(scrollTop / this.itemHeight)
    const endIndex = Math.min(
      Math.ceil((scrollTop + containerHeight) / this.itemHeight),
      this.items.length - 1
    )

    // 添加缓冲区
    const bufferSize = 2
    const bufferedStart = Math.max(0, startIndex - bufferSize)
    const bufferedEnd = Math.min(this.items.length - 1, endIndex + bufferSize)

    this.visibleRange = { start: bufferedStart, end: bufferedEnd }
    this.renderVisibleItems()
  }

  private renderVisibleItems(): void {
    for (let i = this.visibleRange.start; i <= this.visibleRange.end; i++) {
      this.renderFn(this.items[i], i)
    }
  }

  public destroy(): void {
    this.items = []
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics = {
    frameTime: 0,
    renderTime: 0,
    taskCount: 0,
  }
  private rafId: number | null = null

  public start(): void {
    let lastTime = performance.now()

    const measure = () => {
      const now = performance.now()
      this.metrics.frameTime = now - lastTime
      lastTime = now

      this.rafId = requestAnimationFrame(measure)
    }

    this.rafId = requestAnimationFrame(measure)
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
    }
  }

  public recordRenderTime(time: number): void {
    this.metrics.renderTime = time
    this.metrics.taskCount++
  }

  public getMetrics(): typeof this.metrics {
    return { ...this.metrics }
  }
}

export function createRenderScheduler(options?: SchedulerOptions): RenderScheduler {
  return new RenderScheduler(options)
}
