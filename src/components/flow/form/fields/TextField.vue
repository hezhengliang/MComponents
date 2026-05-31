<template>
  <input
    class="form-text"
    :value="modelValue"
    :placeholder="field.placeholder || ''"
    @input="onInput"
    @blur="$emit('blur')"
  />
</template>

<script setup lang="ts">
import type { FieldSchema } from '../types'

const props = defineProps<{
  field: FieldSchema
  modelValue: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'blur'): void
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.form-text {
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

.form-text:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.08);
}

.form-text::placeholder {
  color: #94a3b8;
}
</style>
