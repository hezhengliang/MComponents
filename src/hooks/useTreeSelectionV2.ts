import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface UseTreeSelectionV2Options {
  data: Ref<TreeNode[]> | (() => TreeNode[])
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
  treeRef?: Ref<any>
}

/**
 * useTreeSelection V2 - 简化版实现
 * 
 * 特点：
 * 1. 不使用缓存，每次实时计算（适合节点数 < 500）
 * 2. 简化的相交检测（只判断 Y 轴）
 * 3. 使用简单的节流而非 RAF
 * 4. 更少的内存占用
 */
export function useTreeSelectionV2(options: UseTreeSelectionV2Options) {
  const { data, containerRef, onSelectionChange, treeRef } = options

  const selectedKeys = ref<Set<string>>(new Set())
  const lastSelectedKey = ref<string | null>(null)
  const isShiftPressed = ref(false)
  const isCtrlPressed = ref(false)
  
  const isSelecting = ref(false)
  const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })
  const selectionBoxVisible = ref(false)
  const selectionStart = ref({ x: 0, y: 0 })
  const selectionStartKeys = ref<Set<string>>(new Set())
  
  // 简单节流
  let throttleTimer: number | null = null

  const getData = () => {
    return typeof data === 'function' ? data() : data.value
  }

  const flatNodes = computed(() => {
    const result: { id: string }[] = []
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        result.push({ id: node.id })
        if (node.children) traverse(node.children)
      }
    }
    traverse(getData())
    return result
  })

  const allNodeIds = computed(() => flatNodes.value.map(n => n.id))

  const nodeIndexMap = computed(() => {
    const map = new Map<string, number>()
    flatNodes.value.forEach((node, index) => {
      map.set(node.id, index)
    })
    return map
  })

  // 简化的 Y 轴检测（只判断中心点是否在范围内）
  const isInYRange = (nodeRect: DOMRect, boxTop: number, boxBottom: number): boolean => {
    const centerY = nodeRect.top + nodeRect.height / 2
    return centerY >= boxTop && centerY <= boxBottom
  }

  const updateTreeChecked = () => {
    treeRef?.value?.setCheckedKeys(Array.from(selectedKeys.value))
  }

  const emitSelectionChange = () => {
    onSelectionChange(Array.from(selectedKeys.value))
  }

  const rangeSelect = (fromKey: string, toKey: string) => {
    const ids = allNodeIds.value
    const fromIndex = nodeIndexMap.value.get(fromKey)
    const toIndex = nodeIndexMap.value.get(toKey)

    if (fromIndex === undefined || toIndex === undefined) return

    const start = Math.min(fromIndex, toIndex)
    const end = Math.max(fromIndex, toIndex)

    for (let i = start; i <= end; i++) {
      selectedKeys.value.add(ids[i])
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

  // 简化的框选计算（只检测 Y 轴）
  const calculateBoxSelection = (boxTop: number, boxBottom: number): string[] => {
    const container = containerRef.value
    if (!container) return []

    const contentElements = container.querySelectorAll('.el-tree-node__content')
    const intersectingIds: string[] = []

    contentElements.forEach((contentEl) => {
      const treeNode = contentEl.closest('.el-tree-node')
      if (!treeNode) return

      const style = window.getComputedStyle(treeNode)
      if (style.display === 'none') return

      const rect = contentEl.getBoundingClientRect()
      if (rect.height === 0) return

      // 只判断 Y 轴
      if (isInYRange(rect, boxTop, boxBottom)) {
        const key = treeNode.getAttribute('data-key')
        if (key) intersectingIds.push(key)
      }
    })

    return intersectingIds
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

  // 简单的 setTimeout 节流
  const throttledUpdate = (boxTop: number, boxBottom: number) => {
    if (throttleTimer !== null) return
    
    throttleTimer = window.setTimeout(() => {
      throttleTimer = null
      const boxIds = calculateBoxSelection(boxTop, boxBottom)
      applyBoxSelection(boxIds)
    }, 50) // 50ms 节流
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    
    const target = e.target as HTMLElement
    if (target.closest('.el-checkbox')) return
    if (target.closest('.el-tree-node__expand-icon')) return

    isSelecting.value = true
    selectionStart.value = { x: e.clientX, y: e.clientY }
    selectionBox.value = { x: e.clientX, y: e.clientY, width: 0, height: 0 }
    selectionBoxVisible.value = true
    selectionStartKeys.value = new Set(selectedKeys.value)

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const startX = selectionStart.value.x
    const startY = selectionStart.value.y

    selectionBox.value = {
      x: Math.min(startX, e.clientX),
      y: Math.min(startY, e.clientY),
      width: Math.abs(e.clientX - startX),
      height: Math.abs(e.clientY - startY),
    }

    if (selectionBox.value.width > 5 || selectionBox.value.height > 5) {
      const boxTop = selectionBox.value.y
      const boxBottom = selectionBox.value.y + selectionBox.value.height
      throttledUpdate(boxTop, boxBottom)
    }
  }

  const handleMouseUp = () => {
    if (!isSelecting.value) return

    isSelecting.value = false
    selectionBoxVisible.value = false
    selectionStartKeys.value = new Set()
    
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer)
    }
  })

  const clearSelection = () => {
    selectedKeys.value.clear()
    lastSelectedKey.value = null
    updateTreeChecked()
    emitSelectionChange()
  }

  const selectAll = () => {
    const ids = allNodeIds.value
    ids.forEach(id => selectedKeys.value.add(id))
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
    allNodeIds,
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
