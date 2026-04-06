import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface ListItem {
  id: string
  [key: string]: any
}

interface UseVirtualListSelectionOptions {
  data: Ref<ListItem[]> | (() => ListItem[])
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
}

export function useVirtualListSelection(options: UseVirtualListSelectionOptions) {
  const { data, containerRef, onSelectionChange } = options

  const selectedKeys = ref<Set<string>>(new Set())
  const lastSelectedKey = ref<string | null>(null)
  const isShiftPressed = ref(false)
  const isCtrlPressed = ref(false)
  
  const isSelecting = ref(false)
  const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })
  const selectionBoxVisible = ref(false)
  const selectionStart = ref({ x: 0, y: 0 })
  const selectionStartKeys = ref<Set<string>>(new Set())
  
  let rafId: number | null = null

  const getData = () => {
    return typeof data === 'function' ? data() : data.value
  }

  // 获取当前可见项（从 DOM 中查询）
  const getVisibleItems = (): { id: string; rect: DOMRect }[] => {
    const container = containerRef.value
    if (!container) return []

    const items: { id: string; rect: DOMRect }[] = []
    const listItems = container.querySelectorAll('.list-item')
    
    listItems.forEach((el) => {
      const id = el.getAttribute('data-id')
      if (!id) return

      const rect = el.getBoundingClientRect()
      if (rect.height === 0) return

      items.push({ id, rect })
    })

    return items
  }

  // 矩形相交检测
  const isIntersecting = (boxRect: { left: number; top: number; right: number; bottom: number }, nodeRect: DOMRect): boolean => {
    const nodeCenterY = nodeRect.top + nodeRect.height / 2
    const nodeHalfHeight = nodeRect.height / 2
    const nodeCenterTop = nodeCenterY - nodeHalfHeight / 2
    const nodeCenterBottom = nodeCenterY + nodeHalfHeight / 2
    
    const horizontalOverlap = !(boxRect.right < nodeRect.left || boxRect.left > nodeRect.right)
    const verticalOverlap = !(boxRect.bottom < nodeCenterTop || boxRect.top > nodeCenterBottom)
    
    return horizontalOverlap && verticalOverlap
  }

  const emitSelectionChange = () => {
    onSelectionChange(Array.from(selectedKeys.value))
  }

  // 范围选择（Shift+点击）- 基于数据索引
  const rangeSelect = (fromKey: string, toKey: string) => {
    const items = getData()
    const fromIndex = items.findIndex(item => item.id === fromKey)
    const toIndex = items.findIndex(item => item.id === toKey)

    if (fromIndex === -1 || toIndex === -1) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      selectedKeys.value.add(items[i].id)
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

  // 处理项点击
  const handleItemClick = (itemId: string) => {
    if (isShiftPressed.value && lastSelectedKey.value) {
      rangeSelect(lastSelectedKey.value, itemId)
    } else if (isCtrlPressed.value) {
      toggleSelect(itemId)
    } else {
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

  // 计算框选命中的节点
  const calculateBoxSelection = (boxRect: { left: number; top: number; right: number; bottom: number }): string[] => {
    const visibleItems = getVisibleItems()
    const intersectingIds: string[] = []

    visibleItems.forEach((item) => {
      if (isIntersecting(boxRect, item.rect)) {
        intersectingIds.push(item.id)
      }
    })

    return intersectingIds
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

  const throttledUpdate = (boxRect: { left: number; top: number; right: number; bottom: number }) => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      const boxIds = calculateBoxSelection(boxRect)
      applyBoxSelection(boxIds)
    })
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    
    const target = e.target as HTMLElement
    if (target.closest('.list-item') || target.closest('.el-checkbox')) return

    isSelecting.value = true
    selectionBoxVisible.value = true
    selectionStartKeys.value = new Set(selectedKeys.value)
    
    selectionStart.value = { x: e.clientX, y: e.clientY }
    selectionBox.value = { x: e.clientX, y: e.clientY, width: 0, height: 0 }

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
      const boxRect = {
        left: selectionBox.value.x,
        top: selectionBox.value.y,
        right: selectionBox.value.x + selectionBox.value.width,
        bottom: selectionBox.value.y + selectionBox.value.height,
      }
      throttledUpdate(boxRect)
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

  const selectAll = () => {
    const items = getData()
    items.forEach(item => selectedKeys.value.add(item.id))
    emitSelectionChange()
  }

  const setSelectedKeys = (keys: string[]) => {
    selectedKeys.value = new Set(keys)
    emitSelectionChange()
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
    getSelectedKeys: () => Array.from(selectedKeys.value),
  }
}
