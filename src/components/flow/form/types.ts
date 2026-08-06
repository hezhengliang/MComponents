import type { Component } from 'vue'
import type { ZodTypeAny } from 'zod'

export interface NodeContext {
  nodeId: string
  nodeType: string
}

export interface FieldSchema {
  name: string
  type: 'text' | 'select' | 'array' | 'code' | 'number' | 'boolean'
  label: string
  defaultValue?: any
  options?: { label: string; value: any }[]
  visible?: string | ((values: Record<string, any>) => boolean)
  placeholder?: string
  description?: string
}

export interface Effect {
  watch: string | string[]
  run: (values: Record<string, any>, prevValues: Record<string, any>, context: NodeContext) => Record<string, any> | void
}

export interface FormMeta {
  fields: FieldSchema[]
  validationSchema?: ZodTypeAny
  validateTrigger?: 'change' | 'blur' | 'submit'
  effects?: Effect[]
  formatOnInit?: (data: Record<string, any>) => Record<string, any>
  formatOnSubmit?: (data: Record<string, any>) => Record<string, any>
}

export interface NodeRegistryEntry {
  type: string
  component: Component
  formMeta: FormMeta
  defaultData: () => Record<string, any>
  icon: string
  color: string
  label: string
  description: string
}
