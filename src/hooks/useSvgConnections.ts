import { ref, type Ref } from 'vue'
import { SVG } from '@svgdotjs/svg.js'
import type { Svg, Path } from '@svgdotjs/svg.js'

export interface ConnectionPair {
  id: string
  anchor: HTMLElement
  target: HTMLElement
}

export function useSvgConnections(canvasRef: Ref<HTMLElement | undefined>) {
  let draw: Svg | null = null
  const paths = new Map<string, Path>()

  function init() {
    if (!canvasRef.value) return
    draw = SVG().addTo(canvasRef.value).size('100%', '100%')
    const node = draw.node as unknown as HTMLElement
    node.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:20;'
  }

  function create(id: string) {
    if (!draw || paths.has(id)) return
    const path = draw.path().fill('none').stroke({ color: '#3b82f6', width: 2 })
    paths.set(id, path)
  }

  function update(id: string, anchorEl: HTMLElement, targetEl: HTMLElement) {
    const path = paths.get(id)
    const canvas = canvasRef.value
    if (!path || !canvas) return

    const canvasRect = canvas.getBoundingClientRect()
    const aRect = anchorEl.getBoundingClientRect()
    const tRect = targetEl.getBoundingClientRect()

    const aCx = aRect.left + aRect.width / 2 - canvasRect.left
    const aCy = aRect.top + aRect.height / 2 - canvasRect.top
    const tCx = tRect.left + tRect.width / 2 - canvasRect.left
    const tCy = tRect.top + tRect.height / 2 - canvasRect.top

    const dx = tCx - aCx
    const dy = tCy - aCy

    let x1: number, y1: number, x2: number, y2: number
    let cp1x: number, cp1y: number, cp2x: number, cp2y: number

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) {
        x1 = aRect.right - canvasRect.left
        y1 = aCy
        x2 = tRect.left - canvasRect.left
        y2 = tCy
      } else {
        x1 = aRect.left - canvasRect.left
        y1 = aCy
        x2 = tRect.right - canvasRect.left
        y2 = tCy
      }
      const midX = (x1 + x2) / 2
      cp1x = midX
      cp1y = y1
      cp2x = midX
      cp2y = y2
    } else {
      if (dy >= 0) {
        x1 = aCx
        y1 = aRect.bottom - canvasRect.top
        x2 = tCx
        y2 = tRect.top - canvasRect.top
      } else {
        x1 = aCx
        y1 = aRect.top - canvasRect.top
        x2 = tCx
        y2 = tRect.bottom - canvasRect.top
      }
      const midY = (y1 + y2) / 2
      cp1x = x1
      cp1y = midY
      cp2x = x2
      cp2y = midY
    }

    path.plot(`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`)
  }

  function updateAll(pairs: ConnectionPair[]) {
    for (const { id, anchor, target } of pairs) {
      update(id, anchor, target)
    }
  }

  function remove(id: string) {
    const path = paths.get(id)
    path?.remove()
    paths.delete(id)
  }

  function clear() {
    for (const path of paths.values()) {
      path.remove()
    }
    paths.clear()
  }

  function getIds(): string[] {
    return Array.from(paths.keys())
  }

  return { init, create, update, updateAll, remove, clear, getIds }
}
