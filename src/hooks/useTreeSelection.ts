import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface SelectionBox {
  x: number
  y: number
  width: number
  height: number
}

interface CachedNode {
  id: string
  rect: DOMRect
  element: Element
}

interface UseTreeSelectionOptions {
  data: Ref<TreeNode[]> | (() => TreeNode[])
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
  treeRef?: Ref<any>
}

export function useTreeSelection(options: UseTreeSelectionOptions) {
  const { data, containerRef, onSelectionChange, treeRef } = options

  const selectedKeys = ref<Set<string>>(new Set())
  const lastSelectedKey = ref<string | null>(null)
  const isShiftPressed = ref(false)
  const isCtrlPressed = ref(false)
  
  // 框选状态
  const isSelecting = ref(false)
  const selectionBox = ref<SelectionBox>({ x: 0, y: 0, width: 0, height: 0 })
  const selectionBoxVisible = ref(false)
  const selectionStart = ref({ x: 0, y: 0 })
  
  // 框选开始时的初始选择状态
  const selectionStartKeys = ref<Set<string>>(new Set())
  
  // 缓存的节点信息（性能优化）
  const cachedNodes = ref<CachedNode[]>([])
  let rafId: number | null = null
  let lastBoxRect: { left: number; top: number; right: number; bottom: number } | null = null

  // 获取数据
  const getData = () => {
    return typeof data === 'function' ? data() : data.value
  }

  // 扁平化节点
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

  // 缓存所有可见节点的位置信息（框选开始时调用一次）
  const cacheNodePositions = () => {
    const container = containerRef.value
    if (!container) return

    const contentElements = container.querySelectorAll('.el-tree-node__content')
    const nodes: CachedNode[] = []

    contentElements.forEach((contentEl) => {
      const treeNode = contentEl.closest('.el-tree-node')
      if (!treeNode) return

      const style = window.getComputedStyle(treeNode)
      if (style.display === 'none' || style.visibility === 'hidden') return

      const rect = contentEl.getBoundingClientRect()
      if (rect.height === 0 || rect.width === 0) return

      const key = treeNode.getAttribute('data-key')
      if (key) {
        nodes.push({ id: key, rect, element: treeNode })
      }
    })

    cachedNodes.value = nodes
  }

  // 矩形相交检测（优化版：使用缓存的 rect）
  const isIntersecting = (boxRect: { left: number; top: number; right: number; bottom: number }, nodeRect: DOMRect): boolean => {
    // 节点内容区域中心点
    const contentCenterY = nodeRect.top + nodeRect.height / 2
    const contentHalfHeight = nodeRect.height / 2
    const contentCenterTop = contentCenterY - contentHalfHeight / 2
    const contentCenterBottom = contentCenterY + contentHalfHeight / 2
    
    const horizontalOverlap = !(boxRect.right < nodeRect.left || boxRect.left > nodeRect.right)
    const verticalOverlap = !(boxRect.bottom < contentCenterTop || boxRect.top > contentCenterBottom)
    
    return horizontalOverlap && verticalOverlap
  }

  // 更新树组件的选中状态
/**
 * 更新树形控件的选中状态
 * 该函数将当前选中的键值应用到树形控件上，实现选中状态的同步更新
 */
/**
    // 获取树形控件的引用，并调用setCheckedKeys方法设置选中项
    // 使用Array.from将selectedKeys.value从Set或其他可迭代对象转换为数组
 * 更新树形组件的选中状态
 * 该函数用于将当前选中的键值应用到树形组件的选中状态上
 */
   const updateTreeChecked = () => {
    treeRef?.value?.setCheckedKeys(Array.from(selectedKeys.value))
  }

  // 触发选择变化事件
  const emitSelectionChange = () => {
    onSelectionChange(Array.from(selectedKeys.value))
  }

  // 范围选择（Shift+点击）
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

  // 切换选择
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

  // 处理节点点击
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

  // 处理复选框变化
  const handleCheckChange = (nodeId: string, checked: boolean) => {
    if (checked) selectedKeys.value.add(nodeId)
    else selectedKeys.value.delete(nodeId)
    lastSelectedKey.value = nodeId
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

  // 计算框选命中的节点（使用缓存，避免频繁 DOM 查询）
  const calculateBoxSelection = (boxRect: { left: number; top: number; right: number; bottom: number }): string[] => {
    const intersectingIds: string[] = []

    for (const node of cachedNodes.value) {
      if (isIntersecting(boxRect, node.rect)) {
        intersectingIds.push(node.id)
      }
    }

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
    
    updateTreeChecked()
    emitSelectionChange()
    
    if (boxIds.length > 0) {
      lastSelectedKey.value = boxIds[boxIds.length - 1]
    }
  }

  // 节流处理框选更新（使用 requestAnimationFrame）
  const throttledUpdateSelection = () => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      
      if (!isSelecting.value || !lastBoxRect) return
      
      const boxIds = calculateBoxSelection(lastBoxRect)
      applyBoxSelection(boxIds)
    })
  }

  // 框选 - 鼠标按下
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
    
    // 缓存节点位置（只执行一次）
    cacheNodePositions()

    e.preventDefault()
  }

  // 框选 - 鼠标移动
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
      lastBoxRect = {
        left: selectionBox.value.x,
        top: selectionBox.value.y,
        right: selectionBox.value.x + selectionBox.value.width,
        bottom: selectionBox.value.y + selectionBox.value.height,
      }
      throttledUpdateSelection()
    }
  }

  // 框选 - 鼠标释放
  const handleMouseUp = () => {
    if (!isSelecting.value) return

    isSelecting.value = false
    selectionBoxVisible.value = false
    selectionStartKeys.value = new Set()
    cachedNodes.value = []
    lastBoxRect = null
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  // 绑定全局事件
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

  // 方法
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
