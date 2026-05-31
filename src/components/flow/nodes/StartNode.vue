<template>
  <div class="flow-node start-node">
    <div class="node-header">
      <div class="node-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <span class="node-title">开始</span>
    </div>
    <HandleWithAdd
      id="output"
      type="source"
      :position="Position.Right"
    />
  </div>
</template>

<script setup lang="ts">
import { Position } from '@vue-flow/core'
import HandleWithAdd from '../HandleWithAdd.vue'
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03);
  min-width: 100px;
  padding: 12px 14px;
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
}

.node-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: #6366f1;
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
}

</style>
