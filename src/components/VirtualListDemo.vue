<script setup lang="ts">
import { ref, computed } from 'vue'
import VirtualListSelect from './VirtualListSelect.vue'

interface ListItem {
  id: string
  label: string
}

// 生成大量测试数据
const generateData = (count: number): ListItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `List Item ${i + 1}`,
  }))
}

const listData = ref<ListItem[]>(generateData(100000))

const listRef = ref<InstanceType<typeof VirtualListSelect>>()
const selectedIds = ref<string[]>([])
const selectedCount = ref(0)

const handleSelectionChange = (ids: string[]) => {
  selectedIds.value = ids
  selectedCount.value = ids.length
}

const handleClear = () => {
  listRef.value?.clearSelection()
}

const handleSelectAll = () => {
  listRef.value?.selectAll()
}
</script>

<template>
  <div class="virtual-list-demo">
    <div class="demo-container">
      <div class="list-section">
        <h3>
          RBush + Virtual List 高性能选择
          <span class="subtitle">({{ listData.length.toLocaleString() }} 项)</span>
        </h3>
        <VirtualListSelect
          ref="listRef"
          :data="listData"
          :height="500"
          :item-height="40"
          @selection-change="handleSelectionChange"
        />
      </div>
      
      <div class="result-section">
        <h3>已选择项 ({{ selectedCount }})</h3>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">选择率：</span>
            <span class="stat-value">
              {{ ((selectedCount / listData.length) * 100).toFixed(4) }}%
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-list-demo {
  padding: 20px;
  height: 100%;
}

.demo-container {
  display: flex;
  gap: 24px;
  height: 100%;
}

.list-section,
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
