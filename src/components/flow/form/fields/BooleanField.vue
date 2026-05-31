<template>
  <label class="form-boolean">
    <input
      type="checkbox"
      :checked="!!modelValue"
      @change="onChange"
    />
    <span class="boolean-slider"></span>
    <span v-if="field.label" class="boolean-label">{{ field.label }}</span>
  </label>
</template>

<script setup lang="ts">
import type { FieldSchema } from '../types'

defineProps<{
  field: FieldSchema
  modelValue: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.form-boolean {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.form-boolean input {
  display: none;
}

.boolean-slider {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: #e2e8f0;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.boolean-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.form-boolean input:checked + .boolean-slider {
  background: #6366f1;
}

.form-boolean input:checked + .boolean-slider::after {
  transform: translateX(14px);
}

.boolean-label {
  font-size: 13px;
  color: #334155;
}
</style>
