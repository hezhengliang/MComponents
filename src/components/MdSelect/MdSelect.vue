<script setup lang="ts" generic="V = unknown">
import {
  ref, computed, watch, nextTick,
  defineOptions, defineExpose,
} from 'vue'
import type {
  SelectOptionOrGroup, SelectOption, FlatItem, FlatGroup,
  MdSelectProps, MdSelectEmits,
} from './types'
import { useVirtualList } from './useVirtualList'
import { usePlacement }   from './usePlacement'

// ─── Component meta ───────────────────────────────────────────────────────────
defineOptions({ name: 'MdSelect', inheritAttrs: false })

// ─── Props & emits ────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<MdSelectProps<V>>(), {
  options:        () => [],
  modelValue:     null,
  placeholder:    '请选择',
  multiple:       false,
  filterable:     false,
  clearable:      false,
  disabled:       false,
  maxTagCount:    2,
  dropdownHeight: 200,
  itemHeight:     34,
  groupHeight:    26,
  size:           'default',
  fitInputWidth:  undefined,
})

const emit = defineEmits<MdSelectEmits<V>>()

// ─── Template refs ────────────────────────────────────────────────────────────
const triggerRef  = ref<HTMLElement>()
const viewportRef = ref<HTMLElement>()
const searchRef   = ref<HTMLInputElement>()
const dropdownRef = ref<HTMLElement>()

// ─── Internal state ───────────────────────────────────────────────────────────
const isOpen    = ref(false)
const isFocused = ref(false)
const query     = ref('')
const kbIdx     = ref(-1)   // index into selectable[]

// ─── Value (internal copy synced with v-model) ────────────────────────────────
const internalValue = ref<V | V[] | null>(
  props.multiple ? (Array.isArray(props.modelValue) ? [...(props.modelValue as V[])] : []) : (props.modelValue ?? null)
) as ReturnType<typeof ref<V | V[] | null>>

watch(() => props.modelValue, (v) => {
  if (props.multiple) {
    internalValue.value = Array.isArray(v) ? [...v] : []
  } else {
    internalValue.value = v ?? null
  }
})

// ─── Selected Set — O(1) lookup ───────────────────────────────────────────────
const selectedSet = computed<Set<V>>(() => {
  const v = internalValue.value
  if (props.multiple) return new Set(Array.isArray(v) ? v as V[] : [])
  return new Set(v != null ? [v as V] : [])
})

// ─── Flatten options ──────────────────────────────────────────────────────────
function isGroup(item: SelectOptionOrGroup<V>): item is { label: string; options: SelectOption<V>[] } {
  return 'options' in item
}

const flatItems = computed<FlatItem<V>[]>(() => {
  const result: FlatItem<V>[] = []
  for (const item of props.options) {
    if (isGroup(item)) {
      result.push({ __group: true, label: item.label } as FlatGroup)
      item.options.forEach(o => result.push(o as FlatItem<V>))
    } else {
      result.push(item as FlatItem<V>)
    }
  }
  return result
})

const flatSelectable = computed<SelectOption<V>[]>(() =>
  flatItems.value.filter((o): o is SelectOption<V> => !o.__group && !o.disabled)
)

// ─── Filter ───────────────────────────────────────────────────────────────────
const filtered = computed<FlatItem<V>[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return flatItems.value

  const out: FlatItem<V>[] = []
  let pendingGroup: FlatGroup | null = null
  for (const o of flatItems.value) {
    if (o.__group) { pendingGroup = o as FlatGroup; continue }
    const opt = o as SelectOption<V>
    if (opt.label.toLowerCase().includes(q)) {
      if (pendingGroup) { out.push(pendingGroup); pendingGroup = null }
      out.push(o)
    }
  }
  return out
})

const selectable = computed<SelectOption<V>[]>(() =>
  filtered.value.filter((o): o is SelectOption<V> => !o.__group && !(o as SelectOption<V>).disabled)
)

const totalCount    = computed(() => flatItems.value.filter(o => !o.__group).length)
const filteredCount = computed(() => selectable.value.length)

// ─── Label helper ─────────────────────────────────────────────────────────────
function labelOf(v: V): string {
  const o = flatSelectable.value.find(o => o.value === v)
  return o ? o.label : String(v)
}

function isSelected(v: V): boolean {
  return selectedSet.value.has(v)
}

// ─── Virtual list ─────────────────────────────────────────────────────────────
const vl = useVirtualList(filtered.value, {
  itemHeight:  props.itemHeight,
  groupHeight: props.groupHeight,
})

// Sync filtered → VirtualList
watch(filtered, (items) => {
  vl.setItems(items)
}, { flush: 'sync' })

// Refresh when selection changes
watch(selectedSet, () => {
  if (isOpen.value) vl.refresh()
})

// Refresh when kbIdx changes
watch(kbIdx, () => {
  if (isOpen.value) vl.refresh()
})

// Items slice for rendering
const visibleItems = computed(() =>
  filtered.value.slice(vl.range.value?.start ?? 0, vl.range.value?.end ?? 0)
)

// ─── Placement ────────────────────────────────────────────────────────────────
const { placement, start: startPlacement, stop: stopPlacement, recompute } = usePlacement()

const dropdownStyle = computed(() => {
  const p = placement.value
  if (!p) return {}
  const style: Record<string, string> = {
    position: 'fixed',
    left:  p.left  + 'px',
    width: p.width + 'px',
    zIndex: '9999',
  }
  if (p.top !== null) style.top = p.top + 'px'
  else style.bottom = p.bottom + 'px'
  return style
})

const viewportStyle = computed(() => ({
  maxHeight: placement.value ? placement.value.maxHeight + 'px' : props.dropdownHeight + 'px',
}))

// ─── Trigger display ──────────────────────────────────────────────────────────
const hasValue = computed(() => {
  if (props.multiple) return Array.isArray(internalValue.value) && (internalValue.value as V[]).length > 0
  const v = internalValue.value
  return v !== null && v !== undefined && v !== ''
})

const displayTags = computed<V[]>(() => {
  if (!props.multiple || !Array.isArray(internalValue.value)) return []
  return (internalValue.value as V[]).slice(0, props.maxTagCount)
})

const overflowCount = computed(() => {
  if (!props.multiple || !Array.isArray(internalValue.value)) return 0
  return Math.max(0, (internalValue.value as V[]).length - props.maxTagCount)
})

const showClear = computed(() =>
  props.clearable && hasValue.value
)

// ─── Open / close ─────────────────────────────────────────────────────────────
async function open() {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
  kbIdx.value  = -1
  emit('open')

  // Phase 1 — show dropdown shell immediately with initial placement
  await nextTick()
  if (triggerRef.value) startPlacement(triggerRef.value, props.dropdownHeight, props.fitInputWidth)

  if (props.filterable && searchRef.value) {
    setTimeout(() => searchRef.value?.focus(), 16)
  }

  // Mount VL viewport
  if (viewportRef.value) vl.mount(viewportRef.value)

  // Phase 2 — after VL is mounted the viewport has a real clientHeight;
  // recompute placement so maxHeight / top / bottom are accurate.
  await nextTick()
  recompute()
  initKb()
  requestAnimationFrame(() => {
    if (isOpen.value) scrollToSelected()
  })

  // Outside-click close
  setTimeout(() => {
    document.addEventListener('click', onOutsideClick)
  }, 0)
}

// When the trigger height changes (e.g. multi-select tags wrap to a new row)
// while the dropdown is open, re-run placement so the dropdown anchors correctly.
watch(internalValue, () => {
  if (!isOpen.value) return
  // Wait one tick for the DOM to reflect new tag layout before reading the rect.
  nextTick(() => recompute())
})

function close() {
  if (!isOpen.value) return
  isOpen.value = false
  kbIdx.value  = -1
  query.value  = ''
  stopPlacement()
  vl.unmount()
  document.removeEventListener('click', onOutsideClick)
  emit('close')
}

function toggle() {
  isOpen.value ? close() : open()
}

function onOutsideClick(e: MouseEvent) {
  const target = e.target as Node
  if (triggerRef.value?.contains(target)) return
  if (dropdownRef.value?.contains(target)) return
  close()
}

// ─── Selection ────────────────────────────────────────────────────────────────
function selectValue(val: V) {
  const opt = flatSelectable.value.find(o => String(o.value) === String(val))
  if (!opt || opt.disabled) return

  let next: V | V[] | null
  if (props.multiple) {
    const cur = Array.isArray(internalValue.value) ? internalValue.value as V[] : []
    const idx = cur.indexOf(opt.value)
    next = idx === -1 ? [...cur, opt.value] : cur.filter((_, i) => i !== idx)
  } else {
    next = opt.value
    close()
  }

  internalValue.value = next
  emit('update:modelValue', next)
  emit('change', next)
}

function removeTag(val: V) {
  if (!props.multiple || !Array.isArray(internalValue.value)) return
  const next = (internalValue.value as V[]).filter(v => v !== val)
  internalValue.value = next
  emit('update:modelValue', next)
  emit('change', next)
}

function clearAll() {
  const next = props.multiple ? [] as V[] : null
  internalValue.value = next
  emit('update:modelValue', next)
  emit('change', next)
  if (isOpen.value) vl.refresh()
}

function selectAll() {
  const all = flatSelectable.value.map(o => o.value)
  internalValue.value = all
  emit('update:modelValue', all)
  emit('change', all)
}

function selectNone() {
  internalValue.value = []
  emit('update:modelValue', [])
  emit('change', [])
}

function invertSelection() {
  const all = flatSelectable.value.map(o => o.value)
  const cur = Array.isArray(internalValue.value) ? internalValue.value as V[] : []
  const next = all.filter(v => !cur.includes(v))
  internalValue.value = next
  emit('update:modelValue', next)
  emit('change', next)
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function initKb() {
  if (!selectable.value.length) { kbIdx.value = -1; return }
  const fi = selectable.value.findIndex(o => isSelected(o.value))
  kbIdx.value = fi >= 0 ? fi : -1
}

function scrollToSelected() {
  const fi = filtered.value.findIndex(o => !o.__group && isSelected((o as SelectOption<V>).value))
  if (fi >= 0) vl.scrollToIndex(fi)
}

function scrollKbIntoView() {
  if (kbIdx.value < 0) return
  const item = selectable.value[kbIdx.value]
  const fi   = filtered.value.indexOf(item as FlatItem<V>)
  if (fi >= 0) vl.scrollToIndex(fi)
}

function moveKb(dir: 1 | -1) {
  if (!selectable.value.length) return
  if (kbIdx.value === -1) kbIdx.value = dir > 0 ? 0 : selectable.value.length - 1
  else kbIdx.value = (kbIdx.value + dir + selectable.value.length) % selectable.value.length
  scrollKbIntoView()
}

function confirmKb() {
  if (kbIdx.value >= 0 && kbIdx.value < selectable.value.length)
    selectValue(selectable.value[kbIdx.value].value)
}

function moveDirect(dir: 1 | -1) {
  if (props.multiple) { open(); return }
  const sel = flatSelectable.value
  if (!sel.length) return
  const cur  = sel.findIndex(o => o.value === internalValue.value)
  const next = cur === -1
    ? (dir > 0 ? 0 : sel.length - 1)
    : (cur + dir + sel.length) % sel.length
  internalValue.value = sel[next].value
  emit('update:modelValue', internalValue.value)
  emit('change', internalValue.value)
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      isOpen.value ? moveKb(1) : moveDirect(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      isOpen.value ? moveKb(-1) : moveDirect(-1)
      break
    case 'Enter':
      e.preventDefault()
      if (!isOpen.value) open()
      else if (kbIdx.value >= 0) confirmKb()
      else close()
      break
    case ' ':
      if (!isOpen.value && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); open()
      }
      break
    case 'Escape':
      if (isOpen.value) { e.preventDefault(); close(); triggerRef.value?.focus() }
      break
    case 'Tab':
      if (isOpen.value) close()
      break
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  onTriggerKeydown(e)
}

function onSearchInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
  kbIdx.value = -1
  emit('search', query.value)
  // Filtered list height may change — re-anchor the dropdown next tick
  nextTick(() => { if (isOpen.value) recompute() })
}

// ─── Row helpers (for template) ───────────────────────────────────────────────
function isKbActive(item: SelectOption<V>): boolean {
  return kbIdx.value >= 0 && selectable.value[kbIdx.value] === item
}

// ─── Expose public API ────────────────────────────────────────────────────────
defineExpose({
  open,
  close,
  toggle,
  focus: () => triggerRef.value?.focus(),
  getValue: () => internalValue.value,
  setValue: (v: V | V[] | null) => {
    internalValue.value = props.multiple ? (Array.isArray(v) ? [...v] : []) : (v ?? null)
    emit('update:modelValue', internalValue.value)
  },
})
</script>

<template>
  <div
    class="ms-root"
    :class="[
      `ms-root--${size}`,
      { 'ms-root--open': isOpen, 'ms-root--focused': isFocused, 'ms-root--disabled': disabled },
    ]"
    v-bind="$attrs"
  >
    <!-- ── Trigger ── -->
    <div
      ref="triggerRef"
      class="ms-trigger"
      role="combobox"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :tabindex="disabled ? -1 : 0"
      @click="!disabled && toggle()"
      @keydown="onTriggerKeydown"
      @focus="isFocused = true"
      @blur="isFocused = false"
    >
      <!-- Multiple: tags -->
      <template v-if="multiple">
        <span v-if="!hasValue" class="ms-placeholder">{{ placeholder }}</span>
        <template v-else>
          <span
            v-for="val in displayTags"
            :key="String(val)"
            class="ms-tag"
            :title="labelOf(val)"
          >
            <span class="ms-tag__label">{{ labelOf(val) }}</span>
            <span
              class="ms-tag__close"
              @click.stop="removeTag(val)"
            >
              <!-- X icon -->
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </span>
          </span>
          <span v-if="overflowCount > 0" class="ms-overflow">+{{ overflowCount }}</span>
        </template>
      </template>

      <!-- Single -->
      <template v-else>
        <span v-if="!hasValue" class="ms-placeholder">{{ placeholder }}</span>
        <span v-else class="ms-value">{{ labelOf(internalValue as V) }}</span>
      </template>

      <!-- Clear button -->
      <span
        v-if="showClear"
        class="ms-clear"
        :class="{ 'ms-clear--visible': showClear }"
        @click.stop="clearAll"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>

      <!-- Chevron -->
      <span class="ms-chevron">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </div>

    <!-- ── Dropdown (teleported to body) ── -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="ms-dropdown"
        :class="placement?.cls"
        :style="dropdownStyle"
        role="listbox"
        :aria-multiselectable="multiple"
      >
        <!-- placement pill -->
        <div class="ms-pill">
          <span class="ms-pill__dot"></span>
          <span>{{ placement?.vert === 'top' ? '↑ ' : '↓ ' }}{{ placement?.vert }}-{{ placement?.horiz }}</span>
        </div>

        <!-- stats -->
        <div class="ms-stats">
          <span>{{ query ? `${filteredCount} / ${totalCount}` : `${totalCount} items` }}</span>
          <span v-if="totalCount > 50" class="ms-stats__badge">virtual</span>
        </div>

        <!-- search -->
        <div v-if="filterable" class="ms-search">
          <div class="ms-search__wrap">
            <span class="ms-search__icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              ref="searchRef"
              class="ms-search__input"
              placeholder="Search…"
              autocomplete="off"
              spellcheck="false"
              :value="query"
              @input="onSearchInput"
              @keydown="onSearchKeydown"
            />
          </div>
        </div>

        <!-- virtual viewport -->
        <div
          ref="viewportRef"
          class="ms-viewport"
          :style="viewportStyle"
        >
          <!-- spacer for total scroll height -->
          <div class="ms-spacer" :style="{ height: vl.totalHeight.value + 'px' }">
            <!-- rendered window, positioned at windowTop -->
            <div class="ms-window" :style="{ top: vl.windowTop.value + 'px' }">
              <template v-for="(item, localIdx) in visibleItems" :key="(vl.range.value?.start ?? 0) + localIdx">
                <!-- Group header -->
                <div
                  v-if="item.__group"
                  class="ms-group"
                  :style="{ height: groupHeight + 'px' }"
                >
                  {{ item.label }}
                </div>

                <!-- Option -->
                <div
                  v-else
                  class="ms-option"
                  :class="{
                    'ms-option--selected': isSelected((item as SelectOption<V>).value),
                    'ms-option--kb':       isKbActive(item as SelectOption<V>),
                    'ms-option--disabled': (item as SelectOption<V>).disabled,
                  }"
                  :style="{ height: itemHeight + 'px' }"
                  role="option"
                  :aria-selected="isSelected((item as SelectOption<V>).value)"
                  @click="selectValue((item as SelectOption<V>).value)"
                >
                  <!-- Checkbox (multiple) -->
                  <span v-if="multiple" class="ms-checkbox">
                    <svg
                      v-if="isSelected((item as SelectOption<V>).value)"
                      width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>

                  <!-- Color dot -->
                  <span
                    v-if="(item as SelectOption<V>).color"
                    class="ms-color-dot"
                    :style="{ background: (item as SelectOption<V>).color }"
                  />

                  <!-- Custom render or default label -->
                  <span
                    v-if="renderOption"
                    class="ms-option__label"
                    v-html="renderOption(item as SelectOption<V>)"
                  />
                  <template v-else>
                    <span class="ms-option__label">{{ (item as SelectOption<V>).label }}</span>
                    <span v-if="(item as SelectOption<V>).extra" class="ms-option__extra">
                      {{ (item as SelectOption<V>).extra }}
                    </span>
                  </template>

                  <!-- Check icon (single) -->
                  <span v-if="!multiple" class="ms-check">
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                </div>
              </template>

              <!-- Empty state -->
              <div v-if="filtered.length === 0" class="ms-empty">
                {{ query ? 'No results found' : 'No options' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer (multiple) -->
        <div v-if="multiple" class="ms-footer">
          <button class="ms-footer__btn" @click="selectAll">全选</button>
          <button class="ms-footer__btn" @click="selectNone">清空</button>
          <button class="ms-footer__btn" @click="invertSelection">反选</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ─── shadcn/ui design tokens (local) ─────────────────────────────────────── */
.ms-root {
  --ms-bg:          #ffffff;
  --ms-fg:          #09090b;
  --ms-muted:       #f4f4f5;
  --ms-muted-fg:    #71717a;
  --ms-border:      #e4e4e7;
  --ms-input:       #e4e4e7;
  --ms-ring:        #18181b;
  --ms-primary:     #18181b;
  --ms-primary-fg:  #fafafa;
  --ms-secondary:   #f4f4f5;
  --ms-secondary-fg:#18181b;
  --ms-accent:      #f4f4f5;
  --ms-accent-fg:   #18181b;
  --ms-radius:      0.375rem;
  --ms-tr:          0.15s cubic-bezier(.4,0,.2,1);

  position: relative;
  width: 100%;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  outline: none;
}

/* ── Trigger ────────────────────────────────────────────────────────────────── */
.ms-trigger {
  position: relative;
  display: flex; align-items: center;
  width: 100%; min-height: 36px;
  padding: 4px 32px 4px 12px;
  background: var(--ms-bg);
  border: 1px solid var(--ms-input);
  border-radius: var(--ms-radius);
  cursor: pointer; user-select: none;
  font-size: 14px;
  transition: border-color var(--ms-tr), box-shadow var(--ms-tr);
  gap: 6px; flex-wrap: wrap; row-gap: 4px;
  outline: none;
}
.ms-root:not(.ms-root--disabled) .ms-trigger:hover { border-color: #a1a1aa; }
.ms-root--open .ms-trigger,
.ms-root--focused .ms-trigger {
  border-color: var(--ms-ring);
  box-shadow: 0 0 0 2px rgba(24,24,27,.12);
}
.ms-root--disabled .ms-trigger { opacity: .5; cursor: not-allowed; }
.ms-root--sm .ms-trigger { min-height: 30px; padding: 3px 28px 3px 10px; font-size: 12px; }
.ms-root--lg .ms-trigger { min-height: 42px; padding: 4px 32px 4px 14px; font-size: 15px; }

/* placeholder / value */
.ms-placeholder { color: var(--ms-muted-fg); pointer-events: none; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-value       { color: var(--ms-fg);       pointer-events: none; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* tags */
.ms-tag {
  display: inline-flex; align-items: center; gap: 3px;
  background: var(--ms-secondary); color: var(--ms-secondary-fg);
  border: 1px solid var(--ms-border); border-radius: calc(var(--ms-radius) - 2px);
  font-size: 12px; font-weight: 500; padding: 1px 4px 1px 7px;
  max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ms-tag__label { overflow: hidden; text-overflow: ellipsis; flex: 1; }
.ms-tag__close {
  display: flex; align-items: center; justify-content: center;
  width: 13px; height: 13px; border-radius: 2px; flex-shrink: 0;
  color: var(--ms-muted-fg); cursor: pointer;
  transition: color var(--ms-tr), background var(--ms-tr);
}
.ms-tag__close:hover { color: var(--ms-fg); background: var(--ms-accent); }
.ms-overflow { font-size: 12px; color: var(--ms-muted-fg); flex-shrink: 0; white-space: nowrap; }

/* clear */
.ms-clear {
  position: absolute; right: 28px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity var(--ms-tr); cursor: pointer; color: var(--ms-muted-fg);
}
.ms-clear:hover { color: var(--ms-fg); }
.ms-root:hover .ms-clear--visible,
.ms-root--focused .ms-clear--visible { opacity: 1; }

/* chevron */
.ms-chevron {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  color: var(--ms-muted-fg); transition: transform var(--ms-tr); pointer-events: none;
}
.ms-root--open .ms-chevron { transform: translateY(-50%) rotate(180deg); }
</style>

<!-- Dropdown styles are global (teleported outside component scope) -->
<style>
.ms-dropdown {
  position: fixed; z-index: 9999; overflow: hidden;
  display: flex; flex-direction: column;
  min-width: 120px; max-width: calc(100vw - 16px);
  background: #ffffff; border: 1px solid #e4e4e7; border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.04);
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  font-size: 14px; -webkit-font-smoothing: antialiased;
}

/* placement animations */
.ms-dd--bottom-left, .ms-dd--bottom-right {
  transform-origin: top center;
  animation: ms-slide-down .12s cubic-bezier(.22,1,.36,1) both;
}
.ms-dd--top-left, .ms-dd--top-right {
  transform-origin: bottom center;
  animation: ms-slide-up .12s cubic-bezier(.22,1,.36,1) both;
}
@keyframes ms-slide-down { from { opacity:0; transform: scaleY(.95) translateY(-4px); } to { opacity:1; transform:none; } }
@keyframes ms-slide-up   { from { opacity:0; transform: scaleY(.95) translateY(4px);  } to { opacity:1; transform:none; } }

/* pill */
.ms-pill { display:flex; align-items:center; gap:4px; padding:5px 10px 2px; font-size:10px; font-family:ui-monospace,monospace; color:#71717a; flex-shrink:0; }
.ms-pill__dot { width:5px; height:5px; border-radius:50%; background:#22c55e; }
.ms-dd--top-left .ms-pill__dot, .ms-dd--top-right .ms-pill__dot { background:#f97316; }

/* stats */
.ms-stats { padding:3px 10px 2px; display:flex; justify-content:space-between; font-size:10px; font-family:ui-monospace,monospace; color:#71717a; flex-shrink:0; }
.ms-stats__badge { background:#f4f4f5; color:#18181b; border:1px solid #e4e4e7; border-radius:4px; padding:0 6px; font-size:9px; }

/* search */
.ms-search { padding:4px 6px; flex-shrink:0; border-bottom:1px solid #e4e4e7; }
.ms-search__wrap { position:relative; display:flex; align-items:center; }
.ms-search__input { width:100%; background:transparent; border:none; padding:6px 8px 6px 28px; font-family:inherit; font-size:13px; color:#09090b; outline:none; }
.ms-search__input::placeholder { color:#71717a; }
.ms-search__icon { position:absolute; left:6px; color:#71717a; pointer-events:none; display:flex; }

/* viewport */
.ms-viewport { position:relative; overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; scrollbar-color:#e4e4e7 transparent; }
.ms-viewport::-webkit-scrollbar { width:4px; }
.ms-viewport::-webkit-scrollbar-thumb { background:#e4e4e7; border-radius:2px; }

/* virtual layout */
.ms-spacer { position:relative; width:100%; }
.ms-window { position:absolute; left:0; right:0; top:0; padding:2px 4px; }

/* group */
.ms-group { display:flex; align-items:center; padding:0 8px; font-size:11px; font-weight:600; color:#71717a; letter-spacing:.02em; box-sizing:border-box; }

/* option */
.ms-option {
  display:flex; align-items:center; gap:8px; padding:0 8px;
  border-radius:0.375rem; font-size:13px; color:#09090b;
  cursor:pointer; overflow:hidden; box-sizing:border-box;
  transition:background .12s;
}
.ms-option:hover { background:#f4f4f5; }
.ms-option--kb { background:#f4f4f5; }
.ms-option--selected { background:#f4f4f5; font-weight:500; }
.ms-option--selected.ms-option--kb { background:#e4e4e7; }
.ms-option--disabled { opacity:.4; cursor:not-allowed; pointer-events:none; }

/* option inner */
.ms-option__label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.ms-option__extra { font-size:11px; color:#71717a; font-family:ui-monospace,monospace; flex-shrink:0; margin-left:auto; padding-left:8px; }
.ms-color-dot    { width:8px; height:8px; border-radius:50%; flex-shrink:0; display:inline-block; }

/* check icon */
.ms-check { display:flex; align-items:center; justify-content:center; width:14px; height:14px; flex-shrink:0; margin-left:auto; color:#18181b; opacity:0; transform:scale(.6); transition:opacity .1s, transform .1s; }
.ms-option--selected .ms-check { opacity:1; transform:scale(1); }

/* checkbox */
.ms-checkbox { width:14px; height:14px; border-radius:3px; border:1px solid #e4e4e7; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#fff; transition:background .12s, border-color .12s; }
.ms-option--selected .ms-checkbox { background:#18181b; border-color:#18181b; }

/* empty */
.ms-empty { padding:20px; text-align:center; font-size:13px; color:#71717a; }

/* footer */
.ms-footer { padding:4px 6px 6px; border-top:1px solid #e4e4e7; display:flex; gap:4px; flex-shrink:0; }
.ms-footer__btn { font-family:inherit; font-size:12px; color:#71717a; background:none; border:none; cursor:pointer; padding:2px 8px; border-radius:0.375rem; transition:color .12s, background .12s; }
.ms-footer__btn:hover { color:#09090b; background:#f4f4f5; }
</style>
