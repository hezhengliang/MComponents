<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSvgConnections } from '../hooks/useSvgConnections'
import { useWaferChipDetails } from '../hooks/useWaferChipDetails'

const canvasRef = ref<HTMLDivElement>()
const waferRef = ref<HTMLDivElement>()

const svgHook = useSvgConnections(canvasRef)
const chipHook = useWaferChipDetails(waferRef)

chipHook.setNotifyUpdate(() => {
  const pairs = chipHook.getConnectionPairs()
  const pairIds = new Set(pairs.map(p => p.id))

  // 删除不再需要的 path
  for (const id of svgHook.getIds()) {
    if (!pairIds.has(id)) {
      svgHook.remove(id)
    }
  }

  // 创建新的 path
  for (const pair of pairs) {
    svgHook.create(pair.id)
  }

  // 更新所有连线
  svgHook.updateAll(pairs)
})

onMounted(() => {
  chipHook.init()
  svgHook.init()
})

// 解构响应式数据供模板直接使用（避免 Vue 模板类型推断问题）
const { dieMarkers, chipDetails, setMarkerRef, setDetailRef, getDiePosition, removeDetail, clearAll } = chipHook

function getBinName(bin: number): string {
  const map: Record<number, string> = {
    0: 'Empty',
    1: 'Pass',
    2: 'Open',
    3: 'Short',
    4: 'Param',
    5: 'Leakage',
  }
  return map[bin] ?? `Bin ${bin}`
}

function getBinColor(bin: number): string {
  const map: Record<number, string> = {
    0: '#2a2a3e',
    1: '#4caf50',
    2: '#f44336',
    3: '#ff9800',
    4: '#9c27b0',
    5: '#2196f3',
  }
  return map[bin] ?? '#999'
}
</script>

<template>
  <div class="svg-demo">
    <div class="toolbar">
      <h3>🔌 Die → Chip Detail 连线</h3>
      <div class="toolbar-actions">
        <span class="hint">点击 wafer 上的 die 创建 Chip Detail</span>
        <button class="clear-btn" @click="clearAll">清除全部</button>
      </div>
    </div>
    <div ref="canvasRef" class="canvas">
      <!-- wafer + anchor markers 在同一坐标系下 -->
      <div class="wafer-area">
        <div ref="waferRef" class="wafer-container"></div>
        <div
          v-for="marker in dieMarkers"
          :key="marker.dieKey"
          :ref="(el) => setMarkerRef(el, marker.dieKey)"
          class="die-marker"
          :style="{
            left: `${getDiePosition(marker.die).x}px`,
            top: `${getDiePosition(marker.die).y}px`,
          }"
        ></div>
      </div>

      <!-- chip details -->
      <div
        v-for="detail in chipDetails"
        :key="detail.id"
        :ref="(el) => setDetailRef(el, detail.id)"
        class="chip-detail"
      >
        <div class="detail-header">
          <span class="detail-id">{{ detail.id.slice(0, 4) }}</span>
          <button class="close-btn" @click="removeDetail(detail.id)">×</button>
        </div>
        <div class="detail-body">
          <div class="image-wrapper">
            <img
              class="detail-image"
              :src="`https://picsum.photos/seed/${detail.die.x}-${detail.die.y}/180/80`"
              alt="chip"
            />
          </div>
          <div class="detail-row">
            <span class="detail-label">X:</span>
            <span class="detail-value">{{ detail.die.x }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Y:</span>
            <span class="detail-value">{{ detail.die.y }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Bin:</span>
            <span
              class="detail-value bin-badge"
              :style="{ background: getBinColor(detail.die.bin), color: '#fff' }"
            >
              {{ detail.die.bin }} — {{ getBinName(detail.die.bin) }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span
              class="detail-value"
              :style="{
                color: detail.die.bin === 1 ? '#4caf50' : '#f44336',
                fontWeight: 600,
              }"
            >
              {{ detail.die.bin === 1 ? '✅ Pass' : '❌ Fail' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.svg-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hint {
  font-size: 13px;
  color: #94a3b8;
}

.clear-btn {
  padding: 6px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.clear-btn:hover {
  background: #dc2626;
}

.canvas {
  flex: 1;
  position: relative;
  padding: 20px;
  overflow: hidden;
}

.wafer-area {
  position: absolute;
  left: 40px;
  top: 60px;
  width: 360px;
  height: 360px;
  z-index: 1;
}

.wafer-container {
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
}

/* 纯锚点，无任何视觉样式 */
.die-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.chip-detail {
  position: absolute;
  min-width: 160px;
  min-height: 140px;
  padding: 12px 14px;
  background: #dbeafe;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  font-size: 12px;
  color: #1e40af;
  cursor: grab;
  user-select: none;
  z-index: 5;
}

.chip-detail:active {
  cursor: grabbing;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.detail-id {
  font-size: 13px;
  font-weight: 600;
}

.close-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #ef4444;
}

.image-wrapper {
  resize: both;
  overflow: hidden;
  width: 170px;
  height: 80px;
  min-width: 100px;
  min-height: 40px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.detail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.detail-label {
  color: #64748b;
  min-width: 44px;
  font-weight: 500;
}

.detail-value {
  font-weight: 500;
}

.bin-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}
</style>
