<script setup lang="ts">
import { ref, computed } from 'vue'
import TreeShiftSelectV2 from './TreeShiftSelectV2.vue'

interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

// 生成大量测试数据
const generateData = (count: number, depth: number = 3, prefix: string = ''): TreeNode[] => {
  const result: TreeNode[] = []
  const perLevel = Math.ceil(Math.pow(count, 1 / depth))
  
  for (let i = 0; i < perLevel && result.length < count; i++) {
    const id = prefix ? `${prefix}-${i}` : `${i}`
    const node: TreeNode = {
      id,
      label: `Node ${id}`,
    }
    
    if (depth > 1 && result.length < count - 1) {
      const remaining = count - result.length - 1
      const childCount = Math.min(perLevel, remaining)
      if (childCount > 0) {
        node.children = generateData(childCount, depth - 1, id)
      }
    }
    
    result.push(node)
  }
  
  return result
}

// 生成 10000 个节点
const treeData = ref<TreeNode[]>(generateData(10000, 4))

// 计算总节点数（包括所有子节点）
const totalNodeCount = computed(() => {
  let count = 0
  const countNodes = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      count++
      if (node.children) {
        countNodes(node.children)
      }
    }
  }
  countNodes(treeData.value)
  return count
})

// 获取所有节点ID（用于全选）
const allNodeIds = computed(() => {
  const ids: string[] = []
  const collectIds = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      ids.push(node.id)
      if (node.children) {
        collectIds(node.children)
      }
    }
  }
  collectIds(treeData.value)
  return ids
})

const treeRef = ref<InstanceType<typeof TreeShiftSelectV2>>()
const selectedIds = ref<string[]>([])
const selectedCount = ref(0)

const handleSelectionChange = (ids: string[]) => {
  selectedIds.value = ids
  selectedCount.value = ids.length
}

const handleClear = () => {
  treeRef.value?.clearSelection()
}

const handleSelectAll = () => {
  treeRef.value?.selectAll()
}

const expandedKeys = ref<string[]>([])

const handleExpandAll = () => {
  // el-tree-v2 使用 setExpandedKeys 展开所有节点
  expandedKeys.value = allNodeIds.value
}

const handleCollapseAll = () => {
  // 折叠所有节点
  expandedKeys.value = []
}
</script>

<template>
  <div class="tree-v2-demo">
    <div class="demo-container">
      <div class="tree-section">
        <h3>
          Tree V2 + R-tree 高性能版本
          <span class="subtitle">({{ totalNodeCount.toLocaleString() }} 节点)</span>
        </h3>
        <TreeShiftSelectV2
          ref="treeRef"
          v-model:expanded-keys="expandedKeys"
          :data="treeData"
          :all-node-ids="allNodeIds"
          :height="500"
          :item-height="32"
          @selection-change="handleSelectionChange"
        />
      </div>
      
      <div class="result-section">
        <h3>已选择项 ({{ selectedCount }})</h3>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">选择率：</span>
            <span class="stat-value">
              {{ ((selectedCount / totalNodeCount) * 100).toFixed(2) }}%
            </span>
          </div>
        </div>
        <div class="selected-list">
          <el-tag
            v-for="id in selectedIds.slice(0, 100)"
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
          <el-tag v-if="selectedIds.length > 100" type="info">
            +{{ selectedIds.length - 100 }} more
          </el-tag>
          <el-empty v-if="selectedIds.length === 0" description="暂无选择" />
        </div>
        
        <div class="actions">
          <el-button type="primary" @click="handleSelectAll">全选</el-button>
          <el-button @click="handleClear">清空</el-button>
          <el-button @click="handleExpandAll">展开全部</el-button>
          <el-button @click="handleCollapseAll">折叠全部</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-v2-demo {
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
  display: flex;
  flex-direction: column;
  min-height: 0;
}

h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.subtitle {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.stats {
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.stat-value {
  font-size: 14px;
  color: #409eff;
  font-weight: bold;
}

.selected-list {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 8px;
}
</style>
