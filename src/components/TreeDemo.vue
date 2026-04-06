<script setup lang="ts">
import { ref } from 'vue'
import TreeShiftSelect from './TreeShiftSelect.vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

const treeData: TreeNode[] = [
  {
    id: '1',
    label: '一级 1',
    children: [
      {
        id: '1-1',
        label: '二级 1-1',
        children: [
          { id: '1-1-1', label: '三级 1-1-1' },
          { id: '1-1-2', label: '三级 1-1-2' },
          { id: '1-1-3', label: '三级 1-1-3' },
        ],
      },
      {
        id: '1-2',
        label: '二级 1-2',
        children: [
          { id: '1-2-1', label: '三级 1-2-1' },
          { id: '1-2-2', label: '三级 1-2-2' },
        ],
      },
    ],
  },
  {
    id: '2',
    label: '一级 2',
    children: [
      {
        id: '2-1',
        label: '二级 2-1',
        children: [
          { id: '2-1-1', label: '三级 2-1-1' },
          { id: '2-1-2', label: '三级 2-1-2' },
          { id: '2-1-3', label: '三级 2-1-3' },
          { id: '2-1-4', label: '三级 2-1-4' },
        ],
      },
      {
        id: '2-2',
        label: '二级 2-2',
        children: [
          { id: '2-2-1', label: '三级 2-2-1' },
          { id: '2-2-2', label: '三级 2-2-2' },
        ],
      },
    ],
  },
  {
    id: '3',
    label: '一级 3',
    children: [
      { id: '3-1', label: '二级 3-1' },
      { id: '3-2', label: '二级 3-2' },
      { id: '3-3', label: '二级 3-3' },
    ],
  },
]

const treeRef = ref<InstanceType<typeof TreeShiftSelect>>()
const selectedIds = ref<string[]>([])

const handleSelectionChange = (ids: string[]) => {
  selectedIds.value = ids
}

const handleClear = () => {
  treeRef.value?.clearSelection()
}

const handleSelectAll = () => {
  treeRef.value?.selectAll()
}
</script>

<template>
  <div class="tree-demo">
    <div class="demo-container">
      <div class="tree-section">
        <h3>Tree Shift 多选示例</h3>
        <TreeShiftSelect
          ref="treeRef"
          :data="treeData"
          @selection-change="handleSelectionChange"
        />
      </div>
      
      <div class="result-section">
        <h3>已选择项 ({{ selectedIds.length }})</h3>
        <div class="selected-list">
          <el-tag
            v-for="id in selectedIds"
            :key="id"
            closable
            @close="() => {
              const index = selectedIds.indexOf(id)
              if (index > -1) {
                selectedIds.splice(index, 1)
              }
            }"
          >
            {{ id }}
          </el-tag>
          <el-empty v-if="selectedIds.length === 0" description="暂无选择" />
        </div>
        
        <div class="actions">
          <el-button type="primary" @click="handleSelectAll">全选</el-button>
          <el-button @click="handleClear">清空</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-demo {
  padding: 20px;
  height: 100%;
}

.demo-container {
  display: flex;
  gap: 24px;
  height: 100%;
}

.tree-section,
.result-section {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 12px;
}

.selected-list {
  min-height: 200px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 8px;
}
</style>
