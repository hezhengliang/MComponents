<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import RBush from 'rbush'

interface RectItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
  color: string
}

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLElement>()

const width = 800
const height = 600
const itemCount = 200

// 所有矩形
const items = ref<RectItem[]>([])
const selectedIds = ref<Set<string>>(new Set())

// R-tree 索引
const rtree = ref<RBush<RectItem>>(new RBush())

// 框选状态
const isSelecting = ref(false)
const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })

// 生成随机矩形
const generateItems = () => {
  const newItems: RectItem[] = []
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
  
  for (let i = 0; i < itemCount; i++) {
    const w = 30 + Math.random() * 50
    const h = 20 + Math.random() * 40
    const x = Math.random() * (width - w)
    const y = Math.random() * (height - h)
    
    newItems.push({
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      id: `item-${i}`,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
  
  items.value = newItems
  rtree.value.clear()
  rtree.value.load(newItems)
  selectedIds.value.clear()
}

// 绘制
const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 清空画布
  ctx.fillStyle = '#f5f7fa'
  ctx.fillRect(0, 0, width, height)
  
  // 绘制网格
  ctx.strokeStyle = '#e4e7ed'
  ctx.lineWidth = 1
  for (let i = 0; i < width; i += 50) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, height)
    ctx.stroke()
  }
  for (let i = 0; i < height; i += 50) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(width, i)
    ctx.stroke()
  }
  
  // 绘制所有矩形
  items.value.forEach((item) => {
    const isSelected = selectedIds.value.has(item.id)
    
    ctx.fillStyle = isSelected ? item.color : item.color + '60'
    ctx.fillRect(item.minX, item.minY, item.maxX - item.minX, item.maxY - item.minY)
    
    ctx.strokeStyle = isSelected ? '#000' : item.color
    ctx.lineWidth = isSelected ? 2 : 1
    ctx.strokeRect(item.minX, item.minY, item.maxX - item.minX, item.maxY - item.minY)
    
    // 绘制ID
    ctx.fillStyle = '#fff'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(
      item.id.split('-')[1],
      (item.minX + item.maxX) / 2,
      (item.minY + item.maxY) / 2 + 3
    )
  })
  
  // 绘制选择框
  if (isSelecting.value) {
    ctx.strokeStyle = '#409eff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(
      selectionBox.value.x,
      selectionBox.value.y,
      selectionBox.value.width,
      selectionBox.value.height
    )
    ctx.setLineDash([])
    
    ctx.fillStyle = 'rgba(64, 158, 255, 0.1)'
    ctx.fillRect(
      selectionBox.value.x,
      selectionBox.value.y,
      selectionBox.value.width,
      selectionBox.value.height
    )
  }
}

// 鼠标事件
const onMouseDown = (e: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  isSelecting.value = true
  selectionBox.value = { x, y, width: 0, height: 0 }
  
  // 检查是否点击了某个矩形
  const clicked = rtree.value.search({
    minX: x - 5,
    minY: y - 5,
    maxX: x + 5,
    maxY: y + 5,
  })
  
  if (clicked.length > 0) {
    // 点击选择/取消选择
    const id = clicked[0].id
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
    isSelecting.value = false
    draw()
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const currentX = e.clientX - rect.left
  const currentY = e.clientY - rect.top
  
  selectionBox.value = {
    x: Math.min(selectionBox.value.x, currentX),
    y: Math.min(selectionBox.value.y, currentY),
    width: Math.abs(currentX - selectionBox.value.x),
    height: Math.abs(currentY - selectionBox.value.y),
  }
  
  draw()
}

const onMouseUp = () => {
  if (!isSelecting.value) return
  
  // 搜索与选择框相交的矩形
  const results = rtree.value.search({
    minX: selectionBox.value.x,
    minY: selectionBox.value.y,
    maxX: selectionBox.value.x + selectionBox.value.width,
    maxY: selectionBox.value.y + selectionBox.value.height,
  })
  
  results.forEach((item) => {
    if (selectedIds.value.has(item.id)) {
      selectedIds.value.delete(item.id)
    } else {
      selectedIds.value.add(item.id)
    }
  })
  
  isSelecting.value = false
  draw()
}

// 搜索框
const searchRect = ref({ x: 100, y: 100, w: 200, h: 150 })

const performSearch = () => {
  selectedIds.value.clear()
  
  const results = rtree.value.search({
    minX: searchRect.value.x,
    minY: searchRect.value.y,
    maxX: searchRect.value.x + searchRect.value.w,
    maxY: searchRect.value.y + searchRect.value.h,
  })
  
  results.forEach((item) => {
    selectedIds.value.add(item.id)
  })
  
  draw()
}

const clearSelection = () => {
  selectedIds.value.clear()
  draw()
}

onMounted(() => {
  generateItems()
  draw()
})

onUnmounted(() => {
  // 清理
})
</script>

<template>
  <div class="rbrush-demo">
    <div class="demo-header">
      <h2>RBush 空间索引演示</h2>
      <p>在画布上拖拽框选矩形，或使用搜索框精确查找</p>
    </div>
    
    <div class="demo-container">
      <div class="canvas-section">
        <div class="toolbar">
          <el-button size="small" @click="generateItems">重新生成</el-button>
          <el-button size="small" @click="clearSelection">清空选择</el-button>
          <span class="info">
            总数: {{ items.length }} | 
            已选: {{ selectedIds.size }} |
            使用 RBush 索引
          </span>
        </div>
        
        <div ref="containerRef" class="canvas-wrapper">
          <canvas
            ref="canvasRef"
            :width="width"
            :height="height"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
          />
        </div>
      </div>
      
      <div class="control-section">
        <h3>精确搜索</h3>
        <div class="form">
          <div class="form-item">
            <label>X:</label>
            <el-input-number v-model="searchRect.x" :min="0" :max="width" size="small" />
          </div>
          <div class="form-item">
            <label>Y:</label>
            <el-input-number v-model="searchRect.y" :min="0" :max="height" size="small" />
          </div>
          <div class="form-item">
            <label>宽度:</label>
            <el-input-number v-model="searchRect.w" :min="10" :max="400" size="small" />
          </div>
          <div class="form-item">
            <label>高度:</label>
            <el-input-number v-model="searchRect.h" :min="10" :max="300" size="small" />
          </div>
          <el-button type="primary" @click="performSearch">执行搜索</el-button>
        </div>
        
        <div class="info-panel">
          <h4>RBush 特性</h4>
          <ul>
            <li>🚀 O(log n) 搜索复杂度</li>
            <li>📦 支持动态插入/删除</li>
            <li>🎯 精确的几何相交检测</li>
            <li>💾 内存友好的批量加载</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rbrush-demo {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.demo-header {
  margin-bottom: 20px;
}

.demo-header h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #303133;
}

.demo-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.demo-container {
  display: flex;
  gap: 20px;
}

.canvas-section {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.info {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
}

.canvas-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: auto;
  background: #f5f7fa;
}

canvas {
  display: block;
  cursor: crosshair;
}

.control-section {
  width: 280px;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.control-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-item label {
  width: 50px;
  font-size: 14px;
  color: #606266;
}

.info-panel {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
}

.info-panel h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #303133;
}

.info-panel ul {
  margin: 0;
  padding-left: 16px;
  font-size: 13px;
  color: #606266;
}

.info-panel li {
  margin-bottom: 8px;
}

.info-panel li:last-child {
  margin-bottom: 0;
}
</style>
