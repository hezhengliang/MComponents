import { ref, computed, onMounted, onUnmounted, type Ref, watch, nextTick } from 'vue'
import RBush from 'rbush'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

interface RTreeItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

interface UseTreeSelectionRTreeOptions {
  data: Ref<TreeNode[]> | (() => TreeNode[])
  containerRef: Ref<HTMLElement | undefined>
  onSelectionChange: (selectedIds: string[]) => void
  treeRef?: Ref<any>
  itemHeight?: number
}

/**
 * useTreeSelection RTree - 基于 R-tree 空间索引的高性能版本
 * 
 * 特点：
 * 1. 使用 RBush R-tree 空间索引，O(log n) 查询相交节点
 * 2. 支持 el-tree-v2 (虚拟树)
 * 3. 适合超大数据集（10万+节点）
 * 4. 动态更新索引（支持展开/折叠）
 */
export function useTreeSelectionRTree(options: UseTreeSelectionRTreeOptions) {
  const { 
    data, 
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
  
  // R-tree 索引
  const rtree = ref<RBush<RTreeItem>>(new RBush())
  
  // 所有节点的位置映射（包括不可见的）
  const nodePositions = ref<Map<string, { 
    top: number
    height: number
    visible: boolean
    level: number
    index: number
  }>>(new Map())
  
  let rafId: number | null = null
  let updateTimeout: number | null = null

  const getData = () => {
    return typeof data === 'function' ? data() : data.value
  }

  // 扁平化节点并计算位置
  const flatNodes = computed(() => {
    const result: { id: string; index: number; level: number; top: number }[] = []
    let index = 0
    let top = 0
    
    const traverse = (nodes: TreeNode[], level: number) => {
      for (const node of nodes) {
        result.push({ 
          id: node.id, 
          index: index++,
          level,
          top: top
        })
        top += itemHeight
        
        if (node.children) {
          traverse(node.children, level + 1)
        }
      }
    }
    
    traverse(getData(), 0)
    return result
  })

  const allNodeIds = computed(() => flatNodes.value.map(n => n.id))

  const nodeIndexMap = computed(() => {
    const map = new Map<string, number>()
    flatNodes.value.forEach((node) => {
      map.set(node.id, node.index)
    })
    return map
  })

  // 构建 R-tree 索引（基于虚拟位置）
  const buildRTree = () => {
    const newTree = new RBush<RTreeItem>()
    const newPositions = new Map<string, { 
      top: number
      height: number
      visible: boolean
      level: number
      index: number
    }>()
    const items: RTreeItem[] = []

    // 基于扁平化数据构建索引
    // 水平方向固定，垂直方向基于索引计算
    flatNodes.value.forEach((node) => {
      const top = node.top
      const bottom = top + itemHeight

      items.push({
        minX: 0, // 简化：水平方向全覆盖
        minY: top,
        maxX: 10000, // 足够大的值
        maxY: bottom,
        id: node.id
      })

      newPositions.set(node.id, {
        top,
        height: itemHeight,
        visible: true,
        level: node.level,
        index: node.index
      })
    })

    newTree.load(items)
    rtree.value = newTree
    nodePositions.value = newPositions
  }

  // 节流更新索引
  const throttledBuildRTree = () => {
    if (updateTimeout !== null) {
      clearTimeout(updateTimeout)
    }
    updateTimeout = window.setTimeout(() => {
      buildRTree()
    }, 100)
  }

  // 监听数据变化，重建索引
  watch(() => getData(), () => {
    throttledBuildRTree()
  }, { deep: true, immediate: true })

  // 使用 R-tree 查询相交节点
  const searchIntersecting = (boxRect: { minX: number; minY: number; maxX: number; maxY: number }): string[] => {
    const results = rtree.value.search(boxRect)
    return results.map(item => item.id)
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

  const throttledUpdate = (searchBox: { minX: number; minY: number; maxX: number; maxY: number }) => {
    if (rafId !== null) return
    
    rafId = requestAnimationFrame(() => {
      rafId = null
      const boxIds = searchIntersecting(searchBox)
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
    
    // 获取相对于容器的位置（考虑滚动）
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top + container.scrollTop
    
    selectionStart.value = { x, y }
    selectionBox.value = { x, y, width: 0, height: 0 }

    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelecting.value) return

    const container = containerRef.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    const currentX = e.clientX - rect.left
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
      // 转换为基于虚拟位置的搜索框
      const searchBox = {
        minX: 0,
        minY: selectionBox.value.y,
        maxX: 10000,
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
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }
    if (updateTimeout !== null) {
      clearTimeout(updateTimeout)
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

  // 手动重建索引（外部调用）
  const rebuildIndex = () => {
    buildRTree()
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
    nodePositions,
    rtree,
    handleNodeClick,
    handleCheckChange,
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    clearSelection,
    selectAll,
    setCheckedKeys,
    rebuildIndex,
    getSelectedKeys: () => Array.from(selectedKeys.value),
  }
}
