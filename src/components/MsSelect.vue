<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  shallowRef,
} from 'vue'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  [key: string]: any
}

interface Props {
  modelValue: string | number | (string | number)[]
  options: SelectOption[]
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  filterable?: boolean
  itemHeight?: number
  maxHeight?: number
  buffer?: number // 缓冲数量
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  placeholder: '请选择',
  disabled: false,
  clearable: false,
  filterable: false,
  itemHeight: 34,
  maxHeight: 200,
  buffer: 5, // 上下各多渲染 5 项
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[]]
  change: [value: string | number | (string | number)[]]
}>()

// ============ 状态 ============
const isOpen = ref(false)
const searchQuery = ref('')
const hoverIndex = ref(-1)
const selectedIndex = ref(-1)
const dropdownRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const scrollbarRef = ref<HTMLElement>()

// 使用 shallowRef 优化性能，滚动位置变化频繁
const scrollTop = shallowRef(0)
const rafId = ref<number | null>(null)
const isScrolling = shallowRef(false)
const scrollTimeout = ref<number | null>(null)

// ============ 计算属性 ============

// 过滤后的选项 - 缓存结果避免重复计算
let _filteredCache: SelectOption[] | null = null
let _lastQuery = ''

const filteredOptions = computed(() => {
  const query = searchQuery.value
  if (query === _lastQuery && _filteredCache) {
    return _filteredCache
  }
  _lastQuery = query
  
  if (!props.filterable || !query) {
    _filteredCache = props.options
    return _filteredCache
  }
  const lowerQuery = query.toLowerCase()
  _filteredCache = props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(lowerQuery) ||
      String(opt.value).toLowerCase().includes(lowerQuery)
  )
  return _filteredCache
})

// 是否为空
const isEmpty = computed(() => filteredOptions.value.length === 0)

// 当前选中值的标签
const selectedLabel = computed(() => {
  if (props.multiple) {
    const values = props.modelValue as (string | number)[]
    if (values.length === 0) return ''
    if (values.length === 1) {
      const opt = props.options.find((o) => o.value === values[0])
      return opt?.label || ''
    }
    return `已选择 ${values.length} 项`
  }
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label || ''
})

// 是否已选中
const isSelected = (value: string | number) => {
  if (props.multiple) {
    return (props.modelValue as (string | number)[]).includes(value)
  }
  return props.modelValue === value
}

// 虚拟滚动计算 - 优化后
const totalHeight = computed(
  () => filteredOptions.value.length * props.itemHeight
)

const visibleCount = computed(
  () => Math.ceil(props.maxHeight / props.itemHeight)
)

// 带缓冲的 startIndex
const startIndex = computed(() => {
  const rawStart = Math.floor(scrollTop.value / props.itemHeight)
  return Math.max(0, rawStart - props.buffer)
})

// 带缓冲的 endIndex
const endIndex = computed(() => {
  const rawEnd = startIndex.value + visibleCount.value + props.buffer * 2
  return Math.min(rawEnd, filteredOptions.value.length)
})

// 列表内容的偏移量
const listOffset = computed(() => startIndex.value * props.itemHeight)

// 可见选项 - 预计算样式避免重复计算
const visibleOptions = computed(() => {
  const options = filteredOptions.value
  const start = startIndex.value
  const end = endIndex.value
  const itemHeight = props.itemHeight
  
  const result = new Array(end - start)
  for (let i = start, idx = 0; i < end; i++, idx++) {
    const opt = options[i]
    result[idx] = {
      ...opt,
      _index: i,
      _transform: `translateY(${i * itemHeight}px)`,
    }
  }
  return result
})

// 列表实际高度（减去搜索框）
const listHeight = computed(() => props.maxHeight - (props.filterable ? 40 : 0))

// 滚动条计算 - 基于实际列表高度
const scrollbarConfig = computed(() => {
  if (totalHeight.value <= listHeight.value) {
    return { show: false, thumbHeight: 0, thumbTop: 0 }
  }
  
  // 可视区域与总内容的比例
  const ratio = listHeight.value / totalHeight.value
  // thumb 最小高度 30px
  const thumbHeight = Math.max(ratio * listHeight.value, 30)
  // 轨道可用高度
  const trackHeight = listHeight.value - thumbHeight
  // 滚动进度 (0-1)
  const scrollProgress = Math.min(scrollTop.value / (totalHeight.value - listHeight.value), 1)
  // thumb 位置
  const thumbTop = scrollProgress * trackHeight
  
  return { show: true, thumbHeight, thumbTop }
})

// 是否需要显示滚动条
const showScrollbar = computed(() => scrollbarConfig.value.show)

// ============ 方法 ============

const selectRef = ref<HTMLElement>()
const isFocused = ref(false)

const focus = () => {
  selectRef.value?.focus()
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

const toggleDropdown = () => {
  if (props.disabled) return
  // 确保组件获得焦点
  focus()
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      inputRef.value?.focus()
      scrollToSelected()
    })
  }
}

const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
  hoverIndex.value = -1
  _filteredCache = null
  _lastQuery = ''
}

const handleSelect = (option: SelectOption) => {
  if (option.disabled) return

  if (props.multiple) {
    const values = [...(props.modelValue as (string | number)[])]
    const index = values.indexOf(option.value)
    if (index > -1) {
      values.splice(index, 1)
    } else {
      values.push(option.value)
    }
    emit('update:modelValue', values)
    emit('change', values)
  } else {
    emit('update:modelValue', option.value)
    emit('change', option.value)
    closeDropdown()
  }
}

const handleClear = (e: Event) => {
  e.stopPropagation()
  if (props.multiple) {
    emit('update:modelValue', [])
    emit('change', [])
  } else {
    emit('update:modelValue', '')
    emit('change', '')
  }
}

// 使用 RAF 节流的滚动处理
const handleScroll = (e: Event) => {
  const newScrollTop = (e.target as HTMLElement).scrollTop
  
  // 直接更新滚动位置用于滚动条同步
  scrollTop.value = newScrollTop
  
  // 标记正在滚动
  isScrolling.value = true
  
  // 清除之前的 timeout
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  
  // 滚动停止后 150ms 取消标记
  scrollTimeout.value = window.setTimeout(() => {
    isScrolling.value = false
  }, 150)
}

// 滚动条拖拽
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartScrollTop = ref(0)

const handleScrollbarMouseDown = (e: MouseEvent) => {
  e.preventDefault()
  isDragging.value = true
  dragStartY.value = e.clientY
  dragStartScrollTop.value = scrollTop.value
  document.addEventListener('mousemove', handleScrollbarMouseMove, { passive: false })
  document.addEventListener('mouseup', handleScrollbarMouseUp, { passive: true })
}

const handleScrollbarMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !listRef.value) return
  e.preventDefault()
  
  const deltaY = e.clientY - dragStartY.value
  const trackHeight = listHeight.value - scrollbarConfig.value.thumbHeight
  const scrollRatio = deltaY / trackHeight
  const maxScroll = totalHeight.value - listHeight.value
  const newScrollTop = Math.max(0, Math.min(
    dragStartScrollTop.value + scrollRatio * maxScroll,
    maxScroll
  ))
  listRef.value.scrollTop = newScrollTop
  scrollTop.value = newScrollTop
}

const handleScrollbarMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleScrollbarMouseMove)
  document.removeEventListener('mouseup', handleScrollbarMouseUp)
}

const scrollToSelected = () => {
  if (selectedIndex.value === -1) return
  nextTick(() => {
    const offset = selectedIndex.value * props.itemHeight
    const minScroll = offset - props.maxHeight + props.itemHeight
    const maxScroll = offset
    let newScrollTop = scrollTop.value
    if (newScrollTop < minScroll) {
      newScrollTop = minScroll
    } else if (newScrollTop > maxScroll) {
      newScrollTop = maxScroll
    }
    if (listRef.value && newScrollTop !== scrollTop.value) {
      listRef.value.scrollTop = newScrollTop
      scrollTop.value = newScrollTop
    }
  })
}

// 键盘导航
const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) {
    // 下拉框关闭时，上下键直接切换选项
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectNextOption()
        break
      case 'ArrowUp':
        e.preventDefault()
        selectPrevOption()
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        toggleDropdown()
        break
    }
    return
  }

  // 下拉框打开时的键盘导航
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      closeDropdown()
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (hoverIndex.value >= 0 && hoverIndex.value < filteredOptions.value.length) {
        const option = filteredOptions.value[hoverIndex.value]
        if (!option.disabled) {
          handleSelect(option)
        }
      }
      break
    case 'ArrowDown':
      e.preventDefault()
      navigateNext()
      break
    case 'ArrowUp':
      e.preventDefault()
      navigatePrev()
      break
    case 'Home':
      e.preventDefault()
      navigateFirst()
      break
    case 'End':
      e.preventDefault()
      navigateLast()
      break
    case 'PageDown':
      e.preventDefault()
      navigatePageDown()
      break
    case 'PageUp':
      e.preventDefault()
      navigatePageUp()
      break
    case 'Tab':
      closeDropdown()
      break
  }
}

// 关闭状态下选择下一个选项
const selectNextOption = () => {
  const options = props.options
  const currentIndex = options.findIndex(o => o.value === props.modelValue)
  let newIndex = currentIndex + 1
  
  // 跳过禁用项，循环到开头
  while (newIndex < options.length && options[newIndex]?.disabled) {
    newIndex++
  }
  
  if (newIndex < options.length) {
    const option = options[newIndex]
    emit('update:modelValue', option.value)
    emit('change', option.value)
  } else {
    // 循环到第一个可用选项
    const firstEnabled = options.findIndex(o => !o.disabled)
    if (firstEnabled !== -1 && firstEnabled !== currentIndex) {
      const option = options[firstEnabled]
      emit('update:modelValue', option.value)
      emit('change', option.value)
    }
  }
}

// 关闭状态下选择上一个选项
const selectPrevOption = () => {
  const options = props.options
  const currentIndex = options.findIndex(o => o.value === props.modelValue)
  let newIndex = currentIndex - 1
  
  // 跳过禁用项
  while (newIndex >= 0 && options[newIndex]?.disabled) {
    newIndex--
  }
  
  if (newIndex >= 0) {
    const option = options[newIndex]
    emit('update:modelValue', option.value)
    emit('change', option.value)
  } else {
    // 循环到最后一个可用选项
    for (let i = options.length - 1; i >= 0; i--) {
      if (!options[i].disabled) {
        if (i !== currentIndex) {
          emit('update:modelValue', options[i].value)
          emit('change', options[i].value)
        }
        break
      }
    }
  }
}

// 导航方法
const navigateNext = () => {
  const maxIndex = filteredOptions.value.length - 1
  let newIndex = hoverIndex.value + 1
  
  while (newIndex <= maxIndex && filteredOptions.value[newIndex]?.disabled) {
    newIndex++
  }
  
  if (newIndex <= maxIndex) {
    hoverIndex.value = newIndex
    scrollToIndex(hoverIndex.value)
  }
}

const navigatePrev = () => {
  let newIndex = hoverIndex.value - 1
  if (newIndex < 0) newIndex = 0
  
  while (newIndex >= 0 && filteredOptions.value[newIndex]?.disabled) {
    newIndex--
  }
  
  if (newIndex >= 0) {
    hoverIndex.value = newIndex
    scrollToIndex(hoverIndex.value)
  }
}

const navigateFirst = () => {
  const firstEnabled = filteredOptions.value.findIndex(o => !o.disabled)
  if (firstEnabled !== -1) {
    hoverIndex.value = firstEnabled
    scrollToIndex(hoverIndex.value)
  }
}

const navigateLast = () => {
  for (let i = filteredOptions.value.length - 1; i >= 0; i--) {
    if (!filteredOptions.value[i].disabled) {
      hoverIndex.value = i
      scrollToIndex(hoverIndex.value)
      break
    }
  }
}

const navigatePageDown = () => {
  const pageSize = Math.floor(props.maxHeight / props.itemHeight)
  let newIndex = Math.min(hoverIndex.value + pageSize, filteredOptions.value.length - 1)
  
  while (newIndex < filteredOptions.value.length && filteredOptions.value[newIndex]?.disabled) {
    newIndex++
  }
  
  if (newIndex < filteredOptions.value.length) {
    hoverIndex.value = newIndex
    scrollToIndex(hoverIndex.value)
  }
}

const navigatePageUp = () => {
  const pageSize = Math.floor(props.maxHeight / props.itemHeight)
  let newIndex = Math.max(hoverIndex.value - pageSize, 0)
  
  while (newIndex >= 0 && filteredOptions.value[newIndex]?.disabled) {
    newIndex--
  }
  
  if (newIndex >= 0) {
    hoverIndex.value = newIndex
    scrollToIndex(hoverIndex.value)
  }
}

const scrollToIndex = (index: number) => {
  const offset = index * props.itemHeight
  const minScroll = offset - props.maxHeight + props.itemHeight
  const maxScroll = offset
  
  let newScrollTop = scrollTop.value
  if (newScrollTop > maxScroll) {
    newScrollTop = maxScroll
  } else if (newScrollTop < minScroll) {
    newScrollTop = minScroll
  }
  
  if (listRef.value && newScrollTop !== scrollTop.value) {
    listRef.value.scrollTop = newScrollTop
    scrollTop.value = newScrollTop
  }
}

const handleMouseEnter = (index: number) => {
  hoverIndex.value = index
}

// 点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (
    dropdownRef.value?.contains(target) ||
    triggerRef.value?.contains(target)
  ) {
    return
  }
  closeDropdown()
}

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('mousemove', handleScrollbarMouseMove)
  document.removeEventListener('mouseup', handleScrollbarMouseUp)
  if (rafId.value) cancelAnimationFrame(rafId.value)
  if (scrollTimeout.value) clearTimeout(scrollTimeout.value)
})

// 监听选项变化
watch(
  () => props.modelValue,
  () => {
    if (props.multiple) return
    const index = filteredOptions.value.findIndex(
      (o) => o.value === props.modelValue
    )
    selectedIndex.value = index
    if (hoverIndex.value === -1) {
      hoverIndex.value = index
    }
  },
  { immediate: true }
)

watch(
  () => filteredOptions.value,
  () => {
    hoverIndex.value = -1
    if (!props.multiple) {
      const index = filteredOptions.value.findIndex(
        (o) => o.value === props.modelValue
      )
      selectedIndex.value = index
    }
  }
)

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => {
      if (!props.multiple) {
        const index = filteredOptions.value.findIndex(
          (o) => o.value === props.modelValue
        )
        hoverIndex.value = index !== -1 ? index : filteredOptions.value.findIndex(o => !o.disabled)
      } else {
        hoverIndex.value = filteredOptions.value.findIndex(o => !o.disabled)
      }
      scrollToSelected()
    })
  }
})
</script>

<template>
  <div 
    ref="selectRef"
    class="ms-select" 
    :class="{ 'is-open': isOpen, 'is-disabled': disabled, 'is-scrolling': isScrolling, 'is-focused': isFocused }"
    @keydown="handleKeydown"
    @focus="handleFocus"
    @blur="handleBlur"
    tabindex="0"
  >
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="ms-select-trigger"
      @click="toggleDropdown"
    >
      <div class="ms-select-content">
        <span v-if="!selectedLabel" class="ms-select-placeholder">
          {{ placeholder }}
        </span>
        <span v-else class="ms-select-label">{{ selectedLabel }}</span>
      </div>
      <span class="ms-select-suffix">
        <span
          v-if="clearable && selectedLabel"
          class="ms-select-clear"
          @click="handleClear"
        >
          ×
        </span>
        <span class="ms-select-arrow" :class="{ 'is-open': isOpen }">▼</span>
      </span>
    </div>

    <!-- 下拉菜单 -->
    <Transition name="ms-select-dropdown">
      <div
        v-show="isOpen"
        ref="dropdownRef"
        class="ms-select-dropdown"
        :style="{ maxHeight: maxHeight + 'px' }"
      >
        <!-- 搜索框 -->
        <div v-if="filterable" class="ms-select-search">
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            placeholder="搜索..."
            class="ms-select-input"
            @keydown.stop="handleKeydown"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="isEmpty" class="ms-select-empty">无匹配数据</div>

        <!-- 虚拟列表容器 -->
        <div v-else class="ms-select-list-wrapper">
          <!-- 列表 -->
          <div
            ref="listRef"
            class="ms-select-list"
            :style="{ height: maxHeight - (filterable ? 40 : 0) + 'px' }"
            @scroll.passive="handleScroll"
          >
            <div
              class="ms-select-list-content"
              :style="{ height: totalHeight + 'px' }"
            >
              <div
                v-for="option in visibleOptions"
                :key="option.value"
                class="ms-select-option"
                :class="{
                  'is-selected': isSelected(option.value),
                  'is-hover': hoverIndex === option._index,
                  'is-disabled': option.disabled,
                }"
                :style="{
                  height: itemHeight + 'px',
                  transform: option._transform,
                  willChange: isScrolling ? 'transform' : 'auto',
                }"
                @mouseenter="handleMouseEnter(option._index)"
                @click="handleSelect(option)"
              >
                <slot name="option" :option="option" :selected="isSelected(option.value)">
                  <span class="ms-select-option-label">{{ option.label }}</span>
                  <span v-if="isSelected(option.value)" class="ms-select-option-check">✓</span>
                </slot>
              </div>
            </div>
          </div>

          <!-- 自定义滚动条 -->
          <div
            v-if="showScrollbar"
            ref="scrollbarRef"
            class="ms-select-scrollbar"
            :style="{ height: listHeight + 'px' }"
          >
            <div
              class="ms-select-scrollbar-track"
              @click="(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const clickRatio = (e.clientY - rect.top) / rect.height
                const maxScroll = totalHeight - listHeight
                const newScrollTop = Math.max(0, Math.min(clickRatio * totalHeight, maxScroll))
                if (listRef) {
                  listRef.scrollTop = newScrollTop
                  scrollTop = newScrollTop
                }
              }"
            >
              <div
                class="ms-select-scrollbar-thumb"
                :class="{ 'is-dragging': isDragging }"
                :style="{
                  height: scrollbarConfig.thumbHeight + 'px',
                  top: scrollbarConfig.thumbTop + 'px',
                }"
                @mousedown="handleScrollbarMouseDown"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ms-select {
  position: relative;
  display: inline-block;
  width: 100%;
  font-size: 14px;
  outline: none;
}

.ms-select:focus {
  outline: none;
}

.ms-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.ms-select-trigger:hover {
  border-color: #c0c4cc;
}

.ms-select:focus .ms-select-trigger,
.ms-select.is-open .ms-select-trigger {
  border-color: #409eff;
}

.ms-select.is-disabled .ms-select-trigger {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

.ms-select-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-select-placeholder {
  color: #c0c4cc;
}

.ms-select-label {
  color: #606266;
}

.ms-select-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  color: #c0c4cc;
}

.ms-select-clear {
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px;
  border-radius: 50%;
  transition: all 0.2s;
}

.ms-select-clear:hover {
  color: #f56c6c;
  background-color: #fef0f0;
}

.ms-select-arrow {
  font-size: 10px;
  transition: transform 0.3s;
}

.ms-select-arrow.is-open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.ms-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
}

/* 搜索框 */
.ms-select-search {
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
}

.ms-select-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
  box-sizing: border-box;
}

.ms-select-input:focus {
  border-color: #409eff;
}

/* 空状态 */
.ms-select-empty {
  padding: 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

/* 列表容器 */
.ms-select-list-wrapper {
  display: flex;
  position: relative;
}

/* 列表 */
.ms-select-list {
  flex: 1;
  overflow: auto;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
  /* 启用硬件加速 */
  transform: translateZ(0);
  will-change: scroll-position;
}

.ms-select-list::-webkit-scrollbar {
  display: none;
}

.ms-select-list-content {
  position: relative;
}

/* 选项 - 使用 transform 替代 top */
.ms-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  cursor: pointer;
  box-sizing: border-box;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  /* GPU 加速 */
  transform: translateZ(0);
  backface-visibility: hidden;
  transition: background-color 0.15s;
  contain: layout style paint;
}

.ms-select-option:hover,
.ms-select-option.is-hover {
  background-color: #f5f7fa;
}

.ms-select-option.is-selected {
  color: #409eff;
  font-weight: 500;
  background-color: #ecf5ff;
}

.ms-select-option.is-disabled {
  color: #c0c4cc;
  cursor: not-allowed;
  background-color: transparent;
}

.ms-select-option.is-disabled:hover {
  background-color: transparent;
}

.ms-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-select-option-check {
  font-size: 12px;
  color: #409eff;
}

/* 自定义滚动条 */
.ms-select-scrollbar {
  width: 8px;
  flex-shrink: 0;
  background-color: #f5f7fa;
  border-left: 1px solid #e4e7ed;
  position: relative;
  display: flex;
  flex-direction: column;
}

.ms-select-scrollbar-track {
  position: relative;
  flex: 1;
  width: 100%;
  cursor: pointer;
}

.ms-select-scrollbar-thumb {
  position: absolute;
  left: 1px;
  right: 1px;
  width: 6px;
  min-height: 30px;
  background-color: #c0c4cc;
  border-radius: 3px;
  cursor: grab;
  transition: background-color 0.2s;
}

.ms-select-scrollbar-thumb:hover {
  background-color: #909399;
}

.ms-select-scrollbar-thumb.is-dragging {
  background-color: #409eff;
  cursor: grabbing;
}

/* 过渡动画 */
.ms-select-dropdown-enter-active,
.ms-select-dropdown-leave-active {
  transition: all 0.2s ease;
}

.ms-select-dropdown-enter-from,
.ms-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 焦点样式 */
.ms-select:focus {
  outline: none;
}

.ms-select.is-focused .ms-select-trigger {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.ms-select:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
