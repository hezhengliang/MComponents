<template>
  <div class="flow-node condition-node">
    <div class="node-header">
      <div class="node-icon">
        <span class="if-badge">IF</span>
      </div>
      <span class="node-title">选择器</span>
    </div>
    
    <div class="node-body">
      <div class="condition-list">
        <div 
          v-for="(cond, i) in data.conditions || defaultConditions" 
          :key="i" 
          class="condition-row"
          :class="cond.type"
        >
          <span class="cond-label">{{ cond.label }}</span>
          <div class="cond-content">
            <span class="cond-field">{{ cond.field }}</span>
            <span class="cond-op">{{ cond.operator }}</span>
            <span class="cond-value">{{ cond.value }}</span>
          </div>
          <Handle
            :id="`out-${i}`"
            type="source"
            :position="Position.Right"
            class="port-handle"
          />
        </div>
      </div>
      
      <div class="else-row" v-if="data.hasElse !== false">
        <span class="cond-label">否则</span>
        <Handle
          id="out-else"
          type="source"
          :position="Position.Right"
          class="port-handle"
        />
      </div>
    </div>
    
    <div class="node-input">
      <HandleWithAdd
        id="input"
        type="target"
        :position="Position.Left"
        class="input-handle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'

const defaultConditions = [
  { label: '如果', field: '开始 - input', operator: '⊃', value: '.jpg', type: 'if' },
  { label: '或', field: '开始 - input', operator: '⊃', value: '.png', type: 'or' },
  { label: '否则如果', field: '开始 - input', operator: '⊃', value: '.mp3', type: 'elseif' },
  { label: '或', field: '开始 - input', operator: '⊃', value: '.wav', type: 'or' },
]

defineProps<{
  data: {
    conditions?: { label: string; field: string; operator: string; value: string; type: string }[]
    hasElse?: boolean
  }
}>()
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03);
  min-width: 260px;
  font-size: 13px;
  position: relative;
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
  background: #14b8a6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.if-badge {
  font-size: 10px;
  font-weight: 700;
}

.node-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 13px;
}

.node-body {
  padding: 10px 2px;
}

.condition-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.condition-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  background: #f8fafc;
  position: relative;
}

.condition-row.or {
  padding-left: 30px;
}

.cond-label {
  font-size: 11px;
  color: #64748b;
  min-width: 44px;
  flex-shrink: 0;
  font-weight: 500;
}

.cond-content {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
}

.cond-field {
  font-size: 11px;
  color: #475569;
  background: #e2e8f0;
  padding: 3px 7px;
  border-radius: 4px;
  font-weight: 500;
}

.cond-op {
  font-size: 11px;
  color: #94a3b8;
}

.cond-value {
  font-size: 11px;
  color: #475569;
  background: #f1f5f9;
  padding: 3px 7px;
  border-radius: 4px;
}

.else-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  margin-top: 5px;
}

.input-handle {
  left: 0 !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}

.node-input {
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
