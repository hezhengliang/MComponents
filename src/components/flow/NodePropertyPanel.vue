<template>
  <div class="property-panel">
    <div class="panel-header">
      <div class="panel-title-row">
        <div class="panel-icon" :style="{ background: meta.color }">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path :d="meta.icon || ''" />
          </svg>
        </div>
        <span class="panel-title">{{ meta.label }}</span>
        <button class="panel-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <p class="panel-desc">{{ meta.description }}</p>
      <div v-if="hasErrors" class="panel-error-banner">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>配置存在错误，请检查表单</span>
      </div>
    </div>

    <div class="panel-body">
      <FormRenderer
        v-if="registryEntry?.formMeta.fields.length"
        :key="node.id"
        :node-id="node.id"
        :node-type="node.type as string"
        :form-meta="registryEntry.formMeta"
        :data="node.data"
        @update="onFormUpdate"
      />
      <div v-else class="prop-empty">
        <p>该节点暂无详细配置</p>
        <p class="prop-empty-hint">类型：{{ node?.type }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '@vue-flow/core'
import { nodeRegistry } from './form'
import FormRenderer from './form/FormRenderer.vue'

const props = defineProps<{
  node: Node
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', nodeId: string, data: Record<string, any>): void
}>()

const registryEntry = computed(() => {
  const type = props.node.type as string
  return nodeRegistry[type] || null
})

const meta = computed(() => {
  const entry = registryEntry.value
  if (entry) {
    return {
      label: entry.label,
      color: entry.color,
      icon: entry.icon,
      description: entry.description,
    }
  }
  return {
    label: props.node.type,
    color: '#94a3b8',
    icon: '',
    description: '',
  }
})

const hasErrors = computed(() => {
  const schema = registryEntry.value?.formMeta.validationSchema
  if (!schema) return false
  const result = schema.safeParse(props.node.data)
  return !result.success
})

function onFormUpdate(data: Record<string, any>) {
  emit('update', props.node.id, data)
}
</script>

<style scoped>
.property-panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 320px;
  height: 100%;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  box-shadow: -4px 0 24px rgba(0,0,0,0.06);
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.panel-title {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
  flex: 1;
}

.panel-close {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.panel-close:hover {
  background: #f1f5f9;
  color: #64748b;
}

.panel-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 8px 0 0;
  line-height: 1.5;
}

.panel-error-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #ef4444;
  font-size: 12px;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.prop-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}

.prop-empty p {
  margin: 0;
  font-size: 13px;
}

.prop-empty-hint {
  font-size: 11px;
  margin-top: 6px;
  color: #cbd5e1;
}

/* 滚动条 */
.panel-body::-webkit-scrollbar {
  width: 3px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}
</style>
