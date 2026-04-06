<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Pane } from 'tweakpane'
import type { WaferMapData, WaferStats } from '../../core/wafer'

export type TitlePosition = 'top' | 'bottom' | 'left' | 'right'

export interface ToolbarConfig {
  showGrid: boolean
  showNotch: boolean
  showTitles: boolean
  titlePosition: TitlePosition
  dieGap: number
  zoom: number
  passRate: number
  columns: number
}

interface Props {
  config: ToolbarConfig
  waferData?: WaferMapData | null
  stats?: WaferStats | null
  mode?: 'single' | 'multi'
}

const props = withDefaults(defineProps<Props>(), {
  waferData: null,
  stats: null,
  mode: 'single',
})

const emit = defineEmits<{
  (e: 'update:config', config: ToolbarConfig): void
  (e: 'generate'): void
  (e: 'resetView'): void
  (e: 'export'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pane: any = null

// 本地配置状态 - 使用独立的 ref
const localConfig = ref<ToolbarConfig>({
  showGrid: true,
  showNotch: true,
  showTitles: true,
  titlePosition: 'top',
  dieGap: 0.5,
  zoom: 100,
  passRate: 0.85,
  columns: 5,
})

// Pane 状态标志
const isPaneReady = ref(false)

// 同步外部配置到本地
watch(() => props.config, (newConfig) => {
  if (newConfig && !isPaneReady.value) {
    localConfig.value = { ...newConfig }
  }
}, { immediate: true, deep: true })

// 当本地配置变化时通知父组件
function onConfigChange(): void {
  if (!isPaneReady.value) return
  emit('update:config', { ...localConfig.value })
}

function initPane(): void {
  if (!containerRef.value) return
  
  // 标记 pane 未就绪
  isPaneReady.value = false

  // 清理旧的 pane
  if (pane) {
    pane.dispose()
    pane = null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane = new Pane({
      container: containerRef.value,
      title: 'Controls',
    } as any)

    // === 显示选项 ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addBinding(localConfig.value, 'showGrid', { 
      label: 'Show Grid',
    }).on('change', onConfigChange)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addBinding(localConfig.value, 'showNotch', { 
      label: 'Show Notch',
    }).on('change', onConfigChange)
    
    if (props.mode === 'multi') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(localConfig.value, 'showTitles', { 
        label: 'Show Titles',
      }).on('change', onConfigChange)
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(localConfig.value, 'titlePosition', {
        label: 'Title Position',
        options: {
          Top: 'top',
          Bottom: 'bottom',
          Left: 'left',
          Right: 'right',
        },
      }).on('change', onConfigChange)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addBinding(localConfig.value, 'dieGap', {
      label: 'Die Gap',
      min: 0,
      max: 3,
      step: 0.1,
    }).on('change', onConfigChange)

    // === 视图控制 ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addBinding(localConfig.value, 'zoom', {
      label: 'Zoom %',
      min: 50,
      max: 1000,
      step: 10,
    }).on('change', onConfigChange)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addButton({ title: 'Reset View' }).on('click', () => {
      localConfig.value.zoom = 100
      onConfigChange()
      emit('resetView')
    })

    // === 多 wafer 配置 ===
    if (props.mode === 'multi') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(localConfig.value, 'columns', {
        label: 'Columns',
        min: 1,
        max: 10,
        step: 1,
      }).on('change', onConfigChange)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(localConfig.value, 'passRate', {
        label: 'Pass Rate',
        min: 0.5,
        max: 0.98,
        step: 0.05,
      }).on('change', onConfigChange)
    }

    // === 数据操作 ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addButton({ title: 'Generate New Data' }).on('click', () => {
      emit('generate')
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pane.addButton({ title: 'Export Data' }).on('click', () => {
      emit('export')
    })

    // === Wafer 信息 ===
    if (props.waferData) {
      const infoParams = {
        waferId: props.waferData.waferId,
        lotId: props.waferData.lotId,
        diameter: `${props.waferData.config.diameter} mm`,
        dieSize: `${props.waferData.config.dieSize} mm`,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(infoParams, 'waferId', { label: 'Wafer ID', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(infoParams, 'lotId', { label: 'Lot ID', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(infoParams, 'diameter', { label: 'Diameter', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(infoParams, 'dieSize', { label: 'Die Size', readonly: true })
    }

    // === 统计信息 ===
    if (props.stats) {
      const statsParams = {
        totalDies: props.stats.totalDies,
        goodDies: props.stats.goodDies,
        badDies: props.stats.badDies,
        yield: `${props.stats.yield}%`,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(statsParams, 'totalDies', { label: 'Total Dies', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(statsParams, 'goodDies', { label: 'Good Dies', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(statsParams, 'badDies', { label: 'Bad Dies', readonly: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pane.addBinding(statsParams, 'yield', { label: 'Yield', readonly: true })
    }
  } catch {
    // ignore
  }
  
  // 标记 pane 已就绪
  isPaneReady.value = true
}

// 刷新 pane（当数据变化时）
function refresh(): void {
  // 避免在 pane 销毁时更新
  if (!isPaneReady.value) return
  initPane()
}

defineExpose({
  refresh,
})

onMounted(() => {
  // 延迟初始化确保 DOM 准备好
  setTimeout(() => {
    initPane()
  }, 0)
})

onUnmounted(() => {
  isPaneReady.value = false
  if (pane) {
    pane.dispose()
    pane = null
  }
})
</script>

<template>
  <div ref="containerRef" class="wafer-toolbar" />
</template>

<style scoped>
.wafer-toolbar {
  width: 280px;
  min-width: 280px;
  height: 100%;
  overflow-y: auto;
  background: #f5f5f5;
}

/* Tweakpane 样式覆盖 */
:deep(.tp-dfwv) {
  width: 280px !important;
}

:deep(.tp-rotv) {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.tp-lblv_l) {
  color: #555;
}

:deep(.tp-btnv_b) {
  background: #2196f3;
  color: white;
}

:deep(.tp-btnv_b:hover) {
  background: #1976d2;
}
</style>
