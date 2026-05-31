<template>
  <div class="flow-node placeholder-node">
    <div class="placeholder-header">
      <div class="placeholder-icon"></div>
      <div class="placeholder-title"></div>
    </div>
    <div class="placeholder-body">
      <div class="placeholder-line short"></div>
      <div class="placeholder-line"></div>
    </div>
    <Handle type="target" :position="Position.Left" class="ph-handle" />
    <Handle type="source" :position="Position.Right" class="ph-handle" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
</script>

<style scoped>
.flow-node {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  width: 180px;
  padding: 14px;
  opacity: 0.85;
  pointer-events: none;
}

.placeholder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.placeholder-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.placeholder-title {
  height: 10px;
  width: 50%;
  border-radius: 4px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.placeholder-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.placeholder-line {
  height: 7px;
  border-radius: 3px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.placeholder-line.short {
  width: 70%;
}

.ph-handle {
  opacity: 0;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
