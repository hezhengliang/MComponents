<template>
  <div class="flow-node where-node">
    <div class="node-header">
      <div class="node-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <span class="node-title">WHERE</span>
      <span class="node-badge">{{ (data.conditions || []).length }} 条件</span>
    </div>
    <div class="node-body">
      <div class="condition-list">
        <div
          v-for="(cond, i) in data.conditions || []"
          :key="i"
          class="cond-row"
        >
          <span v-if="i > 0" class="cond-logic">{{ cond.logic || 'AND' }}</span>
          <div class="cond-content">
            <span class="cond-field">{{ cond.field }}</span>
            <span class="cond-op">{{ cond.operator }}</span>
            <span class="cond-value">{{ cond.value }}</span>
          </div>
        </div>
        <div v-if="!(data.conditions || []).length" class="cond-empty">
          点击添加条件
        </div>
      </div>
    </div>
    <HandleWithAdd
      id="where-in"
      type="target"
      :position="Position.Left"
      class="main-handle"
    />
    <HandleWithAdd
      id="where-out"
      type="source"
      :position="Position.Right"
      class="main-handle"
    />
  </div>
</template>

<script setup lang="ts">
import { Position } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'

defineProps<{
  data: {
    conditions?: { field: string; operator: string; value: string; logic?: string }[]
  }
}>()
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03);
  min-width: 220px;
  font-size: 13px;
  transition: box-shadow 0.2s;
}

.flow-node:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.node-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: #10b981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 13px;
  flex: 1;
}

.node-badge {
  font-size: 10px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.node-body {
  padding: 10px 0;
}

.condition-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cond-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cond-logic {
  font-size: 10px;
  color: #10b981;
  font-weight: 600;
  padding-left: 4px;
}

.cond-content {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  background: #f0fdf4;
  border-radius: 6px;
  font-size: 11px;
}

.cond-field {
  color: #065f46;
  font-weight: 500;
}

.cond-op {
  color: #059669;
  font-weight: 600;
}

.cond-value {
  color: #047857;
  background: #d1fae5;
  padding: 2px 6px;
  border-radius: 4px;
}

.cond-empty {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  padding: 12px;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
}

.main-handle {
  top: 50% !important;
  transform: translateY(-50%) !important;
}
</style>
