import { ref, onUnmounted } from 'vue'
import type { PlacementResult } from './types'

const GAP        = 5
const MARGIN     = 8
const MIN_HEIGHT = 200

export function computePlacement(
  triggerRect: DOMRect,
  preferredH: number,
  fixedWidth?: number,
): PlacementResult {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { top, bottom, left, right, width } = triggerRect
  const G = GAP, M = MARGIN

  const spaceBelow = vh - bottom - G - M
  const spaceAbove = top - G - M
  const goDown = spaceBelow >= MIN_HEIGHT || spaceBelow >= spaceAbove

  let ddTop: number | null = null
  let ddBottom: number | null = null
  let maxHeight: number

  if (goDown) {
    ddTop     = bottom + G
    maxHeight = Math.max(MIN_HEIGHT, Math.min(preferredH, spaceBelow))
  } else {
    ddBottom  = vh - top + G
    maxHeight = Math.max(MIN_HEIGHT, Math.min(preferredH, spaceAbove))
  }

  // When fixedWidth is provided it overrides the trigger-derived width.
  // We still clamp to the viewport so it never exceeds available space.
  const ddWidth = fixedWidth != null && fixedWidth > 0
    ? Math.min(Math.round(fixedWidth), vw - 2 * M)
    : Math.min(Math.max(width, 160), vw - 2 * M)

  // Horizontal alignment: prefer left-align with trigger, flip when it
  // would overflow the right edge, then clamp to left margin.
  let ddLeft = left
  if (ddLeft + ddWidth > vw - M) ddLeft = right - ddWidth
  if (ddLeft < M) ddLeft = M

  const vert  = goDown ? 'bottom' : 'top'
  const horiz = ddLeft < left - 1 ? 'right' : 'left'

  return {
    top:       ddTop    !== null ? Math.round(ddTop)    : null,
    bottom:    ddBottom !== null ? Math.round(ddBottom) : null,
    left:      Math.round(ddLeft),
    width:     Math.round(ddWidth),
    maxHeight: Math.round(maxHeight),
    vert:      vert  as 'bottom' | 'top',
    horiz:     horiz as 'left' | 'right',
    cls:       `ms-dd--${vert}-${horiz}`,
  }
}

/** Reactive placement — recomputes on scroll/resize while active */
export function usePlacement() {
  const placement = ref<PlacementResult | null>(null)
  let triggerEl: HTMLElement | null = null
  let preferredH  = 220
  let fixedWidth: number | undefined = undefined
  let active = false
  let rafId: number | null = null

  function recompute() {
    if (!triggerEl || !active) return
    placement.value = computePlacement(triggerEl.getBoundingClientRect(), preferredH, fixedWidth)
  }

  function onScrollOrResize() {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => { rafId = null; recompute() })
  }

  function start(el: HTMLElement, height: number, fw?: number) {
    triggerEl  = el
    preferredH = height
    fixedWidth = fw != null && fw > 0 ? fw : undefined
    active     = true
    recompute()
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })
    window.addEventListener('resize', onScrollOrResize)
  }

  function stop() {
    active     = false
    triggerEl  = null
    fixedWidth = undefined
    placement.value = null
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
    window.removeEventListener('scroll', onScrollOrResize, { capture: true } as EventListenerOptions)
    window.removeEventListener('resize', onScrollOrResize)
  }

  onUnmounted(stop)

  return { placement, start, stop, recompute }
}
