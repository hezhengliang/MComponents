<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { ElTreeV2 } from 'element-plus'
import { useTreeSelectionV2Simple } from '../hooks/useTreeSelectionV2Simple'
import type { TreeNodeData } from 'element-plus/es/components/tree-v2/src/types'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

const props = defineProps<{
  data: TreeNode[]
  height?: number
  itemHeight?: number
  // 所有节点ID列表（用于全选）
  allNodeIds?: string[]
  // 展开的节点（双向绑定）
  expandedKeys?: string[]
}>()

const emit = defineEmits<{
  selectionChange: [selectedIds: string[]]
  'update:expandedKeys': [keys: string[]]
}>()



const treeRef = ref<InstanceType<typeof ElTreeV2>>()
const treeWrapperRef = ref<HTMLElement>()

// 转换数据为 el-tree-v2 格式
const treeData = computed(() => {
  const convert = (nodes: TreeNode[]): any[] => {
    return nodes.map(node => ({
      id: node.id,
      label: node.label,
      children: node.children ? convert(node.children) : undefined,
    }))
  }
  return convert(props.data)
})

const {
  isShiftPressed,
  isCtrlPressed,
  isSelecting,
  selectionBox,
  selectionBoxVisible,
  selectedKeys,
  handleNodeClick,
  handleCheckChange,
  handleKeyDown,
  handleKeyUp,
  handleMouseDown,
  clearSelection,
  selectAll,
  getSelectedKeys,
} = useTreeSelectionV2Simple({
  containerRef: treeWrapperRef,
  treeRef,
  itemHeight: props.itemHeight || 32,
  onSelectionChange: (ids) => emit('selectionChange', ids),
})

// 自定义节点渲染
const renderNode = ({ node, data }: { node: any; data: TreeNodeData }) => {
  return h('span', {
    class: 'tree-node-v2',
    style: {
      userSelect: isShiftPressed.value || isSelecting.value ? 'none' : 'auto'
    },
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      handleNodeClick(data.id as string)
    }
  }, data.label as string)
}

defineExpose({
  clearSelection,
  selectAll: () => selectAll(props.allNodeIds),
  getSelectedKeys,
  treeRef, // 暴露 el-tree-v2 实例
})
</script>

<template>
  <div 
    class="tree-shift-select-v2"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
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
      ref="treeWrapperRef"
      class="tree-wrapper-v2"
      :class="{ 
        'is-selecting': isSelecting,
        'is-shift-pressed': isShiftPressed,
        'is-ctrl-pressed': isCtrlPressed,
      }"
      @mousedown="handleMouseDown"
    >
      <el-tree-v2
        ref="treeRef"
        :data="treeData"
        :height="height || 400"
        :item-height="itemHeight || 32"
        :props="{ value: 'id', label: 'label', children: 'children' }"
        :expanded-keys="expandedKeys"
        show-checkbox
        :render-node="renderNode"
        @check-change="(data: any, checked: boolean) => handleCheckChange(data.id, checked)"
        @update:expanded-keys="(keys: string[]) => emit('update:expandedKeys', keys)"
        class="custom-tree-v2"
      />
    </div>
  </div>
  
  <!-- 选择框 -->
  <div
    v-if="selectionBoxVisible"
    class="tree-selection-box"
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
.tree-shift-select-v2 {
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

.tree-wrapper-v2 {
  flex: 1;
  overflow: hidden;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  position: relative;
}

/* 框选时的样式 */
.tree-wrapper-v2.is-selecting {
  cursor: crosshair;
}

.tree-wrapper-v2.is-shift-pressed {
  cursor: cell;
}

.tree-wrapper-v2.is-ctrl-pressed {
  cursor: copy;
}

.custom-tree-v2 {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: v-bind('(itemHeight || 32) + "px"');
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
}

.tree-node-v2 {
  padding: 2px 4px;
  flex: 1;
}
</style>

<style>
/* 全局样式 - 选择框 */
.tree-selection-box {
  position: fixed !important;
  border: 1px solid #409eff;
  background-color: rgba(64, 158, 255, 0.15);
  pointer-events: none;
  z-index: 99999;
}

.tree-selection-box.is-ctrl-mode {
  border-color: #67c23a;
  background-color: rgba(103, 194, 58, 0.15);
}
</style>
