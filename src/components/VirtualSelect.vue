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

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  modelValue: string | number | (string | number)[]
  options: SelectOption[]
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  filterable?: boolean
  itemHeight?: number
  dropdownHeight?: number
  buffer?: number
  placement?: Placement
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  placeholder: '请选择',
  disabled: false,
  clearable: false,
  filterable: false,
  itemHeight: 34,
  dropdownHeight: 200,
  buffer: 5,
  placement: 'bottom',
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
const selectRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()

// 滚动位置
const scrollTop = shallowRef(0)
const isScrolling = shallowRef(false)
const scrollTimeout = ref<number | null>(null)
const isFocused = ref(false)

// 下拉框位置
const dropdownStyle = ref({
  top: '0px',
  left: '0px',
  width: '0px',
})

// ============ 计算属性 ============

// 过滤后的选项
const filteredOptions = computed(() => {
  if (!props.filterable || !searchQuery.value) {
    return props.options
  }
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(query) ||
      String(opt.value).toLowerCase().includes(query)
  )
})

const isEmpty = computed(() => filteredOptions.value.length === 0)

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

const isSelected = (value: string | number) => {
  if (props.multiple) {
    return (props.modelValue as (string | number)[]).includes(value)
  }
  return props.modelValue === value
}

// 虚拟滚动计算
const totalHeight = computed(
  () => filteredOptions.value.length * props.itemHeight
)

const visibleCount = computed(
  () => Math.ceil(props.dropdownHeight / props.itemHeight)
)

const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
)

const endIndex = computed(() =>
  Math.min(
    filteredOptions.value.length,
    startIndex.value + visibleCount.value + props.buffer * 2
  )
)

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

// 滚动条计算
const listHeight = computed(() => props.dropdownHeight - (props.filterable ? 40 : 0))

const scrollbarConfig = computed(() => {
  if (totalHeight.value <= listHeight.value) {
    return { show: false, thumbHeight: 0, thumbTop: 0 }
  }
  
  const ratio = listHeight.value / totalHeight.value
  const thumbHeight = Math.max(ratio * listHeight.value, 30)
  const trackHeight = listHeight.value - thumbHeight
  const maxScroll = totalHeight.value - listHeight.value
  const scrollProgress = Math.min(scrollTop.value / maxScroll, 1)
  const thumbTop = scrollProgress * trackHeight
  
  return { show: true, thumbHeight, thumbTop }
})

const showScrollbar = computed(() => scrollbarConfig.value.show)

// ============ 方法 ============

const focus = () => {
  selectRef.value?.focus()
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

// 计算下拉框位置，防止越界
const updateDropdownPosition = () => {
  if (!triggerRef.value || !dropdownRef.value) return
  
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const dropdownRect = dropdownRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let top = 0
  let left = triggerRect.left
  let width = triggerRect.width
  
  const spaceAbove = triggerRect.top
  const spaceBelow = viewportHeight - triggerRect.bottom
  const dropdownHeight = props.dropdownHeight
  
  // 决定垂直位置
  let finalPlacement = props.placement
  
  if (props.placement === 'bottom') {
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      finalPlacement = 'top'
    }
  } else if (props.placement === 'top') {
    if (spaceAbove < dropdownHeight && spaceBelow > spaceAbove) {
      finalPlacement = 'bottom'
    }
  }
  
  // 计算位置
  if (finalPlacement === 'bottom') {
    top = triggerRect.bottom + 4
  } else if (finalPlacement === 'top') {
    top = triggerRect.top - dropdownHeight - 4
  } else if (finalPlacement === 'left') {
    top = triggerRect.top
    left = triggerRect.left - dropdownRect.width - 4
  } else if (finalPlacement === 'right') {
    top = triggerRect.top
    left = triggerRect.right + 4
  }
  
  // 水平越界检查
  if (left + width > viewportWidth - 8) {
    left = viewportWidth - width - 8
  }
  if (left < 8) {
    left = 8
  }
  
  // 垂直越界检查
  if (top + dropdownHeight > viewportHeight - 8) {
    top = viewportHeight - dropdownHeight - 8
  }
  if (top < 8) {
    top = 8
  }
  
  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
}

const toggleDropdown = () => {
  if (props.disabled) return
  focus()
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      updateDropdownPosition()
      inputRef.value?.focus()
      scrollToSelected()
    })
  }
}

const closeDropdown = () => {
  isOpen.value = false
  searchQuery.value = ''
  hoverIndex.value = -1
}

const handleSelect = (option: SelectOption) => {
  if (!option || option.disabled) return

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

const handleScroll = () => {
  const newScrollTop = listRef.value?.scrollTop || 0
  scrollTop.value = newScrollTop
  
  isScrolling.value = true
  
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  
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
    const minScroll = offset - listHeight.value + props.itemHeight
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

// 关闭状态下选择下一个选项
const selectNextOption = () => {
  const options = props.options
  if (!options.length) return
  const currentIndex = options.findIndex(o => o.value === props.modelValue)
  let newIndex = currentIndex + 1
  
  while (newIndex < options.length && options[newIndex]?.disabled) {
    newIndex++
  }
  
  if (newIndex < options.length) {
    const option = options[newIndex]
    emit('update:modelValue', option.value)
    emit('change', option.value)
  } else {
    const firstEnabled = options.findIndex(o => !o.disabled)
    if (firstEnabled !== -1 && firstEnabled !== currentIndex) {
      const option = options[firstEnabled]
      emit('update:modelValue', option.value)
      emit('change', option.value)
    }
  }
}

const selectPrevOption = () => {
  const options = props.options
  if (!options.length) return
  const currentIndex = options.findIndex(o => o.value === props.modelValue)
  let newIndex = currentIndex - 1
  
  while (newIndex >= 0 && options[newIndex]?.disabled) {
    newIndex--
  }
  
  if (newIndex >= 0) {
    const option = options[newIndex]
    emit('update:modelValue', option.value)
    emit('change', option.value)
  } else {
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

// 键盘导航
const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) {
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

// 打开状态下导航
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
  const pageSize = Math.floor(props.dropdownHeight / props.itemHeight)
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
  const pageSize = Math.floor(props.dropdownHeight / props.itemHeight)
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
  const minScroll = offset - listHeight.value + props.itemHeight
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

// 窗口变化时更新位置
const handleResize = () => {
  if (isOpen.value) {
    updateDropdownPosition()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, { passive: true })
  window.addEventListener('resize', handleResize, { passive: true })
  window.addEventListener('scroll', handleResize, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleResize)
  document.removeEventListener('mousemove', handleScrollbarMouseMove)
  document.removeEventListener('mouseup', handleScrollbarMouseUp)
  if (scrollTimeout.value) clearTimeout(scrollTimeout.value)
})

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
    class="virtual-select" 
    :class="{ 
      'is-open': isOpen, 
      'is-disabled': disabled, 
      'is-scrolling': isScrolling, 
      'is-focused': isFocused 
    }"
    @keydown="handleKeydown"
    @focus="handleFocus"
    @blur="handleBlur"
    tabindex="0"
  >
    <!-- 触发器 -->
    <div
      ref="triggerRef"
      class="virtual-select-trigger"
      @click="toggleDropdown"
    >
      <div class="virtual-select-content">
        <span v-if="!selectedLabel" class="virtual-select-placeholder">
          {{ placeholder }}
        </span>
        <span v-else class="virtual-select-label">{{ selectedLabel }}</span>
      </div>
      <span class="virtual-select-suffix">
        <span
          v-if="clearable && selectedLabel"
          class="virtual-select-clear"
          @click="handleClear"
        >
          ×
        </span>
        <span class="virtual-select-arrow" :class="{ 'is-open': isOpen }">▼</span>
      </span>
    </div>

    <!-- 下拉菜单 (Teleport to body) -->
    <Teleport to="body">
      <Transition name="virtual-select-dropdown">
        <div
          v-show="isOpen"
          ref="dropdownRef"
          class="virtual-select-dropdown"
          :style="[dropdownStyle, { maxHeight: dropdownHeight + 'px' }]"
        >
          <!-- 搜索框 -->
          <div v-if="filterable" class="virtual-select-search">
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              placeholder="搜索..."
              class="virtual-select-input"
              @keydown="(e: KeyboardEvent) => {
                e.stopPropagation()
                // 搜索框特定处理
                if (e.key === 'Escape') {
                  e.preventDefault()
                  closeDropdown()
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') {
                  // 导航键交给列表处理
                  handleKeydown(e)
                } else if (e.key === 'Tab') {
                  closeDropdown()
                }
              }"
            />
          </div>

          <!-- 空状态 -->
          <div v-if="isEmpty" class="virtual-select-empty">无匹配数据</div>

          <!-- 虚拟列表容器 -->
          <div v-else class="virtual-select-list-wrapper">
            <!-- 列表 -->
            <div
              ref="listRef"
              class="virtual-select-list"
              :style="{ height: listHeight + 'px' }"
              @scroll.passive="handleScroll"
            >
              <div
                class="virtual-select-list-content"
                :style="{ height: totalHeight + 'px' }"
              >
                <div
                  v-for="option in visibleOptions"
                  :key="option.value"
                  class="virtual-select-option"
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
                  @click.stop="handleSelect(option)"
                >
                  <slot name="option" :option="option" :selected="isSelected(option.value)">
                    <span class="virtual-select-option-label">{{ option.label }}</span>
                    <span v-if="isSelected(option.value)" class="virtual-select-option-check">✓</span>
                  </slot>
                </div>
              </div>
            </div>

            <!-- 自定义滚动条 -->
            <div
              v-if="showScrollbar"
              class="virtual-select-scrollbar"
              :style="{ height: listHeight + 'px' }"
            >
              <div
                class="virtual-select-scrollbar-track"
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
                  class="virtual-select-scrollbar-thumb"
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
    </Teleport>
  </div>
</template>

<style scoped>
.virtual-select {
  position: relative;
  display: inline-block;
  width: 100%;
  font-size: 14px;
  outline: none;
}

.virtual-select:focus {
  outline: none;
}

.virtual-select-trigger {
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

.virtual-select-trigger:hover {
  border-color: #c0c4cc;
}

.virtual-select.is-focused .virtual-select-trigger,
.virtual-select.is-open .virtual-select-trigger {
  border-color: #409eff;
}

.virtual-select.is-focused .virtual-select-trigger {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.virtual-select.is-disabled .virtual-select-trigger {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

.virtual-select-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.virtual-select-placeholder {
  color: #c0c4cc;
}

.virtual-select-label {
  color: #606266;
}

.virtual-select-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  color: #c0c4cc;
}

.virtual-select-clear {
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px;
  border-radius: 50%;
  transition: all 0.2s;
}

.virtual-select-clear:hover {
  color: #f56c6c;
  background-color: #fef0f0;
}

.virtual-select-arrow {
  font-size: 10px;
  transition: transform 0.3s;
}

.virtual-select-arrow.is-open {
  transform: rotate(180deg);
}

/* 下拉菜单 - fixed 定位 */
.virtual-select-dropdown {
  position: fixed;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  overflow: hidden;
}

/* 搜索框 */
.virtual-select-search {
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
}

.virtual-select-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
  box-sizing: border-box;
}

.virtual-select-input:focus {
  border-color: #409eff;
}

/* 空状态 */
.virtual-select-empty {
  padding: 20px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

/* 列表容器 */
.virtual-select-list-wrapper {
  display: flex;
  position: relative;
}

/* 列表 */
.virtual-select-list {
  flex: 1;
  overflow: auto;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
  transform: translateZ(0);
  will-change: scroll-position;
}

.virtual-select-list::-webkit-scrollbar {
  display: none;
}

.virtual-select-list-content {
  position: relative;
}

/* 选项 */
.virtual-select-option {
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
  transform: translateZ(0);
  backface-visibility: hidden;
  transition: background-color 0.15s;
}

.virtual-select-option:hover,
.virtual-select-option.is-hover {
  background-color: #f5f7fa;
}

.virtual-select-option.is-selected {
  color: #409eff;
  font-weight: 500;
  background-color: #ecf5ff;
}

.virtual-select-option.is-disabled {
  color: #c0c4cc;
  cursor: not-allowed;
  background-color: transparent;
}

.virtual-select-option.is-disabled:hover {
  background-color: transparent;
}

.virtual-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.virtual-select-option-check {
  font-size: 12px;
  color: #409eff;
}

/* 自定义滚动条 */
.virtual-select-scrollbar {
  width: 8px;
  flex-shrink: 0;
  background-color: #f5f7fa;
  border-left: 1px solid #e4e7ed;
  position: relative;
  display: flex;
  flex-direction: column;
}

.virtual-select-scrollbar-track {
  position: relative;
  flex: 1;
  width: 100%;
  cursor: pointer;
}

.virtual-select-scrollbar-thumb {
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

.virtual-select-scrollbar-thumb:hover {
  background-color: #909399;
}

.virtual-select-scrollbar-thumb.is-dragging {
  background-color: #409eff;
  cursor: grabbing;
}

/* 过渡动画 */
.virtual-select-dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.virtual-select-dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.virtual-select-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.virtual-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
