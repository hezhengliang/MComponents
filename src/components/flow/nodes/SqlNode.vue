<template>
  <div class="flow-node sql-node">
    <div class="node-header">
      <div class="node-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </div>
      <span class="node-title">SQL Query</span>
      <span class="dialect-badge">{{ data.dialect || 'mysql' }}</span>
    </div>
    <div class="node-body">
      <div class="sql-preview">
        <div class="sql-line">
          <span class="sql-keyword">SELECT</span>
          <span class="sql-field">{{ data.selectFields?.join(', ') || '*' }}</span>
        </div>
        <div class="sql-line">
          <span class="sql-keyword">FROM</span>
          <span class="sql-table">{{ data.fromTable || '?' }}</span>
        </div>
        <div v-if="data.whereClauses?.length" class="sql-line">
          <span class="sql-keyword">WHERE</span>
          <span class="sql-clause">{{ data.whereClauses[0] }}</span>
        </div>
      </div>
    </div>
    <HandleWithAdd id="sql-in" type="target" :position="Position.Left" class="main-handle" />
    <HandleWithAdd id="sql-out" type="source" :position="Position.Right" class="main-handle" />
  </div>
</template>

<script setup lang="ts">
import { Position } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'

defineProps<{
  data: {
    selectFields?: string[]
    fromTable?: string
    whereClauses?: string[]
    dialect?: string
  }
}>()
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03);
  min-width: 240px;
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
  background: #0ea5e9;
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

.dialect-badge {
  font-size: 10px;
  font-weight: 600;
  color: #0369a1;
  background: #e0f2fe;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
}

.node-body {
  padding: 12px 0;
}

.sql-preview {
  background: #0f172a;
  border-radius: 8px;
  padding: 12px 14px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.8;
}

.sql-line {
  display: block;
}

.sql-keyword {
  color: #c084fc;
  font-weight: 600;
  margin-right: 6px;
}

.sql-field {
  color: #7dd3fc;
}

.sql-table {
  color: #fbbf24;
}

.sql-clause {
  color: #a5f3fc;
}

.main-handle {
  top: 50% !important;
  transform: translateY(-50%) !important;
}
</style>
