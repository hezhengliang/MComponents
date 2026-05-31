<template>
  <div class="flow-node table-node">
    <div class="node-header">
      <div class="node-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M4 4h16v16H4V4zm2 2v4h4V6H6zm6 0v4h4V6h-4zm6 0v4h4V6h-4zM6 12v4h4v-4H6zm6 0v4h4v-4h-4zm6 0v4h4v-4h-4zM6 18v2h12v-2H6z"/>
        </svg>
      </div>
      <span class="node-title">{{ data.tableName || 'Table' }}</span>
      <span class="node-badge">{{ data.fields?.length || 0 }} fields</span>
      <span v-if="hasError" class="node-error-badge" title="配置有误">!</span>
    </div>
    <div v-if="isEmpty" class="node-placeholder">
      <div class="ph-line" />
      <div class="ph-line short" />
    </div>
    <div v-else class="node-body" @wheel.stop @mousedown.stop>
      <div class="field-list">
        <div v-for="(field, i) in data.fields || []" :key="i" class="field-row">
          <span class="field-dot" :class="field.type"></span>
          <span class="field-name">{{ field.name }}</span>
          <span class="field-type">{{ field.type }}</span>
          <span
            class="field-toggle nodrag"
            :class="{ on: field.connectable !== false }"
            @click.stop="toggleField(i)"
            title="切换连接"
          ></span>
          <Handle
            v-if="field.connectable !== false"
            :id="`field-${i}`"
            type="source"
            :position="Position.Right"
            class="field-handle"
          />
        </div>
      </div>
    </div>
    <HandleWithAdd
      v-if="data.showInputHandle !== false"
      id="table-in"
      type="target"
      :position="Position.Left"
      class="main-handle"
    />
    <HandleWithAdd
      v-if="data.showOutputHandle !== false"
      id="table-out"
      type="source"
      :position="Position.Right"
      class="main-handle"
      style="top: 50%;"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, useNode, useVueFlow } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'

const props = defineProps<{
  data: {
    tableName: string
    fields?: { name: string; type: string; connectable?: boolean }[]
    showInputHandle?: boolean
    showOutputHandle?: boolean
  }
}>()

const { id } = useNode()
const { updateNodeData } = useVueFlow()

const hasError = computed(() => {
  return !props.data.tableName || props.data.tableName === 'new_table'
})

const isEmpty = computed(() => {
  return !props.data.tableName || props.data.tableName === 'new_table'
})

function toggleField(index: number) {
  const fields = [...(props.data.fields || [])]
  const field = fields[index]
  if (!field) return
  fields[index] = { ...field, connectable: field.connectable === false }
  updateNodeData(id, { ...props.data, fields })
}
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03);
  min-width: 200px;
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
  background: #f59e0b;
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
  flex-shrink: 0;
}

.node-body {
  padding: 6px 10px 6px 10px;
  max-height: 180px;
  overflow-y: auto;
  border-radius: 0 0 10px 10px;
  overscroll-behavior: contain;
  touch-action: pan-y;
}

@supports (overflow-y: overlay) {
  .node-body {
    overflow-y: overlay;
  }
}

.node-body::-webkit-scrollbar {
  width: 2px;
}

.node-body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}

.field-list {
  display: flex;
  flex-direction: column;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  position: relative;
  transition: background 0.15s;
}

.field-row:hover {
  background: #f8fafc;
}

.field-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.field-dot.string { background: #3b82f6; }
.field-dot.int { background: #10b981; }
.field-dot.float { background: #8b5cf6; }
.field-dot.bool { background: #f59e0b; }
.field-dot.date { background: #ec4899; }
.field-dot.default { background: #94a3b8; }

.field-name {
  font-size: 12px;
  color: #334155;
  flex: 1;
  font-weight: 500;
}

.field-type {
  font-size: 10px;
  color: #94a3b8;
}

.field-toggle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid #cbd5e1;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.field-toggle.on {
  background: #10b981;
  border-color: #10b981;
}

.field-toggle:hover {
  border-color: #94a3b8;
  transform: scale(1.15);
}

.field-handle {
  right: -2px !important;
}

.main-handle {
  top: 50% !important;
  transform: translateY(-50%) !important;
}
</style>
