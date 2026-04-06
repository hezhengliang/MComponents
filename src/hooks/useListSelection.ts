import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import RBush from 'rbush'

interface ListItem {
  id: string
  [key: string]: any
}

interface RTreeItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

interface UseListSelectionOptions {
  containerRef: Ref<HTMLElement | undefined>
  itemHeight: number
  onSelectionChange: (selectedIds: string[]) => void
}

/**
 * useListSelection - 基于 RBush 的虚拟列表选择 Hook
 * 
 * 特点：
 * 1. 使用 RBush R-tree 空间索引，O(log n) 查询相交项
 * 2. 支持 Shift 范围选择、Ctrl 多选、框选
 * 3. 高性能，适合大数据量
 * 4. 只处理可见项，支持虚拟滚动
 */
export function useListSelection(options: UseListSelectionOptions) {
  const { containerRef, itemHeight, onSelectionChange } = options

  const selectedKeys = ref<Set<string>>(new Set())
  const lastSelectedKey = ref<string | null>(null)
  const isShiftPressed = ref(false)
  const isCtrlPressed = ref(false)
  
  const isSelecting = ref(false)
  const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })
  const selectionBoxVisible = ref(false)
  const selectionStart = ref({ x: 0, y: 0 })
  const selectionStartKeys = ref<Set<string>>(new Set())
  
  // R-tree 索引
  const rtree = ref<RBush<RTreeItem>>(new RBush())
  
  let rafId: number | null = null

  // 构建/更新 R-tree 索引
  const buildIndex = () => {
    const container = containerRef.value
    if (!container) return

    const newTree = new RBush<RTreeItem>()
    const items: RTreeItem[] = []
    
    const containerRect = container.getBoundingClientRect()
    
    // 获取所有可见的列表项
    const listItems = container.querySelectorAll('.list-item')
    
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
        id: key
      })
    })

    newTree.load(items)
    rtree.value = newTree
  }

  // 使用 R-tree 查询相交项
  const searchIntersecting = (box: { minX: number; minY: number; maxX: number; maxY: number }): string[] => {
    return rtree.value.search(box).map(item => item.id)
  }

  const emitSelectionChange = () => {
    onSelectionChange(Array.from(selectedKeys.value))
  }

  // 范围选择（Shift+点击）- 基于索引
  const rangeSelect = (visibleItems: string[], fromKey: string, toKey: string) => {
    const fromIndex = visibleItems.indexOf(fromKey)
    const toIndex = visibleItems.indexOf(toKey)

    if (fromIndex === -1 || toIndex === -1) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      selectedKeys.value.add(visibleItems[i])
    }

    emitSelectionChange()
  }

  // 切换选择
  const toggleSelect = (key: string) => {
    if (selectedKeys.value.has(key)) {
      selectedKeys.value.delete(key)
    } else {
      selectedKeys.value.add(key)
    }
    emitSelectionChange()
  }

  // 处理项点击（简化版，直接传入 itemId）
  const handleItemClick = (itemId: string) => {
    if (isShiftPressed.value && lastSelectedKey.value) {
      // Shift+点击：添加到选择（不清理之前的）
      selectedKeys.value.add(itemId)
      emitSelectionChange()
    } else if (isCtrlPressed.value) {
      toggleSelect(itemId)
    } else {
      // 普通点击：单选
      selectedKeys.value.clear()
      selectedKeys.value.add(itemId)
      emitSelectionChange()
    }
    lastSelectedKey.value = itemId
  }
  
  // 处理复选框变化
  const handleCheckChange = (itemId: string, checked: boolean) => {
    if (checked) {
      selectedKeys.value.add(itemId)
    } else {
      selectedKeys.value.delete(itemId)
    }
    lastSelectedKey.value = itemId
    emitSelectionChange()
  }

  // 键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftPressed.value = true
    if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = true
  }
  
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftPressed.value = false
    if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = false
  }

  // 应用框选结果
  const applyBoxSelection = (boxIds: string[]) => {
    selectedKeys.value = new Set(selectionStartKeys.value)
    
    boxIds.forEach(id => {
      if (selectedKeys.value.has(id)) {
        selectedKeys.value.delete(id)
      } else {
        selectedKeys.value.add(id)
      }
    })
    
    emitSelectionChange()
    
    if (boxIds.length > 0) {
      lastSelectedKey.value = boxIds[boxIds.length - 1]
    }
  }

  const throttledUpdate = (searchBox: { minX: number; minY: number; maxX: number; maxY: number }) => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      // 重新构建索引以获取最新位置
      buildIndex()
      const boxIds = searchIntersecting(searchBox)
      applyBoxSelection(boxIds)
    })
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    
    const target = e.target as HTMLElement
    // 如果点击的是列表项内部的可交互元素，不触发框选
    if (target.closest('.list-item-content')) return

    isSelecting.value = true
    selectionBoxVisible.value = true
    selectionStartKeys.value = new Set(selectedKeys.value)
    
    // 使用视口坐标
    const x = e.clientX
    const y = e.clientY
    
    selectionStart.value = { x, y }
    selectionBox.value = { x, y, width: 0, height: 0 }

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const currentX = e.clientX
    const currentY = e.clientY
    
    const startX = selectionStart.value.x
    const startY = selectionStart.value.y

    selectionBox.value = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
    }

    if (selectionBox.value.width > 5 || selectionBox.value.height > 5) {
      const searchBox = {
        minX: selectionBox.value.x,
        minY: selectionBox.value.y,
        maxX: selectionBox.value.x + selectionBox.value.width,
        maxY: selectionBox.value.y + selectionBox.value.height,
      }
      throttledUpdate(searchBox)
    }
  }

  const handleMouseUp = () => {
    if (!isSelecting.value) return

    isSelecting.value = false
    selectionBoxVisible.value = false
    selectionStartKeys.value = new Set()
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // 初始构建索引
    setTimeout(() => buildIndex(), 100)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
  })

  const clearSelection = () => {
    selectedKeys.value.clear()
    lastSelectedKey.value = null
    emitSelectionChange()
  }

  const selectAll = (allIds: string[]) => {
    allIds.forEach(id => selectedKeys.value.add(id))
    emitSelectionChange()
  }

  const setSelectedKeys = (keys: string[]) => {
    selectedKeys.value = new Set(keys)
    emitSelectionChange()
  }

  // 重新构建索引（外部调用，如滚动后）
  const rebuildIndex = () => {
    buildIndex()
  }

  return {
    selectedKeys,
    lastSelectedKey,
    isShiftPressed,
    isCtrlPressed,
    isSelecting,
    selectionBox,
    selectionBoxVisible,
    handleItemClick,
    handleCheckChange,
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    clearSelection,
    selectAll,
    setSelectedKeys,
    rebuildIndex,
    getSelectedKeys: () => Array.from(selectedKeys.value),
  }
}
