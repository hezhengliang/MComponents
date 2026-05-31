<template>
  <div class="form-array">
    <div v-if="!items.length" class="array-empty">{{ field.placeholder || '暂无数据' }}</div>
    <div
      v-for="(item, i) in items"
      :key="i"
      class="array-item"
    >
      <slot :item="item" :index="i" :update="(v: any) => updateItem(i, v)">
        <input
          class="form-text"
          :value="item"
          @input="e => updateItem(i, (e.target as HTMLInputElement).value)"
          @blur="$emit('blur')"
        />
      </slot>
      <button class="array-remove" @click="removeItem(i)">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <button class="array-add" @click="addItem">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>添加</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FieldSchema } from '../types'

const props = defineProps<{
  field: FieldSchema
  modelValue: any[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void
  (e: 'blur'): void
}>()

const items = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])

function updateItem(index: number, value: any) {
  const newItems = [...items.value]
  newItems[index] = value
  emit('update:modelValue', newItems)
}

function removeItem(index: number) {
  const newItems = items.value.filter((_, i) => i !== index)
  emit('update:modelValue', newItems)
}

function addItem() {
  const newItems = [...items.value, '']
  emit('update:modelValue', newItems)
}
</script>

<style scoped>
.form-array {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.array-empty {
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  padding: 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 6px;
}

.array-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-text {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #334155;
  outline: none;
  transition: border-color 0.15s;
}

.form-text:focus {
  border-color: #6366f1;
}

.array-remove {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.array-remove:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #ef4444;
}

.array-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.array-add:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #eef2ff;
}
</style>
