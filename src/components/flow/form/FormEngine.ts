import { toRaw } from 'vue'
import { useForm } from 'vee-validate'
import type { FormMeta, FieldSchema, NodeContext } from './types'

function getPath(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj)
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function matchesWatch(watch: string | string[], changedPath: string): boolean {
  const watches = Array.isArray(watch) ? watch : [watch]
  return watches.some(w => changedPath === w || changedPath.startsWith(w + '.'))
}

function isFieldVisible(field: FieldSchema, values: Record<string, any>): boolean {
  if (!field.visible) return true
  if (typeof field.visible === 'function') return field.visible(values)
  return !!getPath(values, field.visible)
}

export function createNodeForm(nodeId: string, nodeType: string, formMeta: FormMeta, initialData: Record<string, any>) {
  const context: NodeContext = { nodeId, nodeType }

  const formatted = formMeta.formatOnInit ? formMeta.formatOnInit(clone(initialData)) : clone(initialData)

  // 使用 vee-validate 的 useForm
  const veeForm = useForm({
    validationSchema: formMeta.validationSchema,
    initialValues: formatted,
    validateOnMount: false,
  })

  const { values, errors, meta, setFieldValue } = veeForm

  function applyEffects(changedPath: string) {
    const prevValues = clone(toRaw(values))
    for (const effect of formMeta.effects || []) {
      if (matchesWatch(effect.watch, changedPath)) {
        const patch = effect.run(toRaw(values), prevValues, context)
        if (patch && typeof patch === 'object') {
          Object.entries(patch).forEach(([key, val]) => {
            setFieldValue(key, val)
          })
        }
      }
    }
  }

  function updateValue(path: string, value: any) {
    setFieldValue(path, value)
    applyEffects(path)
  }

  function getVisibleFields(): FieldSchema[] {
    return formMeta.fields.filter(f => isFieldVisible(f, toRaw(values)))
  }

  function isEmpty(): boolean {
    return formMeta.fields.every(f => {
      const v = getPath(values, f.name)
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    })
  }

  function getFieldError(path: string): string | undefined {
    return getPath(errors.value, path)
  }

  function hasFieldError(path: string): boolean {
    return !!getFieldError(path)
  }

  return {
    ...veeForm,
    values,
    errors,
    meta,
    updateValue,
    getVisibleFields,
    isEmpty,
    getFieldError,
    hasFieldError,
  }
}
