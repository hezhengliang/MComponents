<template>
  <g class="custom-edge">
    <!-- 可见连线 -->
    <path
      :id="id"
      class="vue-flow__edge-path"
      :d="path"
      :style="{ stroke: '#6366f1', strokeWidth: 1, fill: 'none' }"
      :marker-end="`url(#arrow-${id})`"
    />
    <!-- 扩大 hover 检测区域 -->
    <path
      :d="path"
      fill="none"
      stroke="transparent"
      stroke-width="24"
      class="edge-hit-area"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    />
    <defs>
      <marker
        :id="`arrow-${id}`"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M1,2 L6,4 L1,6"
          fill="none"
          stroke="#6366f1"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </marker>
    </defs>
  </g>

  <EdgeLabelRenderer>
    <div
      class="edge-actions"
      :class="{ hovered: isHovered || showMenu }"
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      }"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- + 按钮 -->
      <div class="edge-add-btn" @click="toggleMenu">
        <svg viewBox="0 0 24 24" width="6" height="6" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </div>

      <!-- 删除按钮 -->
      <div class="edge-delete-btn" @click="onDelete">
        <svg viewBox="0 0 24 24" width="4" height="4" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </div>

      <!-- 节点选择菜单 -->
      <div v-if="showMenu" class="edge-add-menu" @click.stop>
        <div
          v-for="item in addNodeTypes"
          :key="item.type"
          class="edge-add-item"
          @click="onAddNode(item.type)"
        >
          <div class="edge-add-icon" :style="{ background: item.color }">
            <svg viewBox="0 0 24 24" width="6" height="6" fill="currentColor">
              <path :d="item.iconPath" />
            </svg>
          </div>
          <span class="edge-add-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import { getBezierPath, EdgeLabelRenderer, useVueFlow, type EdgeProps } from '@vue-flow/core'
import { nanoid } from 'nanoid'

const props = defineProps<EdgeProps>()

const { addNodes, addEdges, removeEdges } = useVueFlow()

const addNodeTypes = inject<{ type: string; label: string; color: string; iconPath: string }[]>('edgeAddNodeTypes', [])
const getDefaultNodeData = inject<(type: string) => Record<string, any>>('edgeAddNodeDataFn', () => ({}))

const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.4,
  })
  return edgePath
})

const labelX = computed(() => (props.sourceX + props.targetX) / 2)
const labelY = computed(() => (props.sourceY + props.targetY) / 2)

const isHovered = ref(false)
const showMenu = ref(false)
let hoverTimer: number | null = null

function onMouseEnter() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  isHovered.value = true
}

function onMouseLeave() {
  hoverTimer = window.setTimeout(() => {
    if (!showMenu.value) {
      isHovered.value = false
    }
  }, 150)
}

function toggleMenu(e: MouseEvent) {
  e.stopPropagation()
  showMenu.value = !showMenu.value
  if (showMenu.value) {
    isHovered.value = true
  }
}

function onDelete(e: MouseEvent) {
  e.stopPropagation()
  removeEdges(props.id)
}

function onAddNode(nodeType: string) {
  showMenu.value = false
  isHovered.value = false

  const midX = (props.sourceX + props.targetX) / 2
  const midY = (props.sourceY + props.targetY) / 2

  const newNodeId = `${nodeType}-${nanoid(6)}`

  addNodes([
    {
      id: newNodeId,
      type: nodeType,
      position: { x: midX - 80, y: midY - 30 },
      data: getDefaultNodeData(nodeType),
    } as any,
  ])

  removeEdges(props.id)

  const edgeId = `e-${nanoid(6)}`
  addEdges([
    {
      id: `${edgeId}-1`,
      source: props.source,
      target: newNodeId,
      sourceHandle: props.sourceHandle || undefined,
      type: 'custom',
      animated: false,
      deletable: true,
      style: { stroke: '#6366f1', strokeWidth: 1 },
    } as any,
    {
      id: `${edgeId}-2`,
      source: newNodeId,
      target: props.target,
      targetHandle: props.targetHandle || undefined,
      type: 'custom',
      animated: false,
      deletable: true,
      style: { stroke: '#6366f1', strokeWidth: 1 },
    } as any,
  ])
}
</script>

<style scoped>
.edge-hit-area {
  pointer-events: stroke;
}
</style>

<style>
/* 使用全局样式，因为 EdgeLabelRenderer 内容渲染在 VueFlow overlay 层 */
.edge-actions {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.edge-actions.hovered .edge-add-btn,
.edge-actions.hovered .edge-delete-btn {
  opacity: 1;
}

.edge-add-btn {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: all;
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 8px rgba(99,102,241,0.25), 0 0 0 1px rgba(99,102,241,0.08);
  user-select: none;
}

.edge-add-btn:hover {
  transform: scale(1.18);
  box-shadow: 0 6px 20px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.12);
}

.edge-add-btn svg {
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08));
}

.edge-delete-btn {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: all;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  opacity: 0;
  transition: all 0.2s;
}

.edge-delete-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #ef4444;
  transform: scale(1.1);
}

.edge-add-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
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

.edge-add-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.edge-add-item:hover {
  background: #f1f5f9;
}

.edge-add-icon {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edge-add-label {
  font-size: 9px;
  color: #334155;
  font-weight: 500;
  white-space: nowrap;
}
</style>
