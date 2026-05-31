<template>
  <div class="flow-node process-node">
    <div class="node-header">
      <div class="node-icon" :style="{ background: iconBg }">
        <img v-if="data.icon" :src="data.icon" width="16" height="16" />
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <span class="node-title">{{ data.label }}</span>
      <button class="node-more" v-if="data.expandable">⋯</button>
    </div>
    
    <div class="node-body">
      <div class="port-section inputs">
        <span class="section-label">输入</span>
        <div class="port-list">
          <div v-for="(input, i) in data.inputs || []" :key="i" class="port-item">
            <Handle
              :id="`in-${i}`"
              type="target"
              :position="Position.Left"
              class="port-handle"
            />
            <span class="port-tag">{{ input.type }}</span>
            <span class="port-name">{{ input.name }}</span>
          </div>
        </div>
      </div>
      
      <div class="port-section outputs">
        <span class="section-label">输出</span>
        <div class="port-list">
          <div v-for="(output, i) in data.outputs || []" :key="i" class="port-item">
            <span class="port-tag">{{ output.type }}</span>
            <span class="port-name">{{ output.name }}</span>
            <Handle
              :id="`out-${i}`"
              type="source"
              :position="Position.Right"
              class="port-handle"
            />
          </div>
        </div>
      </div>
      
      <div v-if="data.model || data.skill" class="node-meta">
        <div v-if="data.model" class="meta-row">
          <span class="meta-dot" :style="{ background: data.modelColor || '#6366f1' }"></span>
          <span class="meta-label">模型</span>
          <span class="meta-value">{{ data.model }}</span>
        </div>
        <div v-if="data.skill" class="meta-row">
          <span class="meta-label">技能</span>
          <span class="meta-value">{{ data.skill }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    label: string
    icon?: string
    iconBg?: string
    expandable?: boolean
    inputs?: { type: string; name: string }[]
    outputs?: { type: string; name: string }[]
    model?: string
    modelColor?: string
    skill?: string
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

.node-more {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.node-more:hover {
  background: #f1f5f9;
}

.node-body {
  padding: 10px 0;
}

.port-section {
  margin-bottom: 10px;
}

.port-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 5px;
  display: block;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.port-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.port-item {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  padding: 3px 0;
}

.port-tag {
  font-size: 10px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.port-name {
  font-size: 11px;
  color: #475569;
}

.node-meta {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.meta-label {
  font-size: 11px;
  color: #94a3b8;
}

.meta-value {
  font-size: 11px;
  color: #475569;
}
</style>
