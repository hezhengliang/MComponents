/**
 * 瓦片提供者实现
 * 支持真实图片加载、URL 模板等多种瓦片来源
 */

import type { TileProvider } from './TileImageViewer'

/**
 * 图片瓦片提供者
 * 加载单张大图，自动切分为瓦片
 */
export class ImageTileProvider implements TileProvider {
  private imageWidth = 0
  private imageHeight = 0
  private tileSize: number
  private offscreenCanvas: HTMLCanvasElement | null = null
  private cache = new Map<string, string>()
  private loaded = false
  private loadPromise: Promise<void>
  private error: Error | null = null

  constructor(imageUrl: string, tileSize: number = 256) {
    this.tileSize = tileSize
    this.loadPromise = this.loadImage(imageUrl)
  }

  private async loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this.imageWidth = img.naturalWidth
        this.imageHeight = img.naturalHeight
        this.offscreenCanvas = document.createElement('canvas')
        this.offscreenCanvas.width = this.imageWidth
        this.offscreenCanvas.height = this.imageHeight
        const ctx = this.offscreenCanvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        this.loaded = true
        resolve()
      }
      img.onerror = () => {
        this.error = new Error(`Failed to load image: ${url}`)
        reject(this.error)
      }
      img.src = url
    })
  }

  get isLoaded(): boolean {
    return this.loaded
  }

  get dimensions(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight }
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
    if (!this.offscreenCanvas || !this.loaded) {
      return ''
    }

    const pixelScale = Math.pow(2, z)
    // 在原始图像中的采样位置
    const srcX = col * this.tileSize * pixelScale
    const srcY = row * this.tileSize * pixelScale
    const srcW = Math.min(this.tileSize * pixelScale, this.imageWidth - srcX)
    const srcH = Math.min(this.tileSize * pixelScale, this.imageHeight - srcY)

    const canvas = document.createElement('canvas')
    canvas.width = this.tileSize
    canvas.height = this.tileSize
    const ctx = canvas.getContext('2d')!
    // 使用 drawImage 的缩放能力，自动降采样
    ctx.drawImage(this.offscreenCanvas, srcX, srcY, srcW, srcH, 0, 0, this.tileSize, this.tileSize)

    const url = canvas.toDataURL('image/png')
    this.cache.set(key, url)
    return url
  }

  /** 等待图片加载完成 */
  ready(): Promise<void> {
    return this.loadPromise
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/**
 * URL 模板瓦片提供者
 * 支持类似地图服务的 URL 模板，如：https://example.com/tiles/{z}/{x}/{y}.png
 */
export class UrlTileProvider implements TileProvider {
  private urlTemplate: string
  private tileCount: { cols: number; rows: number }
  private cache = new Map<string, string>()

  /**
   * @param urlTemplate URL 模板，支持 {x} {y} {z} 占位符
   * @param tileCount 瓦片总数
   */
  constructor(urlTemplate: string, tileCount: { cols: number; rows: number }) {
    this.urlTemplate = urlTemplate
    this.tileCount = tileCount
  }

  getTileCount(z: number): { cols: number; rows: number } {
    // tileCount 对应 z=0（原始分辨率），按层级缩放
    const scale = Math.pow(2, z)
    return {
      cols: Math.max(1, Math.ceil(this.tileCount.cols / scale)),
      rows: Math.max(1, Math.ceil(this.tileCount.rows / scale)),
    }
  }

  getTileUrl(col: number, row: number, z: number): string {
    const key = `${col},${z},${row}`
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const url = this.urlTemplate
      .replace(/\{x\}/g, String(col))
      .replace(/\{y\}/g, String(row))
      .replace(/\{z\}/g, String(z))

    this.cache.set(key, url)
    return url
  }

  clearCache(): void {
    this.cache.clear()
  }
}

/**
 * 文件瓦片提供者
 * 读取本地图片文件，自动切分为瓦片
 */
export class FileTileProvider extends ImageTileProvider {
  constructor(file: File, tileSize: number = 256) {
    const url = URL.createObjectURL(file)
    super(url, tileSize)
  }
}
