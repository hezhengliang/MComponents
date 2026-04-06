import { ref, onUnmounted } from 'vue'
import type { FlatItem } from './types'

interface UseVirtualListOptions {
  itemHeight: number
  groupHeight: number
}

interface VirtualRange {
  start: number
  end: number
}

export interface VirtualListInstance {
  /** The total scroll-height string to apply to the spacer element */
  totalHeight: ReturnType<typeof ref<number>>
  /** Currently rendered slice */
  range: ReturnType<typeof ref<VirtualRange>>
  /** Top offset of the rendered window (px) */
  windowTop: ReturnType<typeof ref<number>>
  /** Must be called when the viewport element mounts */
  mount: (el: HTMLElement) => void
  /** Must be called when the viewport element unmounts */
  unmount: () => void
  /** Replace the items list and reset scroll */
  setItems: (items: FlatItem[]) => void
  /** Force a re-render of the current range (e.g. after selection change) */
  refresh: () => void
  /** Scroll so that items[idx] is visible in the viewport */
  scrollToIndex: (idx: number) => void
}

export function useVirtualList(
  initialItems: FlatItem[],
  options: UseVirtualListOptions,
): VirtualListInstance {
  const { itemHeight, groupHeight } = options

  let items: FlatItem[] = initialItems
  let offsets  = new Float64Array(0)
  let totalH   = 0
  let viewport: HTMLElement | null = null
  let rafId: number | null = null
  let range_s  = -1
  let range_e  = -1

  const totalHeight = ref(0)
  const range       = ref<VirtualRange>({ start: 0, end: 0 })
  const windowTop   = ref(0)

  // ─── offset pre-computation ────────────────────────────────────────────────
  function buildOffsets() {
    const n = items.length
    offsets = new Float64Array(n + 1)
    let acc = 4
    for (let i = 0; i < n; i++) {
      offsets[i] = acc
      acc += items[i].__group ? groupHeight : itemHeight
    }
    offsets[n] = acc
    totalH = acc + 4
    totalHeight.value = totalH
  }

  // ─── binary search ─────────────────────────────────────────────────────────
  function findStart(scrollTop: number): number {
    if (scrollTop <= 0) return 0
    let lo = 0, hi = items.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  // ─── paint ─────────────────────────────────────────────────────────────────
  function paint() {
    if (!viewport) return
    const st  = viewport.scrollTop
    const vh  = viewport.clientHeight || 220
    const os  = Math.max(itemHeight * 4, 80)

    let s = Math.max(0, findStart(st - os))
    let e = s
    while (e < items.length && offsets[e] < st + vh + os) e++
    e = Math.min(items.length, e)

    if (s === range_s && e === range_e) return
    range_s = s
    range_e = e

    windowTop.value = offsets[s] ?? 0
    range.value = { start: s, end: e }
  }

  function onScroll() {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      paint()
    })
  }

  // ─── public API ────────────────────────────────────────────────────────────
  function mount(el: HTMLElement) {
    viewport = el
    buildOffsets()
    el.addEventListener('scroll', onScroll, { passive: true })
    paint()
  }

  function unmount() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    viewport?.removeEventListener('scroll', onScroll)
    viewport = null
  }

  function setItems(newItems: FlatItem[]) {
    items = newItems
    buildOffsets()
    range_s = -1; range_e = -1
    if (viewport) viewport.scrollTop = 0
    paint()
  }

  function refresh() {
    range_s = -1; range_e = -1
    paint()
  }

  function scrollToIndex(idx: number) {
    if (!viewport || idx < 0 || idx >= items.length) return
    const top = offsets[idx]
    const bot = top + (items[idx].__group ? groupHeight : itemHeight)
    const vpT = viewport.scrollTop
    const vpB = vpT + viewport.clientHeight
    if (top < vpT)      viewport.scrollTop = top - 4
    else if (bot > vpB) viewport.scrollTop = bot - viewport.clientHeight + 4
  }

  buildOffsets()
  onUnmounted(unmount)

  return { totalHeight, range, windowTop, mount, unmount, setItems, refresh, scrollToIndex }
}
