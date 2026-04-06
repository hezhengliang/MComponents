<script setup lang="ts">
import { ref } from 'vue'
import SingleWaferView from './components/wafer/SingleWaferView.vue'
import MultiWaferView from './components/wafer/MultiWaferView.vue'
import LargeDataExample from './examples/LargeDataExample.vue'
import TreeDemo from './components/TreeDemo.vue'
import TreeV2Demo from './components/TreeV2Demo.vue'
import VirtualListDemo from './components/VirtualListDemo.vue'
import RBrushDemo from './components/RBrushDemo.vue'
import MsSelectDemo from './components/MdSelect.vue'
import VirtualSelectDemo from './components/VirtualSelectDemo.vue'

type ViewMode = 'single' | 'multi' | 'large-data' | 'tree-demo' | 'tree-v2-demo' | 'virtual-list' | 'rbrush-demo' | 'ms-select' | 'virtual-select'

const currentView = ref<ViewMode>('ms-select')

function switchView(mode: ViewMode): void {
  currentView.value = mode
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>Wafer Map Visualization</h1>
      <nav class="nav">
        <!-- <button
          :class="{ active: currentView === 'single' }"
          @click="switchView('single')"
        >
          Single Wafer
        </button>
        <button
          :class="{ active: currentView === 'multi' }"
          @click="switchView('multi')"
        >
          Multi Wafer
        </button>
        <button
          :class="{ active: currentView === 'large-data' }"
          @click="switchView('large-data')"
          style="background: #f0f9ff; border-color: #3b82f6; color: #3b82f6;"
        >
          🚀 Large Data
        </button> -->
        <button
          :class="{ active: currentView === 'tree-demo' }"
          @click="switchView('tree-demo')"
          style="background: #f0f9eb; border-color: #67c23a; color: #67c23a;"
        >
          🌲 Tree 多选
        </button>
        <button
          :class="{ active: currentView === 'tree-v2-demo' }"
          @click="switchView('tree-v2-demo')"
          style="background: #fef0f0; border-color: #f56c6c; color: #f56c6c;"
        >
          🚀 Tree V2 (R-tree)
        </button>
        <button
          :class="{ active: currentView === 'virtual-list' }"
          @click="switchView('virtual-list')"
          style="background: #f0f9ff; border-color: #3b82f6; color: #3b82f6;"
        >
          📋 Virtual List (RBush)
        </button>
        <button
          :class="{ active: currentView === 'rbrush-demo' }"
          @click="switchView('rbrush-demo')"
          style="background: #fef0ff; border-color: #d63384; color: #d63384;"
        >
          🎯 RBush 演示
        </button>
        <button
          :class="{ active: currentView === 'ms-select' }"
          @click="switchView('ms-select')"
          style="background: #f0f9ff; border-color: #1890ff; color: #1890ff;"
        >
          🔽 MsSelect
        </button>
        <button
          :class="{ active: currentView === 'virtual-select' }"
          @click="switchView('virtual-select')"
          style="background: #f0fff4; border-color: #10b981; color: #059669;"
        >
          🎯 VirtualSelect
        </button>
      </nav>
    </header>
    
    <main class="main">
      <SingleWaferView v-if="currentView === 'single'" />
      <MultiWaferView v-if="currentView === 'multi'" />
      <LargeDataExample v-if="currentView === 'large-data'" />
      <TreeDemo v-if="currentView === 'tree-demo'" />
      <TreeV2Demo v-if="currentView === 'tree-v2-demo'" />
      <VirtualListDemo v-if="currentView === 'virtual-list'" />
      <RBrushDemo v-if="currentView === 'rbrush-demo'" />
      <MsSelectDemo v-if="currentView === 'ms-select'" />
      <VirtualSelectDemo v-if="currentView === 'virtual-select'" />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
}

.header h1 {
  font-size: 18px;
  color: #333;
}

.nav {
  display: flex;
  gap: 8px;
}

.nav button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.nav button:hover {
  background: #f5f5f5;
}

.nav button.active {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.main > * {
  height: 100%;
}
</style>
