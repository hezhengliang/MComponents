<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { initLargeDataDemo, generateLargeDataset } from './large-data-demo'

const containerRef = ref<HTMLElement | null>(null)
const status = ref('点击按钮开始')
const isRunning = ref(false)
const cleanup = ref<(() => void) | null>(null)

async function startDemo() {
  if (isRunning.value) return
  
  isRunning.value = true
  status.value = '初始化...'
  
  // 等待 DOM 更新完成
  await new Promise(resolve => setTimeout(resolve, 50))
  
  if (!containerRef.value) {
    status.value = '错误: 容器未就绪'
    isRunning.value = false
    return
  }
  
  try {
    cleanup.value = await initLargeDataDemo(
      containerRef.value,
      (newStatus) => {
        status.value = newStatus
      }
    )
  } catch (error) {
    status.value = `错误: ${error}`
    isRunning.value = false
  }
}

function stopDemo() {
  // 先隐藏渲染容器
  isRunning.value = false
  
  // 再清理渲染器
  if (cleanup.value) {
    cleanup.value()
    cleanup.value = null
  }
  
  status.value = '已停止'
}

// 预生成数据测试
function testDataGeneration() {
  console.time('generate-data')
  const data = generateLargeDataset(10) // 10万 die
  console.timeEnd('generate-data')
  console.log('Generated data:', data.length, 'wafers')
}

onUnmounted(() => {
  stopDemo()
})
</script>

<template>
  <div class="large-data-example">
    <div class="toolbar">
      <h2>🚀 大数据量渲染测试 (100万+ dies)</h2>
      <div class="controls">
        <button 
          @click="startDemo" 
          :disabled="isRunning"
          class="btn btn-primary"
        >
          {{ isRunning ? '渲染中...' : '开始渲染' }}
        </button>
        <button 
          @click="stopDemo" 
          :disabled="!isRunning"
          class="btn btn-secondary"
        >
          停止
        </button>
        <button @click="testDataGeneration" class="btn btn-ghost">
          测试数据生成
        </button>
      </div>
      <div class="status">状态: {{ status }}</div>
    </div>
    
    <div class="container">
      <div v-if="!isRunning" class="placeholder">
        <div class="placeholder-content">
          <div class="icon">📊</div>
          <h3>100万+ Die 渲染演示</h3>
          <p>点击下方"开始渲染"按钮测试大数据量性能</p>
          <div class="specs">
            <div class="spec-item">
              <span class="spec-label">Wafer数量:</span>
              <span class="spec-value">100</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">每Wafer Dies:</span>
              <span class="spec-value">10,000</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">总Die数:</span>
              <span class="spec-value highlight">1,000,000</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">优化特性:</span>
              <span class="spec-value">渐进渲染 + Web Worker</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 渲染目标容器 - 非 Vue 管理 -->
      <div v-show="isRunning" ref="containerRef" class="render-container"></div>
    </div>
  </div>
</template>

<style scoped>
.large-data-example {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.toolbar {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.toolbar h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.controls {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #ef4444;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #dc2626;
}

.btn-ghost {
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
}

.btn-ghost:hover {
  background: #f5f5f5;
}

.status {
  margin-left: auto;
  font-size: 14px;
  color: #666;
  font-family: monospace;
}

.container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.render-container {
  width: 100%;
  height: 100%;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.placeholder-content {
  text-align: center;
  max-width: 500px;
}

.icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.placeholder h3 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: #333;
}

.placeholder p {
  margin: 0 0 32px 0;
  color: #666;
  font-size: 14px;
}

.specs {
  background: #fafafa;
  border-radius: 12px;
  padding: 24px;
  text-align: left;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.spec-item:last-child {
  border-bottom: none;
}

.spec-label {
  color: #666;
  font-size: 14px;
}

.spec-value {
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

.spec-value.highlight {
  color: #3b82f6;
  font-size: 18px;
}
</style>
