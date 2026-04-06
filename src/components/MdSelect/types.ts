// ─── Option types ────────────────────────────────────────────────────────────

export interface SelectOption<V = unknown> {
  value: V
  label: string
  disabled?: boolean
  color?: string
  extra?: string
}

export interface SelectGroup<V = unknown> {
  label: string
  options: SelectOption<V>[]
}

export type SelectOptionOrGroup<V = unknown> = SelectOption<V> | SelectGroup<V>

/** Flat internal item (includes sentinel group headers) */
export interface FlatOption<V = unknown> extends SelectOption<V> {
  __group?: false
}

export interface FlatGroup {
  __group: true
  label: string
}

export type FlatItem<V = unknown> = FlatOption<V> | FlatGroup

// ─── Props ───────────────────────────────────────────────────────────────────

export type SelectSize = 'sm' | 'default' | 'lg'

export interface MdSelectProps<V = unknown> {
  /** Options array — supports flat items or grouped { label, options[] } */
  options?: SelectOptionOrGroup<V>[]
  /** v-model value */
  modelValue?: V | V[] | null
  placeholder?: string
  multiple?: boolean
  /** Show search/filter input inside dropdown */
  filterable?: boolean
  /** Show ✕ clear button */
  clearable?: boolean
  disabled?: boolean
  /** Max tags shown before "+N" overflow badge */
  maxTagCount?: number
  /** Preferred dropdown max-height in px (may be reduced by viewport bounds) */
  dropdownHeight?: number
  /** Virtual-scroll row height in px */
  itemHeight?: number
  /** Virtual-scroll group header height in px */
  groupHeight?: number
  size?: SelectSize
  /**
   * Fix the dropdown width to an explicit pixel value.
   *
   * By default the dropdown width matches the trigger width (derived from the
   * longest `label` string). When a default-slot custom renderer is used the
   * rendered content may be wider or narrower than the raw `label`, so the
   * auto-calculated width will be wrong. Pass `fit-input-width` as a positive
   * number (px) to pin the dropdown to that exact width regardless of the
   * trigger size.
   *
   * @example
   * // Fixed 320 px wide dropdown
   * <MdSelect :fit-input-width="320" … />
   */
  fitInputWidth?: number
  /** Custom render function for each option — receives SelectOption, returns HTML string */
  renderOption?: (option: SelectOption<V>) => string
}

// ─── Emits ───────────────────────────────────────────────────────────────────

export interface MdSelectEmits<V = unknown> {
  (e: 'update:modelValue', value: V | V[] | null): void
  (e: 'change', value: V | V[] | null): void
  (e: 'open'): void
  (e: 'close'): void
  (e: 'search', query: string): void
}

// ─── Placement ───────────────────────────────────────────────────────────────

export type PlacementVert  = 'bottom' | 'top'
export type PlacementHoriz = 'left' | 'right'

export interface PlacementResult {
  top: number | null
  bottom: number | null
  left: number
  width: number
  maxHeight: number
  vert: PlacementVert
  horiz: PlacementHoriz
  cls: string
}
