<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Leafer, Rect, Image as LeaferImage } from 'leafer-ui'
import UTIF from 'utif'

const containerRef = ref<HTMLDivElement>()
const fileInputRef = ref<HTMLInputElement>()
const leaferRef = ref<Leafer | null>(null)
const imageInfo = ref({ width: 0, height: 0, pages: 0, currentPage: 0 })
const isLoading = ref(false)
const errorMsg = ref('')

onMounted(() => {
  if (!containerRef.value) return

  const leafer = new Leafer({
    view: containerRef.value,
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
    fill: '#1a1a2e',
  })

  leaferRef.value = leafer

  const resizeObserver = new ResizeObserver(() => {
    if (containerRef.value && leaferRef.value) {
      leaferRef.value.width = containerRef.value.clientWidth
      leaferRef.value.height = containerRef.value.clientHeight
    }
  })
  resizeObserver.observe(containerRef.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
    leafer.destroy()
  })

  // 默认加载测试 TIFF
  loadDefaultTiff()
})

async function loadDefaultTiff() {
  try {
    const response = await fetch('/sample.tif')
    if (!response.ok) return
    const blob = await response.blob()
    const file = new File([blob], 'sample.tif', { type: 'image/tiff' })
    await loadTiff(file)
  } catch (err) {
    console.log('默认 TIFF 加载失败:', err)
  }
}

async function loadTiff(file: File) {
  if (!leaferRef.value) return
  isLoading.value = true
  errorMsg.value = ''

  try {
    const buf = await file.arrayBuffer()
    const ifds = UTIF.decode(buf)

    if (!ifds || ifds.length === 0) {
      throw new Error('无法解析 TIFF 文件')
    }

    // 保存到全局变量供翻页使用
    currentIfds = ifds
    tiffArrayBuffer = buf

    imageInfo.value.pages = ifds.length
    imageInfo.value.currentPage = 0

    // 渲染第一页
    await renderPage(ifds, 0)
  } catch (err: any) {
    errorMsg.value = err.message || '加载失败'
  } finally {
    isLoading.value = false
  }
}

async function renderPage(ifds: any[], pageIndex: number) {
  if (!leaferRef.value || !tiffArrayBuffer) return

  const leafer = leaferRef.value
  leafer.clear()

  const ifd = ifds[pageIndex]
  UTIF.decodeImage(tiffArrayBuffer, ifd, ifds)

  const rgba = UTIF.toRGBA8(ifd)
  const width = ifd.width
  const height = ifd.height

  imageInfo.value.width = width
  imageInfo.value.height = height
  imageInfo.value.currentPage = pageIndex

  // 创建 ImageData
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height)
  ctx.putImageData(imageData, 0, 0)

  // 转为 blob URL
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
  const url = URL.createObjectURL(blob)

  // 使用 leafer 渲染
  const img = new LeaferImage({
    url,
    width,
    height,
    draggable: true,
  })

  // 居中显示并适配画布
  const lw = leafer.width || 800
  const lh = leafer.height || 600
  const scale = Math.min(
    lw / width,
    lh / height,
    1
  ) * 0.9

  img.scale = scale
  img.x = (lw - width * scale) / 2
  img.y = (lh - height * scale) / 2

  leafer.add(img)

  // 添加边框指示器
  const border = new Rect({
    x: img.x,
    y: img.y,
    width: width * scale,
    height: height * scale,
    stroke: '#6366f1',
    strokeWidth: 1,
    fill: 'transparent',
  })
  leafer.add(border)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadTiff(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file && file.name.toLowerCase().endsWith('.tif') || file?.name.toLowerCase().endsWith('.tiff')) {
    loadTiff(file)
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

let tiffArrayBuffer: ArrayBuffer | null = null
let currentIfds: any[] | null = null

async function nextPage() {
  if (!currentIfds || imageInfo.value.currentPage >= currentIfds.length - 1) return
  await renderPage(currentIfds, imageInfo.value.currentPage + 1)
}

async function prevPage() {
  if (!currentIfds || imageInfo.value.currentPage <= 0) return
  await renderPage(currentIfds, imageInfo.value.currentPage - 1)
}
</script>

<template>
  <div class="tiff-viewer">
    <div class="toolbar">
      <button class="tool-btn" @click="triggerFileInput">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
        </svg>
        打开 TIFF
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".tif,.tiff"
        style="display: none"
        @change="onFileChange"
      />
      <div v-if="imageInfo.pages > 1" class="page-controls">
        <button class="tool-btn" :disabled="imageInfo.currentPage <= 0" @click="prevPage">
          ←
        </button>
        <span class="page-info">{{ imageInfo.currentPage + 1 }} / {{ imageInfo.pages }}</span>
        <button class="tool-btn" :disabled="imageInfo.currentPage >= imageInfo.pages - 1" @click="nextPage">
          →
        </button>
      </div>
      <div v-if="imageInfo.width" class="image-info">
        {{ imageInfo.width }} × {{ imageInfo.height }} px
      </div>
      <div v-if="isLoading" class="loading">加载中...</div>
      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
    </div>

    <div
      ref="containerRef"
      class="canvas-container"
      @drop="onDrop"
      @dragover="onDragOver"
    >
      <div v-if="!imageInfo.width && !isLoading" class="drop-zone">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
        <p>拖拽 TIFF 文件到此处</p>
        <p class="hint">或点击上方「打开 TIFF」按钮</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tiff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-btn:hover:not(:disabled) {
  background: #475569;
  border-color: #64748b;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-info {
  font-size: 13px;
  color: #94a3b8;
  min-width: 60px;
  text-align: center;
}

.image-info {
  font-size: 12px;
  color: #64748b;
  margin-left: auto;
}

.loading {
  font-size: 12px;
  color: #6366f1;
}

.error {
  font-size: 12px;
  color: #ef4444;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.drop-zone {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #475569;
}

.drop-zone p {
  font-size: 16px;
  color: #64748b;
}

.drop-zone .hint {
  font-size: 13px;
  color: #475569;
}
</style>
