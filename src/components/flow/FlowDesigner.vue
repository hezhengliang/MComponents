<template>
  <div class="flow-designer">
    <div class="flow-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">流程设计器</span>
      </div>
      <div class="toolbar-right">
        <button class="tool-btn" @click="layoutGraph">自动布局</button>
        <button class="tool-btn primary" @click="runFlow">运行</button>
      </div>
    </div>
    
    <div class="flow-canvas-wrapper">
      <VueFlow
        ref="vueFlowRef"
        v-model="elements"
        :node-types="nodeTypes"
        :default-edge-options="defaultEdgeOptions"
        :fit-view-on-init="true"
        :min-zoom="0.2"
        :max-zoom="2"
        :delete-key-code="['Delete', 'Backspace']"
        class="flow-canvas"
        @connect="onConnect"
        @node-click="onNodeClick"
        @pane-click="onPaneClick"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <Background pattern-color="#ccc" :gap="12" />
        <Controls />
        <MiniMap />
        
        <template #edge-custom="edgeProps">
          <CustomEdge v-bind="edgeProps" />
        </template>
      </VueFlow>
      
      <!-- 属性面板 -->
      <NodePropertyPanel
        v-if="selectedNode"
        :node="selectedNode"
        @close="selectedNodeId = null"
        @update="onUpdateNodeData"
      />

      <!-- 节点面板 -->
      <div class="node-panel">
        <div class="panel-title">组件</div>
        <div class="panel-nodes">
          <div 
            v-for="node in draggableNodes" 
            :key="node.type"
            class="panel-node"
            draggable="true"
            @dragstart="(e) => onDragStart(e, node.type)"
          >
            <div class="panel-node-icon" :style="{ background: node.color }">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path :d="node.iconPath" />
              </svg>
            </div>
            <span class="panel-node-label">{{ node.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, provide, computed } from 'vue'
import { VueFlow, useVueFlow, type Node, type Edge, type Connection } from '@vue-flow/core'
import dagre from 'dagre'
import { nanoid } from 'nanoid'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import PlaceholderNode from './nodes/PlaceholderNode.vue'
import CustomEdge from './CustomEdge.vue'
import NodePropertyPanel from './NodePropertyPanel.vue'
import { nodeRegistry, draggableNodeTypes } from './form'

const nodeTypes = {
  ...Object.fromEntries(Object.values(nodeRegistry).map(n => [n.type, n.component])),
  placeholder: markRaw(PlaceholderNode),
}

const defaultEdgeOptions = {
  type: 'custom',
  animated: false,
  deletable: true,
  style: { stroke: '#6366f1', strokeWidth: 1 },
}

// 默认仅一个开始节点，其余由用户自行创建
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 100, y: 300 },
    data: {},
  },
]

const initialEdges: Edge[] = []

const vueFlowRef = ref<any>(null)

const elements = ref<(Node | Edge)[]>([...initialNodes, ...initialEdges])

const selectedNodeId = ref<string | null>(null)

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return elements.value.find(
    el => 'id' in el && el.id === selectedNodeId.value && 'position' in el
  ) as Node | null
})

function onNodeClick(event: any) {
  selectedNodeId.value = event.node.id as string
}

const { fitView } = useVueFlow()

function onPaneClick() {
  selectedNodeId.value = null
}

function onUpdateNodeData(nodeId: string, data: Record<string, any>) {
  const idx = elements.value.findIndex(el => 'id' in el && el.id === nodeId && 'position' in el)
  if (idx !== -1) {
    const node = elements.value[idx] as Node
    elements.value = [
      ...elements.value.slice(0, idx),
      { ...node, data },
      ...elements.value.slice(idx + 1),
    ]
  }
}

// 拖拽时传递节点类型（dataTransfer 某些场景不可靠，用全局变量兜底）
let draggedNodeType = ''

const draggableNodes = draggableNodeTypes

const addableNodeTypes = draggableNodes.filter(n => !['start', 'end'].includes(n.type))
provide('edgeAddNodeTypes', addableNodeTypes)
provide('edgeAddNodeDataFn', (type: string) => nodeRegistry[type]?.defaultData() || {})

function onConnect(params: Connection) {
  // 规则：start 只能输出，end 只能输入
  const sourceNode = elements.value.find(el => 'id' in el && el.id === params.source && 'position' in el) as Node | undefined
  const targetNode = elements.value.find(el => 'id' in el && el.id === params.target && 'position' in el) as Node | undefined

  if (targetNode?.type === 'start') return // start 不能作为输入目标
  if (sourceNode?.type === 'end') return   // end 不能作为输出来源

  const newEdge: Edge = {
    id: `e-${nanoid(6)}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle || undefined,
    targetHandle: params.targetHandle || undefined,
    type: 'custom',
    animated: false,
    style: { stroke: '#6366f1', strokeWidth: 1 },
  }
  elements.value = [...elements.value, newEdge]
}

function onDragStart(event: DragEvent, nodeType: string) {
  draggedNodeType = nodeType
  const el = event.currentTarget as HTMLElement
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', nodeType)
    event.dataTransfer.effectAllowed = 'move'
    // 使用节点克隆作为拖拽预览，去掉白色背景
    if (el) {
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.background = '#ffffff'
      clone.style.boxShadow = 'none'
      clone.style.opacity = '0.9'
      clone.style.position = 'fixed'
      clone.style.top = '-9999px'
      clone.style.left = '-9999px'
      clone.style.pointerEvents = 'none'
      document.body.appendChild(clone)
      event.dataTransfer.setDragImage(clone, 0, 0)
      setTimeout(() => {
        if (clone.parentNode) document.body.removeChild(clone)
      }, 0)
    }
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent) {
  const nodeType = event.dataTransfer?.getData('text/plain') || draggedNodeType
  draggedNodeType = ''
  if (!nodeType) return

  // 计算相对于画布容器的位置（默认 zoom=1, pan=0）
  const wrapper = event.currentTarget as HTMLElement
  const rect = wrapper.getBoundingClientRect()
  const position = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }

  // 如果有缩放/平移，尝试转换坐标
  try {
    const pane = wrapper.querySelector('.vue-flow__transformationpane') as HTMLElement
    if (pane) {
      const transform = window.getComputedStyle(pane).transform
      const matrix = new DOMMatrix(transform)
      position.x = (position.x - matrix.m41) / matrix.m11
      position.y = (position.y - matrix.m42) / matrix.m22
    }
  } catch {
    // 忽略转换错误，使用原始坐标
  }

  const newNode: Node = {
    id: `${nodeType}-${nanoid(6)}`,
    type: nodeType,
    position,
    data: getDefaultNodeData(nodeType),
  }

  elements.value = [...elements.value, newNode]
}

function getDefaultNodeData(type: string) {
  return nodeRegistry[type]?.defaultData() || {}
}

function layoutGraph() {
  const nodes = elements.value.filter(el => 'id' in el && 'position' in el) as Node[]
  const edges = elements.value.filter(el => 'source' in el) as Edge[]

  if (nodes.length === 0) return

  // 读取节点实际尺寸
  const nodeDims = new Map<string, { width: number; height: number }>()
  nodes.forEach(n => {
    const domEl = document.querySelector(`.vue-flow__node[data-id="${n.id}"]`) as HTMLElement
    if (domEl) {
      nodeDims.set(n.id, { width: domEl.offsetWidth, height: domEl.offsetHeight })
    } else {
      nodeDims.set(n.id, { width: 200, height: 80 })
    }
  })

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', ranksep: 180, nodesep: 50, edgesep: 30, marginx: 50, marginy: 50 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(n => {
    const dim = nodeDims.get(n.id)!
    g.setNode(n.id, { width: dim.width, height: dim.height })
  })

  edges.forEach(e => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  elements.value = elements.value.map(el => {
    if (!('id' in el) || !('position' in el)) return el
    const gNode = g.node(el.id)
    if (!gNode) return el
    return { ...el, position: { x: gNode.x - gNode.width / 2, y: gNode.y - gNode.height / 2 } }
  })

  setTimeout(() => {
    fitView({ duration: 300, padding: 0.15 })
  }, 50)
}

function runFlow() {
  console.log('Run flow')
}
</script>

<style scoped>
.flow-designer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
}

.flow-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  height: 52px;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.toolbar-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tool-btn {
  padding: 7px 18px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.tool-btn.primary {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
  box-shadow: 0 1px 2px rgba(79,70,229,0.15);
}

.tool-btn.primary:hover {
  background: #4338ca;
  border-color: #4338ca;
}

.flow-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
}

.flow-canvas {
  flex: 1;
  height: 100%;
}

.node-panel {
  position: absolute;
  left: 14px;
  top: 14px;
  width: 170px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  z-index: 10;
  padding: 14px;
}

@supports (overflow-y: overlay) {
  .node-panel {
    overflow-y: overlay;
  }
}

.node-panel::-webkit-scrollbar {
  width: 3px;
}

.node-panel::-webkit-scrollbar-track {
  background: transparent;
}

.node-panel::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 999px;
}

.node-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.6);
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-nodes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s;
  border: 1px solid transparent;
  overflow: hidden;
}

.panel-node:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.panel-node:active {
  cursor: grabbing;
}

.panel-node-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.panel-node-label {
  font-size: 12px;
  color: #334155;
  font-weight: 500;
}

:deep(.vue-flow__edge-path) {
  stroke: #6366f1;
  stroke-width: 1;
}

:deep(.vue-flow__handle) {
  opacity: 1;
  width: 4px !important;
  height: 4px !important;
  background: #6366f1 !important;
  border: none !important;
  box-shadow: none !important;
  transition: all 0.12s ease;
}

:deep(.vue-flow__handle[data-handlepos="left"]) {
  left: -2px !important;
}

:deep(.vue-flow__handle[data-handlepos="right"]) {
  right: -2px !important;
}

:deep(.vue-flow__handle[data-handlepos="top"]) {
  top: -2px !important;
}

:deep(.vue-flow__handle[data-handlepos="bottom"]) {
  bottom: -2px !important;
}

/* 节点选中状态 */
:deep(.vue-flow__node.selected) {
  z-index: 100 !important;
}

:deep(.vue-flow__node.selected .flow-node) {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 1px rgba(99,102,241,0.15), 0 8px 24px rgba(0,0,0,0.08) !important;
}

/* 画布背景优化 */
:deep(.vue-flow__background) {
  background-color: #f8fafc;
}

:deep(.vue-flow__node:hover) {
  z-index: 50;
}

/* 节点内部 Mac 风格滚动条 — WebKit 用自定义，Firefox 用 thin */
:deep(.flow-node ::-webkit-scrollbar) {
  width: 2px;
  height: 2px;
}

:deep(.flow-node ::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.flow-node ::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px;
}

:deep(.flow-node ::-webkit-scrollbar-thumb:hover) {
  background: rgba(148, 163, 184, 0.65);
}

/* Firefox（不支持 ::-webkit-scrollbar）：回退到 thin */
@supports not selector(::-webkit-scrollbar) {
  :deep(.flow-node) {
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
  }
}
</style>
