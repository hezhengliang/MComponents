<script setup lang="ts">
import { ref, computed } from 'vue'
import { min, max } from 'mathjs'

const ARRAY_LENGTH = 2000

const data = ref<number[]>([])
const mathDuration = ref<number>(0)
const nativeDuration = ref<number>(0)
const mathMin = ref<number | null>(null)
const mathMax = ref<number | null>(null)
const nativeMin = ref<number | null>(null)
const nativeMax = ref<number | null>(null)

const isReady = computed(() => data.value.length > 0)
const faster = computed(() => {
  if (!isReady.value) return null
  if (mathDuration.value < nativeDuration.value) return 'mathjs'
  if (nativeDuration.value < mathDuration.value) return '原生'
  return '持平'
})

function generateArray(): number[] {
  return Array.from({ length: ARRAY_LENGTH }, () => Math.random() * 1000)
}

function calculateStats() {
  const arr = generateArray()
  data.value = arr

  // mathjs：分别计算 min / max
  const mathStart = performance.now()
  mathMin.value = min(arr) as number
  mathMax.value = max(arr) as number
  mathDuration.value = performance.now() - mathStart

  // 原生：一次遍历同时得到 min / max
  const nativeStart = performance.now()
  let minVal = arr[0]
  let maxVal = arr[0]
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
  }
  nativeMin.value = minVal
  nativeMax.value = maxVal
  nativeDuration.value = performance.now() - nativeStart
}

// 初始化一次
calculateStats()
</script>

<template>
  <div class="mathjs-demo">
    <div class="toolbar">
      <h2>🧮 Math.js min/max 演示</h2>
      <button class="btn btn-primary" @click="calculateStats">
        重新生成
      </button>
    </div>

    <div class="content">
      <div class="card">
        <div class="row">
          <span class="label">数组长度</span>
          <span class="value">{{ ARRAY_LENGTH }}</span>
        </div>

        <div class="section-title">mathjs</div>
        <div class="row">
          <span class="label">min</span>
          <span class="value">{{ isReady ? mathMin?.toFixed(4) : '-' }}</span>
        </div>
        <div class="row">
          <span class="label">max</span>
          <span class="value">{{ isReady ? mathMax?.toFixed(4) : '-' }}</span>
        </div>
        <div class="row">
          <span class="label">耗时</span>
          <span class="value">{{ mathDuration.toFixed(3) }} ms</span>
        </div>

        <div class="section-title">原生（一次遍历）</div>
        <div class="row">
          <span class="label">min</span>
          <span class="value">{{ isReady ? nativeMin?.toFixed(4) : '-' }}</span>
        </div>
        <div class="row">
          <span class="label">max</span>
          <span class="value">{{ isReady ? nativeMax?.toFixed(4) : '-' }}</span>
        </div>
        <div class="row">
          <span class="label">耗时</span>
          <span class="value">{{ nativeDuration.toFixed(3) }} ms</span>
        </div>

        <div class="row summary">
          <span class="label">更快</span>
          <span class="value highlight">{{ faster ?? '-' }}</span>
        </div>
      </div>

      <div class="code-block">
        <h3>原生实现代码</h3>
        <pre v-pre><code>let minVal = arr[0]
let maxVal = arr[0]
for (let i = 1; i < arr.length; i++) {
  const v = arr[i]
  if (v < minVal) minVal = v
  if (v > maxVal) maxVal = v
}</code></pre>
      </div>

      <div class="preview">
        <h3>数组前 20 项预览</h3>
        <div class="list">
          <span v-for="(num, idx) in data.slice(0, 20)" :key="idx" class="item">
            {{ num.toFixed(2) }}
          </span>
          <span v-if="data.length > 20" class="item ellipsis">...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mathjs-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
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

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.row:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  margin-top: 16px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e0f2fe;
}

.section-title:first-of-type {
  margin-top: 0;
}

.row.summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 2px solid #f0f0f0;
  border-bottom: none;
}

.label {
  color: #666;
  font-size: 14px;
}

.value {
  color: #333;
  font-weight: 600;
  font-size: 14px;
  font-family: monospace;
}

.value.highlight {
  color: #ea580c;
  font-size: 16px;
}

.preview {
  margin-top: 24px;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.code-block {
  margin-top: 24px;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.code-block h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
}

.code-block pre {
  background: #1e1e2e;
  color: #a6e3a1;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Fira Code', monospace;
}

.code-block code {
  font-family: inherit;
}

.preview h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
}

.list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.item {
  background: #f0f9ff;
  color: #0369a1;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
}

.ellipsis {
  background: transparent;
  color: #999;
}
</style>
