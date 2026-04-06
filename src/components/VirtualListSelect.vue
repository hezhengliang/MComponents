<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElCheckbox } from 'element-plus'
import RBush from 'rbush'

interface ListItem {
  id: string
  label: string
  [key: string]: any
}

const props = defineProps<{
  data: ListItem[]
  height?: number
  itemHeight?: number
}>()

const emit = defineEmits<{
  selectionChange: [selectedIds: string[]]
}>()

const containerRef = ref<HTMLElement>()

const itemHeight = computed(() => props.itemHeight || 40)
const containerHeight = computed(() => props.height || 400)

// 滚动位置
const scrollTop = ref(0)

// 可见范围
const visibleStart = computed(() => Math.floor(scrollTop.value / itemHeight.value))
const visibleEnd = computed(() => 
  Math.min(
    props.data.length,
    Math.ceil((scrollTop.value + containerHeight.value) / itemHeight.value)
  )
)

// 可见数据（添加缓冲区）
const buffer = 5
const visibleData = computed(() => {
  const start = Math.max(0, visibleStart.value - buffer)
  const end = Math.min(props.data.length, visibleEnd.value + buffer)
  return props.data.slice(start, end).map((item, idx) => ({
    ...item,
    _index: start + idx,
  }))
})

// 总高度
const totalHeight = computed(() => props.data.length * itemHeight.value)

// 选择状态
const selectedKeys = ref<Set<string>>(new Set())
const lastSelectedKey = ref<string | null>(null)
const isShiftPressed = ref(false)
const isCtrlPressed = ref(false)

// 框选状态
const isSelecting = ref(false)
const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })
const selectionBoxVisible = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionStartKeys = ref<Set<string>>(new Set())

// R-tree
let rtree = new RBush<{minX: number; minY: number; maxX: number; maxY: number; id: string}>()
let rafId: number | null = null

// 构建索引
const buildIndex = () => {
  if (!containerRef.value) return
  
  const newTree = new RBush<{minX: number; minY: number; maxX: number; maxY: number; id: string}>()
  const items: {minX: number; minY: number; maxX: number; maxY: number; id: string}[] = []
  
  const containerRect = containerRef.value.getBoundingClientRect()
  const listItems = containerRef.value.querySelectorAll('.list-item')
  
  listItems.forEach((el) => {
    const key = el.getAttribute('data-key')
    if (!key) return
    
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) return
    
    items.push({
      minX: rect.left,
      minY: rect.top,
      maxX: rect.right,
      maxY: rect.bottom,
      id: key,
    })
  })
  
  newTree.load(items)
  rtree = newTree
}

// 处理滚动
const onScroll = () => {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
    // 延迟重建索引
    setTimeout(buildIndex, 50)
  }
}

// 处理点击
const onItemClick = (item: ListItem, e?: MouseEvent) => {
  if (e) e.stopPropagation()
  
  if (isShiftPressed.value && lastSelectedKey.value) {
    // Shift+点击：范围选择
    const lastIdx = props.data.findIndex(d => d.id === lastSelectedKey.value)
    const currIdx = props.data.findIndex(d => d.id === item.id)
    const start = Math.min(lastIdx, currIdx)
    const end = Math.max(lastIdx, currIdx)
    
    for (let i = start; i <= end; i++) {
      selectedKeys.value.add(props.data[i].id)
    }
  } else if (isCtrlPressed.value) {
    // Ctrl+点击：切换
    if (selectedKeys.value.has(item.id)) {
      selectedKeys.value.delete(item.id)
    } else {
      selectedKeys.value.add(item.id)
    }
  } else {
    // 普通点击：单选
    selectedKeys.value.clear()
    selectedKeys.value.add(item.id)
  }
  
  lastSelectedKey.value = item.id
  emitSelectionChange()
}

// 处理checkbox
const onCheckChange = (item: ListItem, checked: boolean) => {
  if (checked) {
    selectedKeys.value.add(item.id)
  } else {
    selectedKeys.value.delete(item.id)
  }
  lastSelectedKey.value = item.id
  emitSelectionChange()
}

const emitSelectionChange = () => {
  emit('selectionChange', Array.from(selectedKeys.value))
}

// 键盘事件
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Shift') isShiftPressed.value = true
  if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = true
}

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') isShiftPressed.value = false
  if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = false
}

// 框选
const onMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return
  
  const target = e.target as HTMLElement
  if (target.closest('.list-item-content') || target.closest('.el-checkbox')) return
  
  isSelecting.value = true
  selectionBoxVisible.value = true
  selectionStartKeys.value = new Set(selectedKeys.value)
  
  selectionStart.value = { x: e.clientX, y: e.clientY }
  selectionBox.value = { x: e.clientX, y: e.clientY, width: 0, height: 0 }
  
  e.preventDefault()
}

const onMouseMove = (e: MouseEvent) => {
  if (!isSelecting.value) return
  
  const currentX = e.clientX
  const currentY = e.clientY
  
  selectionBox.value = {
    x: Math.min(selectionStart.value.x, currentX),
    y: Math.min(selectionStart.value.y, currentY),
    width: Math.abs(currentX - selectionStart.value.x),
    height: Math.abs(currentY - selectionStart.value.y),
  }
  
  if (selectionBox.value.width > 5 || selectionBox.value.height > 5) {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      buildIndex()
      const results = rtree.search({
        minX: selectionBox.value.x,
        minY: selectionBox.value.y,
        maxX: selectionBox.value.x + selectionBox.value.width,
        maxY: selectionBox.value.y + selectionBox.value.height,
      })
      
      selectedKeys.value = new Set(selectionStartKeys.value)
      results.forEach(item => {
        if (selectedKeys.value.has(item.id)) {
          selectedKeys.value.delete(item.id)
        } else {
          selectedKeys.value.add(item.id)
        }
      })
      emitSelectionChange()
    })
  }
}

const onMouseUp = () => {
  if (!isSelecting.value) return
  
  isSelecting.value = false
  selectionBoxVisible.value = false
  selectionStartKeys.value = new Set()
  
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// 全选/清空
const clearSelection = () => {
  selectedKeys.value.clear()
  lastSelectedKey.value = null
  emitSelectionChange()
}

const selectAll = () => {
  props.data.forEach(item => selectedKeys.value.add(item.id))
  emitSelectionChange()
}

const getSelectedKeys = () => Array.from(selectedKeys.value)

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  setTimeout(buildIndex, 100)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  if (rafId !== null) cancelAnimationFrame(rafId)
})

defineExpose({
  clearSelection,
  selectAll,
  getSelectedKeys,
})
</script>

<template>
  <div 
    class="virtual-list-select"
    tabindex="0"
  >
    <div class="toolbar">
      <el-button size="small" @click="selectAll">全选</el-button>
      <el-button size="small" @click="clearSelection">清空</el-button>
      <span class="tip">
        已选 {{ selectedKeys.size }} 项 | Shift+点击范围选 | 拖拽框选 | Ctrl+切换
      </span>
    </div>
    
    <div 
      ref="containerRef"
      class="list-container"
      :class="{ 
        'is-selecting': isSelecting,
        'is-shift-pressed': isShiftPressed,
        'is-ctrl-pressed': isCtrlPressed,
      }"
      :style="{ height: containerHeight + 'px' }"
      @scroll="onScroll"
      @mousedown="onMouseDown"
    >
      <div class="list-content" :style="{ height: totalHeight + 'px' }">
        <div
          v-for="item in visibleData"
          :key="item.id"
          :data-key="item.id"
          class="list-item"
          :class="{ 'is-selected': selectedKeys.has(item.id) }"
          :style="{ 
            height: itemHeight + 'px',
            transform: `translateY(${item._index * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }"
          @click="(e) => onItemClick(item, e)"
        >
          <div class="list-item-content" @click.stop>
            <ElCheckbox
              :model-value="selectedKeys.has(item.id)"
              @update:model-value="(checked: boolean) => onCheckChange(item, checked)"
            />
            <span class="item-label">{{ item.label }}</span>
            <span class="item-index">#{{ item._index + 1 }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 选择框 -->
  <div
    v-if="selectionBoxVisible"
    class="list-selection-box"
    :class="{ 'is-ctrl-mode': isCtrlPressed }"
    :style="{
      left: selectionBox.x + 'px',
      top: selectionBox.y + 'px',
      width: selectionBox.width + 'px',
      height: selectionBox.height + 'px',
    }"
  />
</template>

<style scoped>
.virtual-list-select {
  outline: none;
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.tip {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.list-container {
  flex: 1;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  position: relative;
}

.list-container.is-selecting {
  cursor: crosshair;
}

.list-container.is-selecting .list-item {
  pointer-events: none;
}

.list-container.is-selecting .list-item-content {
  pointer-events: auto;
}

.list-container.is-shift-pressed {
  cursor: cell;
}

.list-container.is-ctrl-pressed {
  cursor: copy;
}

.list-content {
  position: relative;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #ebeef5;
  box-sizing: border-box;
  background: #fff;
}

.list-item:hover {
  background-color: #f5f7fa;
}

.list-item.is-selected {
  background-color: #ecf5ff;
}

.list-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  pointer-events: auto;
}

.item-label {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.item-index {
  font-size: 12px;
  color: #909399;
}
</style>

<style>
.list-selection-box {
  position: fixed !important;
  border: 1px solid #409eff;
  background-color: rgba(64, 158, 255, 0.15);
  pointer-events: none;
  z-index: 99999;
}

.list-selection-box.is-ctrl-mode {
  border-color: #67c23a;
  background-color: rgba(103, 194, 58, 0.15);
}
</style>
