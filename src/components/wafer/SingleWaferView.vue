<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { WaferRenderer, generateWaferData, type WaferStats, type WaferMapData } from '../../core/wafer'
import WaferToolbar, { type ToolbarConfig } from './WaferToolbar.vue'

// 引用
const canvasRef = ref<HTMLDivElement | null>(null)
const toolbarRef = ref<InstanceType<typeof WaferToolbar> | null>(null)

let renderer: WaferRenderer | null = null

// 状态
const waferData = ref<WaferMapData | null>(null)
const stats = ref<WaferStats | null>(null)

// 配置
const config = ref<ToolbarConfig>({
  showGrid: true,
  showNotch: true,
  showTitles: true,
  titlePosition: 'top',
  dieGap: 1,
  zoom: 100,
  passRate: 0.85,
  columns: 5,
})

// 处理配置更新
function handleConfigUpdate(newConfig: ToolbarConfig): void {
  config.value = newConfig

  // 应用显示选项
  if (renderer) {
    renderer.updateOptions({
      showGrid: newConfig.showGrid,
      showNotch: newConfig.showNotch,
      dieGap: newConfig.dieGap,
    })
  }

  // 应用缩放
  const canvas = canvasRef.value?.querySelector('canvas')
  if (canvas) {
    canvas.style.transform = `scale(${newConfig.zoom / 100})`
    canvas.style.transformOrigin = 'center center'
  }
}

// 生成新数据
function generateNewData(): void {
  const data = generateWaferData(
    `W${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
    `L${Date.now()}`,
    { diameter: 200, dieSize: 5, edgeExclusion: 5, passRate: 0.85 }
  )
  
  waferData.value = data
  renderer?.updateData(data)
  
  setTimeout(() => toolbarRef.value?.refresh(), 100)
}

// 重置视图
function resetView(): void {
  config.value.zoom = 100
  const canvas = canvasRef.value?.querySelector('canvas')
  if (canvas) {
    canvas.style.transform = 'scale(1)'
  }
}

// 导出数据
function exportData(): void {
  if (!waferData.value || !stats.value) return
  const blob = new Blob([JSON.stringify({ wafer: waferData.value, stats: stats.value }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${waferData.value.waferId}_data.json`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  if (!canvasRef.value) return

  const data = generateWaferData('W001', 'L202403001')
  waferData.value = data

  renderer = new WaferRenderer(canvasRef.value, data, {
    width: 600,
    height: 600,
    showGrid: config.value.showGrid,
    showNotch: config.value.showNotch,
    dieGap: config.value.dieGap,
    tooltip: { enabled: true, placement: 'top', showArrow: true },
  })

  renderer.on('stats-update', (newStats) => {
    stats.value = newStats
    toolbarRef.value?.refresh()
  })
})

onUnmounted(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <div class="single-wafer-view">
    <div class="main-content">
      <div class="canvas-wrapper">
        <div ref="canvasRef" class="canvas-container" />
      </div>
      
      <div class="toolbar-container">
        <WaferToolbar
          ref="toolbarRef"
          :config="config"
          :wafer-data="waferData"
          :stats="stats"
          mode="single"
          @update:config="handleConfigUpdate"
          @generate="generateNewData"
          @reset-view="resetView"
          @export="exportData"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.single-wafer-view {
  width: 100%;
  height: 100%;
}

.main-content {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
  padding: 16px;
}

.canvas-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.canvas-container {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.toolbar-container {
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}

:global(.wafer-tooltip) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

:global(.wafer-tooltip-content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:global(.tooltip-wafer-info) {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

:global(.tooltip-row) {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

:global(.tooltip-label) {
  color: #aaa;
  font-size: 12px;
}

:global(.tooltip-value) {
  color: #fff;
  font-weight: 500;
  font-size: 12px;
}
</style>
