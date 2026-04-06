import { ref, computed, onMounted, onUnmounted, type Ref, watch } from 'vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface VirtualNode {
  id: string
  index: number
  level: number
  visible: boolean
  top: number
  height: number
}

interface UseTreeSelectionVirtualOptions {
  data: Ref<TreeNode[]> | (() => TreeNode[])
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
  treeRef?: Ref<any>
  itemHeight?: number // 每个节点的高度，默认 32
  overscan?: number // 可视区域外预渲染数量，默认 5
}

/**
 * useTreeSelection Virtual - 虚拟滚动版本
 * 
 * 特点：
 * 1. 只处理可见节点，大数据下性能优秀
 * 2. 自动计算可见区域
 * 3. 支持动态展开/折叠
 * 4. 适合万级节点
 */
export function useTreeSelectionVirtual(options: UseTreeSelectionVirtualOptions) {
  const { 
    data, 
    containerRef, 
    onSelectionChange, 
    treeRef,
    itemHeight = 32,
    overscan = 5 
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
  
  // 虚拟滚动相关
  const scrollTop = ref(0)
  const containerHeight = ref(0)
  const virtualNodes = ref<VirtualNode[]>([])
  let rafId: number | null = null

  const getData = () => {
    return typeof data === 'function' ? data() : data.value
  }

  // 扁平化并计算位置
  const flattenNodes = () => {
    const result: VirtualNode[] = []
    let index = 0
    
    const traverse = (nodes: TreeNode[], level: number) => {
      for (const node of nodes) {
        result.push({
          id: node.id,
          index: index++,
          level,
          visible: true,
          top: 0, // 稍后计算
          height: itemHeight,
        })
        
        if (node.children) {
          traverse(node.children, level + 1)
        }
      }
    }
    
    traverse(getData(), 0)
    
    // 计算每个节点的位置
    result.forEach((node, i) => {
      node.top = i * itemHeight
    })
    
    return result
  }

  // 可见节点
  const visibleNodes = computed(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
    const endIndex = Math.min(
      virtualNodes.value.length,
      Math.ceil((scrollTop.value + containerHeight.value) / itemHeight) + overscan
    )
    
    return virtualNodes.value.slice(startIndex, endIndex)
  })

  const allNodeIds = computed(() => virtualNodes.value.map(n => n.id))

  const nodeIndexMap = computed(() => {
    const map = new Map<string, number>()
    virtualNodes.value.forEach((node) => {
      map.set(node.id, node.index)
    })
    return map
  })

  // 初始化虚拟节点
  const initVirtualNodes = () => {
    virtualNodes.value = flattenNodes()
  }

  // 监听数据变化
  watch(() => getData(), initVirtualNodes, { immediate: true })

  // 处理滚动
  const handleScroll = () => {
    const container = containerRef.value
    if (container) {
      scrollTop.value = container.scrollTop
    }
  }

  // 更新容器高度
  const updateContainerHeight = () => {
    const container = containerRef.value
    if (container) {
      containerHeight.value = container.clientHeight
    }
  }

  // 虚拟节点是否与选择框相交
  const isVirtualNodeIntersecting = (
    node: VirtualNode, 
    boxTop: number, 
    boxBottom: number
  ): boolean => {
    const nodeCenterY = node.top + itemHeight / 2
    return nodeCenterY >= boxTop && nodeCenterY <= boxBottom
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

  // 虚拟框选计算 - 只检查可见节点
  const calculateVirtualBoxSelection = (boxTop: number, boxBottom: number): string[] => {
    const intersectingIds: string[] = []
    
    // 只需要检查可见节点
    visibleNodes.value.forEach((node) => {
      if (isVirtualNodeIntersecting(node, boxTop, boxBottom)) {
        intersectingIds.push(node.id)
      }
    })
    
    return intersectingIds
  }

  // 计算所有节点（用于框选超出可视区域时）
  const calculateAllBoxSelection = (boxTop: number, boxBottom: number): string[] => {
    const intersectingIds: string[] = []
    
    virtualNodes.value.forEach((node) => {
      if (isVirtualNodeIntersecting(node, boxTop, boxBottom)) {
        intersectingIds.push(node.id)
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

  const throttledUpdate = (boxTop: number, boxBottom: number) => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      
      // 判断选择框是否超出可视区域
      const visibleTop = scrollTop.value
      const visibleBottom = scrollTop.value + containerHeight.value
      
      let boxIds: string[]
      if (boxBottom < visibleTop || boxTop > visibleBottom) {
        // 超出可视区域，需要检查所有节点
        boxIds = calculateAllBoxSelection(boxTop, boxBottom)
      } else {
        // 在可视区域内，只检查可见节点
        boxIds = calculateVirtualBoxSelection(boxTop, boxBottom)
      }
      
      applyBoxSelection(boxIds)
    })
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
    
    // 获取容器相对坐标
    const container = containerRef.value
    if (container) {
      const rect = container.getBoundingClientRect()
      selectionStart.value = { 
        x: e.clientX - rect.left + container.scrollLeft, 
        y: e.clientY - rect.top + container.scrollTop 
      }
    }

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const container = containerRef.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    const currentX = e.clientX - rect.left + container.scrollLeft
    const currentY = e.clientY - rect.top + container.scrollTop
    
    const startX = selectionStart.value.x
    const startY = selectionStart.value.y

    selectionBox.value = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
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
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    const container = containerRef.value
    if (container) {
      container.addEventListener('scroll', handleScroll)
      updateContainerHeight()
      window.addEventListener('resize', updateContainerHeight)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  onUnmounted(() => {
    const container = containerRef.value
    if (container) {
      container.removeEventListener('scroll', handleScroll)
    }
    window.removeEventListener('resize', updateContainerHeight)
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
    virtualNodes,
    visibleNodes,
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
