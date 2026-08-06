<template>
  <form @submit.prevent="handleSubmit">
    <template v-for="field in visibleFields" :key="field.name">
      <div
        class="form-field"
        :class="{
          'has-error': getFieldError(field.name) && isFieldTouched(field.name),
          'is-required': isRequired(field)
        }"
      >
        <label class="field-label">
          {{ field.label }}
          <span v-if="isRequired(field)" class="required-mark">*</span>
        </label>
        <p v-if="field.description" class="field-desc">{{ field.description }}</p>
        <component
          :is="getFieldComponent(field.type)"
          :field="field"
          :model-value="getFieldValue(field.name)"
          :error="getFieldError(field.name) && isFieldTouched(field.name) ? getFieldError(field.name) : undefined"
          @update:model-value="(v: any) => onFieldChange(field.name, v)"
          @blur="() => onFieldBlur(field.name)"
        />
        <div v-if="getFieldError(field.name) && isFieldTouched(field.name)" class="field-error">
          <span>{{ getFieldError(field.name) }}</span>
        </div>
      </div>
    </template>
  </form>
</template>

<script setup lang="ts">
import { computed, watch, toRaw, ref } from 'vue'
import type { FormMeta, FieldSchema } from './types'
import { createNodeForm } from './FormEngine'
import TextField from './fields/TextField.vue'
import SelectField from './fields/SelectField.vue'
import ArrayField from './fields/ArrayField.vue'
import NumberField from './fields/NumberField.vue'
import BooleanField from './fields/BooleanField.vue'

const props = defineProps<{
  nodeId: string
  nodeType: string
  formMeta: FormMeta
  data: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'update', data: Record<string, any>): void
}>()

// 内部创建 form 实例，管理状态
const form = createNodeForm(props.nodeId, props.nodeType, props.formMeta, props.data)

const fieldComponents: Record<string, any> = {
  text: TextField,
  select: SelectField,
  array: ArrayField,
  number: NumberField,
  boolean: BooleanField,
  code: TextField,
}

function getFieldComponent(type: string) {
  return fieldComponents[type] || TextField
}

// 缓存 isRequired 结果
const requiredCache = ref<Map<string, boolean>>(new Map())

function isRequired(field: FieldSchema): boolean {
  const schema = props.formMeta.validationSchema
  if (!schema) return false

  const cached = requiredCache.value.get(field.name)
  if (cached !== undefined) return cached

  try {
    const testData: Record<string, any> = {}
    const result = schema.safeParse(testData)
    if (!result.success) {
      const issues = result.error.issues
      const required = issues.some((issue: any) => issue.path[0] === field.name)
      requiredCache.value.set(field.name, required)
      return required
    }
    requiredCache.value.set(field.name, false)
    return false
  } catch {
    requiredCache.value.set(field.name, false)
    return false
  }
}

const visibleFields = computed(() => {
  return props.formMeta.fields.filter(f => {
    if (!f.visible) return true
    if (typeof f.visible === 'function') return f.visible(form.values)
    return !!form.values[f.visible]
  })
})

// 获取字段值 - 使用响应式引用
function getFieldValue(path: string): any {
  return path.split('.').reduce((o: any, k: string) => (o && k in o ? o[k] : undefined), form.values)
}

// 获取字段错误 - 使用 vee-validate 的 errors.value
function getFieldError(path: string): string | undefined {
  return form.errors.value[path]
}

// 检查字段是否 touched - 使用 vee-validate 的 isFieldTouched
function isFieldTouched(path: string): boolean {
  return form.isFieldTouched(path)
}

function onFieldBlur(path: string) {
  // 标记字段为 touched
  form.setFieldTouched(path, true)

  // 根据 validateTrigger 配置决定是否触发校验
  const trigger = props.formMeta.validateTrigger ?? 'blur'
  if (trigger === 'blur' || trigger === 'change') {
    // 触发全表单校验以支持跨字段联动校验
    form.validate()
  }
}

// 字段变化处理
function onFieldChange(path: string, value: any) {
  form.updateValue(path, value)

  // 根据 validateTrigger 配置触发校验
  const trigger = props.formMeta.validateTrigger ?? 'blur'
  if (trigger === 'change') {
    // 标记 touched 并触发全表单校验（支持跨字段联动校验）
    form.setFieldTouched(path, true)
    form.validate()
  }

  // 应用 effects 后，emit 最新值
  const rawValues = toRaw(form.values)
  emit('update', { ...rawValues })
}

// 监听外部 data 变化，同步到 form（但不覆盖用户正在编辑的字段）
watch(() => props.data, (newData) => {
  if (!newData) return
  const currentValues = toRaw(form.values)

  // 只同步外部变更的字段，避免覆盖用户当前输入
  Object.entries(newData).forEach(([key, val]) => {
    const currentVal = currentValues[key]
    // 如果外部值和当前 form 值不同
    if (JSON.stringify(currentVal) !== JSON.stringify(val)) {
      form.setFieldValue(key, val, false) // false = 不触发校验
    }
  })
}, { deep: true })

function handleSubmit() {
  form.handleSubmit((values: Record<string, any>) => {
    emit('update', values)
  })()
}
</script>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.form-field.has-error :deep(.form-text),
.form-field.has-error :deep(.form-select),
.form-field.has-error :deep(.form-number) {
  border-color: #ef4444;
}

.form-field.has-error :deep(.form-text:focus),
.form-field.has-error :deep(.form-select:focus),
.form-field.has-error :deep(.form-number:focus) {
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.08);
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 2px;
}

.required-mark {
  color: #ef4444;
}

.field-desc {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

.field-error {
  font-size: 11px;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 4px;
}

.field-error::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
}
</style>
