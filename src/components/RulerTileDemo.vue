<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  TileImageViewer,
  CanvasTileProvider,
  ImageTileProvider,
  FileTileProvider,
} from '../core/tile'
import type { TileProvider } from '../core/tile'

const containerRef = ref<HTMLDivElement | null>(null)
const viewerRef = ref<TileImageViewer | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 状态
const zoom = ref(100)
const mousePos = ref({ x: 0, y: 0 })
const showRuler = ref(true)
const showGrid = ref(true)
const debug = ref(false)
const imageSize = ref({ width: 1460, height: 13520 })
const isLoading = ref(false)
const loadError = ref('')

// 图片加载
const imageUrl = ref('')
const currentProvider = ref<'test' | 'url' | 'file'>('test')
const currentFileName = ref('')

// 监听鼠标位置
const handleMouseMove = (e: MouseEvent) => {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const x = e.clientX - rect.left - (showRuler.value ? 24 : 0)
  const y = e.clientY - rect.top - (showRuler.value ? 24 : 0)

  if (viewerRef.value) {
    const transform = viewerRef.value.getTransform()
    const worldX = Math.round((x - transform.offsetX) / transform.scale)
    const worldY = Math.round((y - transform.offsetY) / transform.scale)
    mousePos.value = { x: worldX, y: worldY }
  }
}

onMounted(() => {
  if (!containerRef.value) return

  // 延迟初始化，确保 DOM 布局已完成
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initViewer()
      containerRef.value?.addEventListener('mousemove', handleMouseMove)
    })
  })
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('mousemove', handleMouseMove)
  viewerRef.value?.destroy()
  viewerRef.value = null
})

async function initViewer(provider?: TileProvider, retry = 0): Promise<void> {
  if (!containerRef.value) return

  const container = containerRef.value
  const rect = container.getBoundingClientRect()

  // 如果容器高度太小，延迟重试（最多重试 5 次）
  if (rect.height < 100 && retry < 5) {
    setTimeout(() => initViewer(provider, retry + 1), 100)
    return
  }

  loadError.value = ''
  isLoading.value = true

  // 先销毁旧的
  if (viewerRef.value) {
    viewerRef.value.destroy()
    viewerRef.value = null
  }

  let tileProvider = provider
  let actualWidth = imageSize.value.width
  let actualHeight = imageSize.value.height

  // 如果是 ImageTileProvider，等待图片加载并获取真实尺寸
  if (tileProvider instanceof ImageTileProvider) {
    try {
      await tileProvider.ready()
      const dims = tileProvider.dimensions
      actualWidth = dims.width
      actualHeight = dims.height
      imageSize.value = { width: actualWidth, height: actualHeight }
    } catch (err) {
      loadError.value = `图片加载失败: ${err instanceof Error ? err.message : String(err)}`
      isLoading.value = false
      return
    }
  }

  // 如果没有传入 provider，使用默认测试瓦片
  if (!tileProvider) {
    tileProvider = new CanvasTileProvider(actualWidth, actualHeight, 256)
  }

  viewerRef.value = new TileImageViewer(container, {
    width: rect.width,
    height: rect.height,
    imageWidth: actualWidth,
    imageHeight: actualHeight,
    tileSize: 256,
    minZoom: 0.01,
    maxZoom: 1.28,
    initialZoom: 1.28,
    enableRuler: showRuler.value,
    rulerOptions: {
      size: 24,
      unit: 'mm',
      pixelPerUnit: 1,
      showCrosshair: true,
      backgroundColor: '#2b2b2b',
      tickColor: '#888888',
      textColor: '#cccccc',
      highlightColor: '#ff6b6b',
    },
    showGrid: showGrid.value,
    debug: debug.value,
    tileProvider,
    onZoomChange: (z: number) => {
      zoom.value = Math.round(z * 100)
    },
  })

  isLoading.value = false

  // 初始以最大缩放显示，左上角对齐
  setTimeout(() => {
    if (viewerRef.value) {
      viewerRef.value.resetView()
      updateZoomDisplay()
    }
  }, 50)
}

/** 加载图片 URL */
async function loadImageUrl(): Promise<void> {
  const url = imageUrl.value.trim()
  if (!url) {
    loadError.value = '请输入图片 URL'
    return
  }
  currentProvider.value = 'url'
  currentFileName.value = ''
  const provider = new ImageTileProvider(url, 256)
  await initViewer(provider)
}

/** 触发文件选择 */
function triggerFileSelect(): void {
  fileInputRef.value?.click()
}

/** 处理文件选择 */
async function handleFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  currentProvider.value = 'file'
  currentFileName.value = file.name
  const provider = new FileTileProvider(file, 256)
  await initViewer(provider)

  // 清空 input，允许再次选择同一文件
  target.value = ''
}

/** 切换回测试瓦片 */
function switchToTestTiles(): void {
  currentProvider.value = 'test'
  currentFileName.value = ''
  imageUrl.value = ''
  imageSize.value = { width: 1460, height: 13520 }
  initViewer()
}

function handleZoomIn(): void {
  if (!viewerRef.value) return
  const newZoom = viewerRef.value.getZoom() * 1.25
  viewerRef.value.setZoom(newZoom)
  updateZoomDisplay()
}

function handleZoomOut(): void {
  if (!viewerRef.value) return
  const newZoom = viewerRef.value.getZoom() * 0.8
  viewerRef.value.setZoom(newZoom)
  updateZoomDisplay()
}

function handleFitToView(): void {
  viewerRef.value?.fitToView()
  updateZoomDisplay()
}

function handleReset(): void {
  viewerRef.value?.resetView()
  updateZoomDisplay()
}

function handleZoomChange(): void {
  if (!viewerRef.value) return
  viewerRef.value.setZoom(zoom.value / 100)
}

function updateZoomDisplay(): void {
  if (!viewerRef.value) return
  zoom.value = Math.round(viewerRef.value.getZoom() * 100)
}

function toggleRuler(): void {
  showRuler.value = !showRuler.value
  initViewer()
}

function toggleGrid(): void {
  showGrid.value = !showGrid.value
  initViewer()
}

function toggleDebug(): void {
  debug.value = !debug.value
  initViewer()
}

function setImageSize(w: number, h: number): void {
  imageSize.value = { width: w, height: h }
  currentProvider.value = 'test'
  currentFileName.value = ''
  initViewer()
}
</script>

<template>
  <div class="ruler-tile-demo">
    <!-- 工具栏 -->
    <div class="toolbar">
      <!-- 缩放控制 -->
      <div class="toolbar-group">
        <span class="toolbar-label">缩放:</span>
        <button class="btn-icon" @click="handleZoomOut" title="缩小">−</button>
        <input
          v-model.number="zoom"
          type="number"
          class="zoom-input"
          min="5"
          max="2000"
          @change="handleZoomChange"
        />
        <span class="zoom-unit">%</span>
        <button class="btn-icon" @click="handleZoomIn" title="放大">+</button>
      </div>

      <!-- 视图操作 -->
      <div class="toolbar-group">
        <button class="btn" @click="handleFitToView">
          <span>⬜</span> 适应窗口
        </button>
        <button class="btn" @click="handleReset">
          <span>↺</span> 重置
        </button>
      </div>

      <!-- 显示选项 -->
      <div class="toolbar-group">
        <button class="btn" :class="{ active: showRuler }" @click="toggleRuler">
          📏 标尺
        </button>
        <button class="btn" :class="{ active: showGrid }" @click="toggleGrid">
          ⊞ 网格
        </button>
        <button class="btn" :class="{ active: debug }" @click="toggleDebug">
          🐛 调试
        </button>
      </div>

      <!-- 测试瓦片尺寸 -->
      <div class="toolbar-group">
        <span class="toolbar-label">测试瓦片:</span>
        <button class="btn" :class="{ active: currentProvider === 'test' && imageSize.width === 2048 }" @click="setImageSize(2048, 2048)">2K</button>
        <button class="btn" :class="{ active: currentProvider === 'test' && imageSize.width === 1460 }" @click="setImageSize(1460, 13520)">1460×13520</button>
        <button class="btn" :class="{ active: currentProvider === 'test' && imageSize.width === 4096 }" @click="setImageSize(4096, 4096)">4K</button>
        <button class="btn" :class="{ active: currentProvider === 'test' && imageSize.width === 8192 }" @click="setImageSize(8192, 8192)">8K</button>
        <button class="btn" :class="{ active: currentProvider === 'test' }" @click="switchToTestTiles">
          🎨 彩色测试
        </button>
      </div>
    </div>

    <!-- 图片加载栏 -->
    <div class="toolbar image-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">图片 URL:</span>
        <input
          v-model="imageUrl"
          type="text"
          class="url-input"
          placeholder="输入图片地址，如 https://example.com/image.jpg"
          @keydown.enter="loadImageUrl"
        />
        <button class="btn" @click="loadImageUrl">
          🌐 加载
        </button>
      </div>

      <div class="toolbar-group">
        <span class="toolbar-label">或</span>
        <button class="btn" @click="triggerFileSelect">
          📁 选择本地图片
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileChange"
        />
      </div>

      <div v-if="currentFileName" class="file-tag">
        📄 {{ currentFileName }}
      </div>
      <div v-else-if="currentProvider === 'url' && imageUrl" class="file-tag">
        🌐 {{ imageUrl.length > 30 ? imageUrl.slice(0, 30) + '...' : imageUrl }}
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="loadError" class="error-bar">
      ⚠️ {{ loadError }}
    </div>

    <!-- 主画布区 -->
    <div class="viewer-wrapper">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>加载中...</span>
      </div>
      <div ref="containerRef" class="viewer-container" />
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span>位置: {{ mousePos.x }}, {{ mousePos.y }}</span>
      <span>图像: {{ imageSize.width }}×{{ imageSize.height }}</span>
      <span>来源: {{ currentProvider === 'test' ? '测试瓦片' : currentProvider === 'url' ? '网络图片' : '本地文件' }}</span>
    </div>
  </div>
</template>

<style scoped>
.ruler-tile-demo {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  color: #ccc;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #252538;
  border-bottom: 1px solid #333355;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.image-toolbar {
  background: #1e1e32;
  border-bottom-color: #2a2a45;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid #444466;
  background: #1e1e32;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn:hover {
  background: #2a2a45;
  border-color: #555577;
}

.btn.active {
  background: #3b3b6b;
  border-color: #6666aa;
  color: #fff;
}

.btn-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #444466;
  background: #1e1e32;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  padding: 0;
}

.btn-icon:hover {
  background: #2a2a45;
}

.zoom-input {
  width: 56px;
  padding: 4px 6px;
  border: 1px solid #444466;
  background: #1e1e32;
  color: #ccc;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
}

.url-input {
  width: 280px;
  padding: 5px 10px;
  border: 1px solid #444466;
  background: #1e1e32;
  color: #ccc;
  border-radius: 4px;
  font-size: 12px;
}

.url-input::placeholder {
  color: #666;
}

.zoom-unit {
  font-size: 12px;
  color: #888;
}

.file-tag {
  font-size: 12px;
  color: #aaa;
  background: #2a2a45;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #444466;
}

.error-bar {
  padding: 8px 16px;
  background: #3d1f1f;
  color: #ff9999;
  font-size: 13px;
  border-bottom: 1px solid #552222;
  flex-shrink: 0;
}

.viewer-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.viewer-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(26, 26, 46, 0.85);
  z-index: 100;
  font-size: 14px;
  color: #aaa;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333355;
  border-top-color: #6666aa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 6px 16px;
  background: #252538;
  border-top: 1px solid #333355;
  flex-shrink: 0;
  font-size: 12px;
  color: #888;
  font-family: monospace;
}

/* 覆盖 leafer 默认样式 */
:deep(.tile-viewer-content) {
  position: absolute !important;
}
</style>
