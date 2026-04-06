import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface UseTreeSelectionV2Options {
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
  treeRef?: Ref<any>
  itemHeight?: number
}

/**
 * useTreeSelection V2 Simple - 针对 el-tree-v2 优化的版本
 * 
 * 特点：
 * 1. 基于可见节点实时计算（适配虚拟滚动）
 * 2. 只检测 Y 轴位置（简化计算）
 * 3. 节流优化，避免频繁计算
 * 4. 适合 el-tree-v2 虚拟树
 */
export function useTreeSelectionV2Simple(options: UseTreeSelectionV2Options) {
  const { 
    containerRef, 
    onSelectionChange, 
    treeRef,
    itemHeight = 32
  } = options

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

  // 获取当前可见的节点位置信息（使用视口坐标，与选择框一致）
  const getVisibleNodes = (): Map<string, { top: number; height: number }> => {
    const container = containerRef.value
    if (!container) return new Map()

    const nodes = new Map<string, { top: number; height: number }>()
    const containerRect = container.getBoundingClientRect()
    
    // 获取所有可见的内容元素
    const contentElements = container.querySelectorAll('.el-tree-node__content')
    
    contentElements.forEach((el) => {
      const treeNode = el.closest('.el-tree-node')
      if (!treeNode) return

      const key = treeNode.getAttribute('data-key')
      if (!key) return

      const rect = el.getBoundingClientRect()
      if (rect.height === 0) return

      // 使用视口坐标（与 selectionBox 坐标系一致）
      nodes.set(key, {
        top: rect.top,
        height: rect.height
      })
    })

    return nodes
  }

  // 基于 Y 坐标范围查找节点
  const findNodesInRange = (yStart: number, yEnd: number): string[] => {
    const visibleNodes = getVisibleNodes()
    const result: string[] = []
    
    // 确保 start < end
    const minY = Math.min(yStart, yEnd)
    const maxY = Math.max(yStart, yEnd)

    visibleNodes.forEach((pos, id) => {
      const nodeCenter = pos.top + pos.height / 2
      // 节点中心点在选择范围内
      if (nodeCenter >= minY && nodeCenter <= maxY) {
        result.push(id)
      }
    })

    return result
  }

  const updateTreeChecked = () => {
    treeRef?.value?.setCheckedKeys(Array.from(selectedKeys.value))
  }

  const emitSelectionChange = () => {
    onSelectionChange(Array.from(selectedKeys.value))
  }

  const rangeSelect = (fromKey: string, toKey: string) => {
    // 获取所有可见节点并排序
    const visibleNodes = getVisibleNodes()
    const entries = Array.from(visibleNodes.entries())
    
    const fromIndex = entries.findIndex(([id]) => id === fromKey)
    const toIndex = entries.findIndex(([id]) => id === toKey)

    if (fromIndex === -1 || toIndex === -1) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      selectedKeys.value.add(entries[i][0])
    }

    updateTreeChecked()
    emitSelectionChange()
  }

  const toggleSelect = (key: string) => {
    if (selectedKeys.value.has(key)) {
      selectedKeys.value.delete(key)
      treeRef?.value?.setChecked(key, false, false)
    } else {
      selectedKeys.value.add(key)
      treeRef?.value?.setChecked(key, true, false)
    }
    emitSelectionChange()
  }

  const handleNodeClick = (nodeId: string) => {
    if (isShiftPressed.value && lastSelectedKey.value) {
      rangeSelect(lastSelectedKey.value, nodeId)
    } else if (isCtrlPressed.value) {
      toggleSelect(nodeId)
    } else {
      selectedKeys.value.clear()
      selectedKeys.value.add(nodeId)
      updateTreeChecked()
      emitSelectionChange()
    }
    lastSelectedKey.value = nodeId
  }

  const handleCheckChange = (nodeId: string, checked: boolean) => {
    if (checked) selectedKeys.value.add(nodeId)
    else selectedKeys.value.delete(nodeId)
    lastSelectedKey.value = nodeId
    emitSelectionChange()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftPressed.value = true
    if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = true
  }
  
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftPressed.value = false
    if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.value = false
  }

  const applyBoxSelection = (boxIds: string[]) => {
    selectedKeys.value = new Set(selectionStartKeys.value)
    
    boxIds.forEach(id => {
      if (selectedKeys.value.has(id)) {
        selectedKeys.value.delete(id)
      } else {
        selectedKeys.value.add(id)
      }
    })
    
    updateTreeChecked()
    emitSelectionChange()
    
    if (boxIds.length > 0) {
      lastSelectedKey.value = boxIds[boxIds.length - 1]
    }
  }

  const throttledUpdate = (yStart: number, yEnd: number) => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      const boxIds = findNodesInRange(yStart, yEnd)
      applyBoxSelection(boxIds)
    })
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    
    const target = e.target as HTMLElement
    if (target.closest('.el-checkbox')) return
    if (target.closest('.el-tree-node__expand-icon')) return

    const container = containerRef.value
    if (!container) return

    isSelecting.value = true
    selectionBoxVisible.value = true
    selectionStartKeys.value = new Set(selectedKeys.value)
    
    // 使用视口坐标（与 fixed 定位的选择框一致）
    const x = e.clientX
    const y = e.clientY
    
    selectionStart.value = { x, y }
    selectionBox.value = { x, y, width: 0, height: 0 }

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    // 使用视口坐标（与 fixed 定位的选择框一致）
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
      // 只基于 Y 轴范围查找（使用视口坐标）
      const yStart = selectionBox.value.y
      const yEnd = selectionBox.value.y + selectionBox.value.height
      throttledUpdate(yStart, yEnd)
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
    updateTreeChecked()
    emitSelectionChange()
  }

  // 全选所有节点（需要传入所有节点ID）
  const selectAll = (allIds?: string[]) => {
    if (allIds && allIds.length > 0) {
      allIds.forEach(id => selectedKeys.value.add(id))
    } else {
      // 如果没有传入，则选择当前可见的节点
      const visibleNodes = getVisibleNodes()
      visibleNodes.forEach((_, id) => selectedKeys.value.add(id))
    }
    updateTreeChecked()
    emitSelectionChange()
  }

  const setCheckedKeys = (keys: string[]) => {
    selectedKeys.value = new Set(keys)
    updateTreeChecked()
  }

  return {
    selectedKeys,
    lastSelectedKey,
    isShiftPressed,
    isCtrlPressed,
    isSelecting,
    selectionBox,
    selectionBoxVisible,
    handleNodeClick,
    handleCheckChange,
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    clearSelection,
    selectAll,
    setCheckedKeys,
    getSelectedKeys: () => Array.from(selectedKeys.value),
  }
}
