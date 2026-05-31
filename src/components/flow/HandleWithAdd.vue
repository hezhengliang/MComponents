<template>
  <Handle
    :type="type"
    :position="position"
    :id="id"
    class="custom-handle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="onHandleClick"
  >
    <Transition name="fade-scale">
      <div
        v-if="showAdd"
        class="handle-add-btn"
        @mouseenter="cancelLeave"
      >
        <svg viewBox="0 0 24 24" width="5" height="5" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </div>
    </Transition>
    <Transition name="fade-scale">
      <div
        v-if="showMenu"
        class="handle-add-menu"
        :class="menuPositionClass"
        @mouseenter="cancelLeave"
        @mouseleave="onMenuMouseLeave"
        @click.stop
      >
        <div
          v-for="item in addNodeTypes"
          :key="item.type"
          class="handle-add-item"
          @click="onAddNode(item.type)"
        >
          <div class="handle-add-icon" :style="{ background: item.color }">
            <svg viewBox="0 0 24 24" width="5" height="5" fill="currentColor">
              <path :d="item.iconPath" />
            </svg>
          </div>
          <span class="handle-add-label">{{ item.label }}</span>
        </div>
      </div>
    </Transition>
  </Handle>
</template>

<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import { Handle, useNode, useVueFlow, Position } from '@vue-flow/core'
import type { HandleProps } from '@vue-flow/core'
import { nanoid } from 'nanoid'

interface Props extends HandleProps {
  id?: string
}

const props = defineProps<Props>()

const { node } = useNode()
const { addNodes, addEdges, removeNodes, removeEdges, viewport, setViewport } = useVueFlow()

const addNodeTypes = inject('edgeAddNodeTypes', [] as { type: string; label: string; color: string; iconPath: string }[])
const getDefaultNodeData = inject('edgeAddNodeDataFn', () => ({})) as (type: string) => Record<string, any>

const showAdd = ref(false)
const showMenu = ref(false)
let hoverTimer: number | null = null
let leaveTimer: number | null = null
const placeholderNodeId = ref<string | null>(null)
const placeholderEdgeId = ref<string | null>(null)

const menuPositionClass = computed(() => ({
  'menu-left': props.position === Position.Left || props.position === Position.Top,
  'menu-right': props.position === Position.Right || props.position === Position.Bottom,
}))

function onMouseEnter() {
  cancelLeave()
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = window.setTimeout(() => {
    showAdd.value = true
  }, 250)
}

function onMouseLeave() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  leaveTimer = window.setTimeout(() => {
    showAdd.value = false
    if (!showMenu.value) {
      clearPlaceholder()
    }
  }, 200)
}

function onMenuMouseLeave() {
  leaveTimer = window.setTimeout(() => {
    showMenu.value = false
    showAdd.value = false
    clearPlaceholder()
  }, 3000)
}

function cancelLeave() {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
}

function clearPlaceholder() {
  if (placeholderNodeId.value) {
    removeNodes([placeholderNodeId.value])
    placeholderNodeId.value = null
  }
  if (placeholderEdgeId.value) {
    removeEdges([placeholderEdgeId.value])
    placeholderEdgeId.value = null
  }
}

function ensureVisible(nodeId: string) {
  const el = document.querySelector(`.vue-flow__node[data-id="${nodeId}"]`) as HTMLElement
  if (!el) return
  const wrapper = document.querySelector('.flow-canvas-wrapper') as HTMLElement
  if (!wrapper) return
  const eRect = el.getBoundingClientRect()
  const wRect = wrapper.getBoundingClientRect()
  const padding = 100
  let dx = 0, dy = 0
  if (eRect.left < wRect.left + padding) dx = wRect.left + padding - eRect.left
  if (eRect.right > wRect.right - padding) dx = wRect.right - padding - eRect.right
  if (eRect.top < wRect.top + padding) dy = wRect.top + padding - eRect.top
  if (eRect.bottom > wRect.bottom - padding) dy = wRect.bottom - padding - eRect.bottom
  if (dx !== 0 || dy !== 0) {
    const { x: vx, y: vy, zoom } = viewport.value
    setViewport({ x: vx + dx, y: vy + dy, zoom })
  }
}

function createPlaceholder() {
  clearPlaceholder()
  const offsetX = props.position === Position.Right || props.position === Position.Bottom ? 350 : -350
  const pId = `ph-${nanoid(6)}`
  const eId = `eph-${nanoid(6)}`
  placeholderNodeId.value = pId
  placeholderEdgeId.value = eId

  addNodes([
    {
      id: pId,
      type: 'placeholder',
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + 20,
      },
      data: {},
    } as any,
  ])

  addEdges([
    {
      id: eId,
      source: props.type === 'source' ? node.id : pId,
      target: props.type === 'source' ? pId : node.id,
      sourceHandle: props.type === 'source' ? (props.id || undefined) : undefined,
      targetHandle: props.type === 'source' ? undefined : (props.id || undefined),
      type: 'custom',
      animated: true,
      deletable: true,
      style: { stroke: '#6366f1', strokeWidth: 1 },
    } as any,
  ])

  setTimeout(() => ensureVisible(pId), 50)
}



function onHandleClick() {
  if (showAdd.value) {
    createPlaceholder()
    showMenu.value = true
  }
}

function onAddNode(nodeType: string) {
  showMenu.value = false
  showAdd.value = false

  // 复用 placeholder 的位置，先删除 placeholder 再创建真实节点
  const pId = placeholderNodeId.value
  const pEdgeId = placeholderEdgeId.value

  // 如果有 placeholder，用它的位置；否则用默认偏移
  let newX = node.position.x + 350
  let newY = node.position.y + 20

  if (pId) {
    const pEl = document.querySelector(`.vue-flow__node[data-id="${pId}"]`) as HTMLElement
    if (pEl) {
      const transform = pEl.style.transform
      const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)
      if (match) {
        newX = parseFloat(match[1])
        newY = parseFloat(match[2])
      }
    }
  }

  // 先清除 placeholder（避免 ID 冲突）
  placeholderNodeId.value = null
  placeholderEdgeId.value = null
  if (pId) {
    // 使用 nextTick 确保 Vue Flow 内部状态同步后再删除
    requestAnimationFrame(() => {
      removeNodes([pId])
    })
  }
  if (pEdgeId) {
    requestAnimationFrame(() => {
      removeEdges([pEdgeId])
    })
  }

  const newNodeId = `${nodeType}-${nanoid(6)}`

  addNodes([
    {
      id: newNodeId,
      type: nodeType,
      position: { x: newX, y: newY },
      data: getDefaultNodeData(nodeType),
    } as any,
  ])

  setTimeout(() => ensureVisible(newNodeId), 50)

  const edgeId = `e-${nanoid(6)}`

  if (props.type === 'source') {
    addEdges([
      {
        id: edgeId,
        source: node.id,
        target: newNodeId,
        sourceHandle: props.id || undefined,
        type: 'custom',
        animated: false,
        deletable: true,
        style: { stroke: '#6366f1', strokeWidth: 1 },
      } as any,
    ])
  } else {
    addEdges([
      {
        id: edgeId,
        source: newNodeId,
        target: node.id,
        targetHandle: props.id || undefined,
        type: 'custom',
        animated: false,
        deletable: true,
        style: { stroke: '#6366f1', strokeWidth: 1 },
      } as any,
    ])
  }
}
</script>

<style scoped>
.custom-handle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.handle-add-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25), 0 0 0 1px rgba(99,102,241,0.08);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 10;
}

.handle-add-btn[data-position="right"] {
  left: calc(100% + 4px);
}

.handle-add-btn[data-position="left"] {
  right: calc(100% + 4px);
}

.handle-add-btn:hover {
  transform: translateY(-50%) scale(1.15);
  box-shadow: 0 4px 12px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.12);
}

.handle-add-menu {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 90px;
  pointer-events: all;
  z-index: 100;
}

.handle-add-menu.menu-right {
  left: calc(100% + 8px);
}

.handle-add-menu.menu-left {
  right: calc(100% + 8px);
}

.handle-add-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 5px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.handle-add-item:hover {
  background: #f1f5f9;
}

.handle-add-icon {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.handle-add-label {
  font-size: 9px;
  color: #334155;
  font-weight: 500;
  white-space: nowrap;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.6);
}
</style>
