<template>
  <input
    class="form-number"
    type="number"
    :value="modelValue"
    :placeholder="field.placeholder || ''"
    @input="onInput"
    @blur="$emit('blur')"
  />
</template>

<script setup lang="ts">
import type { FieldSchema } from '../types'

defineProps<{
  field: FieldSchema
  modelValue: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'blur'): void
}>()

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:modelValue', val === '' ? undefined : Number(val))
}
</script>

<style scoped>
.form-number {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #334155;
  background: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
  box-sizing: border-box;
}

.form-number:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.08);
}
</style>
