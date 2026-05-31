import type { Validator } from '../types'

export function required(message = '该字段为必填项'): Validator {
  return {
    name: 'required',
    message,
    validate: (value: any) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'string' && value.trim() === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    },
  }
}

export function pattern(regexp: RegExp, message = '格式不正确'): Validator {
  return {
    name: 'pattern',
    message,
    validate: (value: any) => {
      if (value === undefined || value === null) return true
      return regexp.test(String(value))
    },
  }
}

export function minLength(min: number, message?: string): Validator {
  return {
    name: 'minLength',
    message: message || `最少 ${min} 个字符`,
    validate: (value: any) => {
      if (value === undefined || value === null) return true
      return String(value).length >= min
    },
  }
}

export function maxLength(max: number, message?: string): Validator {
  return {
    name: 'maxLength',
    message: message || `最多 ${max} 个字符`,
    validate: (value: any) => {
      if (value === undefined || value === null) return true
      return String(value).length <= max
    },
  }
}
