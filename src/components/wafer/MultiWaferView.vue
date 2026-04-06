<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { MultiWaferRenderer, generateLotData, type WaferStats, type WaferMapData } from '../../core/wafer'
import WaferToolbar, { type ToolbarConfig } from './WaferToolbar.vue'

// 引用
const canvasRef = ref<HTMLDivElement | null>(null)
const toolbarRef = ref<InstanceType<typeof WaferToolbar> | null>(null)

let renderer: MultiWaferRenderer | null = null

// 状态
const waferDataList = ref<WaferMapData[]>([])
const stats = ref<WaferStats | null>(null)
const isLoading = ref(false)

// 配置
const config = ref<ToolbarConfig>({
  showGrid: true,
  showNotch: true,
  showTitles: true,
  titlePosition: 'top',
  dieGap: 0.5,
  zoom: 100,
  passRate: 0.85,
  columns: 5,
})

const selectedWafer = ref<WaferMapData | null>(null)

// 初始化渲染
async function initRender(): Promise<void> {
  if (!canvasRef.value) return
  
  isLoading.value = true
  await nextTick()

  // 生成数据
  const dataList = generateLotData('LOT001', 25, {
    diameter: 200,
    dieSize: 5,
    edgeExclusion: 5,
    passRate: config.value.passRate,
  })
  
  waferDataList.value = dataList
  selectedWafer.value = dataList[0] ?? null

  // 创建渲染器
  renderer = new MultiWaferRenderer(canvasRef.value, {
    width: 0,
    height: 0,
    grid: {
      columns: config.value.columns,
      gapX: 20,
      gapY: 40,
      padding: 40,
    },
    showTitles: config.value.showTitles,
    titlePosition: config.value.titlePosition,
    showGrid: config.value.showGrid,
    showNotch: config.value.showNotch,
    dieGap: config.value.dieGap,
    enableZoom: true,
    minZoom: 0.5,
    maxZoom: 10,
    initialZoom: 1,
    tooltip: {
      enabled: true,
      placement: 'top',
      showArrow: true,
      delayShow: 0,
    },
  })

  renderer.on('stats-update', (newStats) => {
    stats.value = newStats
    toolbarRef.value?.refresh()
  })

  renderer.render(dataList)
  isLoading.value = false
}

// 处理配置更新
function handleConfigUpdate(newConfig: ToolbarConfig): void {
  const oldConfig = { ...config.value }
  config.value = newConfig

  // 检查是否需要重新渲染
  const needsRerender = (
    oldConfig.showGrid !== newConfig.showGrid ||
    oldConfig.showNotch !== newConfig.showNotch ||
    oldConfig.showTitles !== newConfig.showTitles ||
    oldConfig.titlePosition !== newConfig.titlePosition ||
    oldConfig.dieGap !== newConfig.dieGap ||
    oldConfig.columns !== newConfig.columns
  )

  if (needsRerender && renderer) {
    renderer.updateOptions({
      showGrid: newConfig.showGrid,
      showNotch: newConfig.showNotch,
      showTitles: newConfig.showTitles,
      titlePosition: newConfig.titlePosition,
      dieGap: newConfig.dieGap,
      grid: {
        columns: newConfig.columns,
        gapX: 20,
        gapY: 40,
        padding: 40,
      },
    })
    renderer.render(waferDataList.value)
  }

  // 应用缩放
  if (oldConfig.zoom !== newConfig.zoom && renderer) {
    renderer.setZoom(newConfig.zoom / 100)
  }
}

// 生成新数据
function generateNewData(): void {
  // 使用新的 passRate 重新生成
  initRender()
}

// 重置视图
function resetView(): void {
  config.value.zoom = 100
  renderer?.resetView()
}

// 导出数据
function exportData(): void {
  if (!waferDataList.value.length || !stats.value) return
  const blob = new Blob([JSON.stringify({ wafers: waferDataList.value, stats: stats.value }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lot_${waferDataList.value[0]?.lotId}_data.json`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  initRender()
})

onUnmounted(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <div class="multi-wafer-view">
    <div class="main-content">
      <div ref="canvasRef" class="canvas-wrapper">
        <div v-if="isLoading" class="loading">Loading...</div>
      </div>
      
      <div class="toolbar-container">
        <WaferToolbar
          ref="toolbarRef"
          :config="config"
          :wafer-data="selectedWafer"
          :stats="stats"
          mode="multi"
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
.multi-wafer-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
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
  min-height: 0;
  background: #fafafa;
  border-radius: 8px;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #666;
}

.toolbar-container {
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}
</style>
