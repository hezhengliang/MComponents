<script setup lang="ts">
import { ref } from 'vue'
import type { TreeInstance } from 'element-plus'
import { useTreeSelection } from '../hooks/useTreeSelection'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

const props = defineProps<{
  data: TreeNode[]
}>()

const emit = defineEmits<{
  selectionChange: [selectedIds: string[]]
}>()

const treeRef = ref<TreeInstance>()
const treeWrapperRef = ref<HTMLElement>()

const {
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
  getSelectedKeys,
} = useTreeSelection({
  data: () => props.data,
  containerRef: treeWrapperRef,
  treeRef,
  onSelectionChange: (ids) => emit('selectionChange', ids),
})

defineExpose({
  clearSelection,
  selectAll,
  getSelectedKeys,
})
</script>

<template>
  <div 
    class="tree-shift-select"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
    tabindex="0"
  >
    <div class="toolbar">
      <el-button size="small" @click="selectAll">全选</el-button>
      <el-button size="small" @click="clearSelection">清空</el-button>
      <span class="tip">
        Shift+点击范围选 | 拖拽框选 | Ctrl+点击/框选 切换
      </span>
    </div>
    
    <div 
      ref="treeWrapperRef"
      class="tree-wrapper"
      :class="{ 
        'is-selecting': isSelecting,
        'is-shift-pressed': isShiftPressed,
        'is-ctrl-pressed': isCtrlPressed,
      }"
      @mousedown="handleMouseDown"
    >
      <el-tree
        ref="treeRef"
        :data="data"
        node-key="id"
        show-checkbox
        default-expand-all
        :check-on-click-node="false"
        @node-click="(data) => handleNodeClick(data.id)"
        @check-change="(data, checked) => handleCheckChange(data.id, checked)"
        class="custom-tree"
      >
        <template #default="{ node }">
          <span 
            class="tree-node" 
            :class="{ 'no-select': isShiftPressed || isSelecting }"
          >{{ node.label }}</span>
        </template>
      </el-tree>
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
.tree-shift-select {
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

.tree-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  background: #fff;
}

/* 框选时的样式 */
.tree-wrapper.is-selecting {
  cursor: crosshair;
}

.tree-wrapper.is-selecting :deep(.el-tree-node__content) {
  pointer-events: none;
}

.tree-wrapper.is-selecting :deep(.el-checkbox),
.tree-wrapper.is-selecting :deep(.el-tree-node__expand-icon) {
  pointer-events: auto;
}

/* Shift 按下时的样式 */
.tree-wrapper.is-shift-pressed {
  cursor: cell;
}

/* Ctrl 按下时的样式 */
.tree-wrapper.is-ctrl-pressed {
  cursor: copy;
}

.custom-tree {
  background: transparent;
}

.tree-node {
  padding: 2px 4px;
}

.tree-node.no-select {
  user-select: none;
}

:deep(.el-tree-node__content) {
  height: 32px;
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
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

/* Ctrl 模式下的选择框样式 */
.tree-selection-box.is-ctrl-mode {
  border-color: #67c23a;
  background-color: rgba(103, 194, 58, 0.15);
}
</style>
