import { ref, type Ref, nextTick } from 'vue'
import { nanoid } from 'nanoid'
import { WaferRenderer, generateWaferData } from '../core/wafer'
import type { DieData, WaferMapData } from '../core/wafer'
import type { ConnectionPair } from './useSvgConnections'

export interface ChipDetail {
  id: string
  die: DieData
  dieKey: string
}

export interface DieMarker {
  dieKey: string
  die: DieData
}

const WAFER_SIZE = 360
const WAFER_PADDING = 30

export function useWaferChipDetails(waferRef: Ref<HTMLElement | undefined>) {
  const waferData = ref<WaferMapData | null>(null)
  const dieMarkers = ref<DieMarker[]>([])
  const chipDetails = ref<ChipDetail[]>([])
  const markerRefs = new Map<string, HTMLElement>()
  const detailRefs = new Map<string, HTMLElement>()
  const resizeObservers = new Map<string, ResizeObserver>()

  let renderer: WaferRenderer | null = null
  let notifyUpdate: (() => void) | null = null

  function setNotifyUpdate(fn: () => void) {
    notifyUpdate = fn
  }

  function emitUpdate() {
    nextTick(() => notifyUpdate?.())
  }

  function getDieKey(die: DieData): string {
    return `${die.x},${die.y}`
  }

  function getDiePosition(die: DieData): { x: number; y: number } {
    if (!waferData.value) return { x: 0, y: 0 }
    const config = waferData.value.config
    const available = WAFER_SIZE - WAFER_PADDING * 2
    const scale = Math.min(available / config.diameter, available / config.diameter)
    const center = WAFER_SIZE / 2
    const diePixelSize = config.dieSize * scale

    return {
      x: center + die.x * diePixelSize,
      y: center + die.y * diePixelSize,
    }
  }

  function setMarkerRef(el: unknown, dieKey: string) {
    if (el instanceof HTMLElement) {
      markerRefs.set(dieKey, el)
    } else if (el === null) {
      markerRefs.delete(dieKey)
    }
  }

  function setDetailRef(el: unknown, id: string) {
    if (el instanceof HTMLElement) {
      detailRefs.set(id, el)
    } else if (el === null) {
      detailRefs.delete(id)
    }
  }

  function makeDraggable(el: HTMLElement) {
    let startX = 0
    let startY = 0
    let initialLeft = 0
    let initialTop = 0

    el.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.image-wrapper')) return

      e.preventDefault()
      startX = e.clientX
      startY = e.clientY

      const rect = el.getBoundingClientRect()
      const parent = el.offsetParent as HTMLElement
      const parentRect = parent.getBoundingClientRect()
      initialLeft = rect.left - parentRect.left
      initialTop = rect.top - parentRect.top

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const parentRect = parent.getBoundingClientRect()
        const minLeft = -parentRect.left
        const minTop = -parentRect.top
        const maxLeft = window.innerWidth - parentRect.left - el.offsetWidth
        const maxTop = window.innerHeight - parentRect.top - el.offsetHeight
        const newLeft = Math.max(minLeft, Math.min(maxLeft, initialLeft + dx))
        const newTop = Math.max(minTop, Math.min(maxTop, initialTop + dy))
        el.style.left = `${newLeft}px`
        el.style.top = `${newTop}px`
        emitUpdate()
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  }

  function createChipDetail(die: DieData) {
    const dieKey = getDieKey(die)
    const id = nanoid(6)
    const index = chipDetails.value.length

    if (!dieMarkers.value.find(m => m.dieKey === dieKey)) {
      dieMarkers.value.push({ dieKey, die })
    }

    chipDetails.value.push({ id, die, dieKey })

    nextTick(() => {
      const detailEl = detailRefs.get(id)
      if (detailEl) {
        detailEl.style.left = `${460 + (index % 5) * 40}px`
        detailEl.style.top = `${40 + Math.floor(index / 5) * 160}px`
        makeDraggable(detailEl)

        const ro = new ResizeObserver(() => emitUpdate())
        ro.observe(detailEl)
        resizeObservers.set(id, ro)
      }

      emitUpdate()
    })
  }

  function removeDetail(id: string) {
    const detail = chipDetails.value.find(d => d.id === id)
    if (!detail) return

    detailRefs.delete(id)

    const ro = resizeObservers.get(id)
    ro?.disconnect()
    resizeObservers.delete(id)

    chipDetails.value = chipDetails.value.filter(d => d.id !== id)

    const hasOther = chipDetails.value.some(d => d.dieKey === detail.dieKey)
    if (!hasOther) {
      dieMarkers.value = dieMarkers.value.filter(m => m.dieKey !== detail.dieKey)
      markerRefs.delete(detail.dieKey)
    }

    emitUpdate()
  }

  function clearAll() {
    for (const ro of resizeObservers.values()) {
      ro.disconnect()
    }
    resizeObservers.clear()
    detailRefs.clear()
    markerRefs.clear()
    chipDetails.value = []
    dieMarkers.value = []
    emitUpdate()
  }

  function init() {
    if (!waferRef.value) return

    waferData.value = generateWaferData('W001', 'LOT001')
    renderer = new WaferRenderer(waferRef.value, waferData.value, {
      width: WAFER_SIZE,
      height: WAFER_SIZE,
    })

    renderer.on('die-click', (die) => {
      createChipDetail(die)
    })
  }

  function getConnectionPairs(): ConnectionPair[] {
    return chipDetails.value
      .map(d => {
        const anchor = markerRefs.get(d.dieKey)
        const target = detailRefs.get(d.id)
        return anchor && target ? { id: d.id, anchor, target } : null
      })
      .filter(Boolean) as ConnectionPair[]
  }

  return {
    waferData,
    dieMarkers,
    chipDetails,
    init,
    createChipDetail,
    removeDetail,
    clearAll,
    setMarkerRef,
    setDetailRef,
    getDiePosition,
    getConnectionPairs,
    setNotifyUpdate,
  }
}
