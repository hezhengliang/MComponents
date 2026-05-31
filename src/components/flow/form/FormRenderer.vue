<template>
  <Form
    :validation-schema="formMeta.validationSchema"
    :initial-values="data"
    :validate-on-mount="false"
    :validate-on-blur="formMeta.validateTrigger === 'blur'"
    :validate-on-change="formMeta.validateTrigger === 'change'"
    @submit="onSubmit"
  >
    <template v-for="field in visibleFields" :key="field.name">
      <Field
        v-slot="{ field: vf, errorMessage, meta: fieldMeta }"
        :name="field.name"
      >
        <div
          class="form-field"
          :class="{
            'has-error': errorMessage && fieldMeta.touched,
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
            :model-value="vf.value"
            :error="errorMessage && fieldMeta.touched ? errorMessage : undefined"
            @update:model-value="(v: any) => onFieldChange(field.name, v)"
            @blur="(_e: FocusEvent) => { vf.onBlur?.(_e); }"
          />
          <div v-if="errorMessage && fieldMeta.touched" class="field-error">
            <span>{{ errorMessage }}</span>
          </div>
        </div>
      </Field>
    </template>
  </Form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Form, Field } from 'vee-validate'
import type { FormMeta, FieldSchema } from './types'
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

function isRequired(field: FieldSchema): boolean {
  // 检查 yup schema 中该字段是否 required
  const schema = props.formMeta.validationSchema
  if (!schema) return false
  try {
    const desc = schema.describe()
    const fieldDesc = (desc.fields as any)?.[field.name]
    return fieldDesc?.tests?.some((t: any) => t.name === 'required') ?? false
  } catch {
    return false
  }
}

function getVisibleFields(): FieldSchema[] {
  return props.formMeta.fields.filter(f => {
    if (!f.visible) return true
    if (typeof f.visible === 'function') return f.visible(props.data)
    return !!props.data[f.visible]
  })
}

const visibleFields = computed(() => getVisibleFields())

// 副作用：字段变化时触发
const prevData = computed(() => ({ ...props.data }))

function onFieldChange(path: string, value: any) {
  // 构建新的 data 对象
  const newData = clone(props.data)
  setPath(newData, path, value)

  // 应用 effects
  const effects = props.formMeta.effects
  if (effects) {
    for (const effect of effects) {
      if (matchesWatch(effect.watch, path)) {
        const patch = effect.run(newData, prevData.value, { nodeId: props.nodeId, nodeType: props.nodeType })
        if (patch && typeof patch === 'object') {
          Object.entries(patch).forEach(([key, val]) => {
            setPath(newData, key, val)
          })
        }
      }
    }
  }

  emit('update', newData)
}

function onSubmit(values: Record<string, any>) {
  emit('update', values)
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function setPath(obj: Record<string, any>, path: string, value: any) {
  const keys = path.split('.')
  const last = keys.pop()!
  const target = keys.reduce((o, k) => {
    if (!(k in o)) o[k] = {}
    return o[k]
  }, obj)
  target[last] = value
}

function matchesWatch(watch: string | string[], changedPath: string): boolean {
  const watches = Array.isArray(watch) ? watch : [watch]
  return watches.some(w => changedPath === w || changedPath.startsWith(w + '.'))
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
