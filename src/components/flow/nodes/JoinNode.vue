<template>
  <div class="flow-node join-node">
    <div class="node-header">
      <div class="node-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      </div>
      <span class="node-title">Join</span>
      <span class="join-type-badge">{{ data.joinType || 'LEFT' }} JOIN</span>
    </div>
    <div class="node-body">
      <div class="join-tables">
        <div class="table-side">
          <Handle
            id="join-left"
            type="target"
            :position="Position.Left"
            class="port-handle side-handle"
            style="top: 30%"
          />
          <span class="side-label">左表</span>
          <span class="side-name">{{ data.leftTable || '?' }}</span>
        </div>
        <div class="join-symbol">⋈</div>
        <div class="table-side">
          <Handle
            id="join-right"
            type="target"
            :position="Position.Left"
            class="port-handle side-handle"
            style="top: 70%"
          />
          <span class="side-label">右表</span>
          <span class="side-name">{{ data.rightTable || '?' }}</span>
        </div>
      </div>
      <div class="on-clause" v-if="data.onCondition">
        <span class="on-label">ON</span>
        <span class="on-value">{{ data.onCondition }}</span>
      </div>
    </div>
    <HandleWithAdd
      id="join-out"
      type="source"
      :position="Position.Right"
      class="main-handle"
    />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'

defineProps<{
  data: {
    joinType?: string
    leftTable?: string
    rightTable?: string
    onCondition?: string
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
  background: #ec4899;
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

.join-type-badge {
  font-size: 10px;
  font-weight: 600;
  color: #be185d;
  background: #fdf2f8;
  padding: 3px 8px;
  border-radius: 6px;
}

.node-body {
  padding: 12px 0;
}

.join-tables {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.table-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
  position: relative;
}

.side-label {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 500;
}

.side-name {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.join-symbol {
  font-size: 20px;
  color: #ec4899;
  font-weight: bold;
}

.on-clause {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: #fdf2f8;
  border-radius: 6px;
  font-size: 11px;
}

.on-label {
  color: #be185d;
  font-weight: 600;
}

.on-value {
  color: #475569;
  font-family: 'Fira Code', monospace;
}

.side-handle {
  left: -2px !important;
}

.main-handle {
  right: -2px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}
</style>
