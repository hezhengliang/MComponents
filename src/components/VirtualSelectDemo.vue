<script setup lang="ts">
import { ref, computed } from 'vue'
import VirtualSelect, { type SelectOption } from './VirtualSelect.vue'

// 生成大量测试数据
const generateOptions = (count: number, prefix = 'option'): SelectOption[] => {
  return Array.from({ length: count }, (_, i) => ({
    value: `${prefix}-${i}`,
    label: `选项 ${i + 1} - ${['苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓', '蓝莓'][i % 7]}`,
    disabled: i % 20 === 0,
  }))
}

const options = ref<SelectOption[]>(generateOptions(10000))

// 不同位置的示例
const value1 = ref('')
const value2 = ref('')
const value3 = ref('')
const value4 = ref('')
</script>

<template>
  <div class="virtual-select-demo">
    <h2>VirtualSelect 虚拟选择器</h2>
    <p class="subtitle">
      支持 10,000+ 选项的虚拟滚动选择器 | 智能定位防越界 | 键盘导航
    </p>

    <div class="demo-grid">
      <!-- 基础用法 -->
      <div class="demo-card">
        <h3>基础用法（底部弹出）</h3>
        <VirtualSelect
          v-model="value1"
          :options="options.slice(0, 100)"
          placeholder="请选择"
          placement="bottom"
        />
        <div class="value">选中: {{ value1 || '无' }}</div>
      </div>

      <!-- 大量数据 -->
      <div class="demo-card">
        <h3>大量数据（10,000 项）</h3>
        <VirtualSelect
          v-model="value2"
          :options="options"
          filterable
          clearable
          placeholder="搜索 10,000 个选项"
          placement="bottom"
        />
        <div class="value">选中: {{ value2 || '无' }}</div>
      </div>

      <!-- 顶部弹出 -->
      <div class="demo-card">
        <h3>顶部弹出</h3>
        <VirtualSelect
          v-model="value3"
          :options="options.slice(0, 200)"
          filterable
          clearable
          placeholder="从顶部弹出"
          placement="top"
        />
        <div class="value">选中: {{ value3 || '无' }}</div>
      </div>

      <!-- 自定义模板 -->
      <div class="demo-card">
        <h3>自定义选项模板</h3>
        <VirtualSelect
          v-model="value4"
          :options="options.slice(0, 100)"
          placeholder="自定义模板"
        >
          <template #option="{ option, selected }">
            <div class="custom-option">
              <span class="option-index">#{{ option._index + 1 }}</span>
              <span class="option-label">{{ option.label }}</span>
              <span v-if="selected" class="option-badge">已选</span>
            </div>
          </template>
        </VirtualSelect>
        <div class="value">选中: {{ value4 || '无' }}</div>
      </div>
    </div>

    <!-- 边界测试区域 -->
    <div class="boundary-test">
      <h3>边界测试</h3>
      <p>滚动页面，将选择器移到视口边缘，观察下拉框如何自动调整位置防止越界</p>
      <div class="boundary-grid">
        <div class="boundary-cell">
          <VirtualSelect
            v-model="value1"
            :options="options.slice(0, 50)"
            placeholder="左上角"
          />
        </div>
        <div class="boundary-cell">
          <VirtualSelect
            v-model="value2"
            :options="options.slice(0, 50)"
            placeholder="右上角"
          />
        </div>
        <div class="boundary-cell">
          <VirtualSelect
            v-model="value3"
            :options="options.slice(0, 50)"
            placeholder="左下角"
          />
        </div>
        <div class="boundary-cell">
          <VirtualSelect
            v-model="value4"
            :options="options.slice(0, 50)"
            placeholder="右下角"
          />
        </div>
      </div>
    </div>

    <div class="keyboard-hint">
      <h3>🎹 键盘操作提示</h3>
      <ul>
        <li><kbd>↑</kbd> / <kbd>↓</kbd> 关闭下拉时直接切换选项，打开时导航</li>
        <li><kbd>Enter</kbd> / <kbd>Space</kbd> 选择/打开下拉</li>
        <li><kbd>Esc</kbd> 关闭下拉</li>
        <li><kbd>Home</kbd> / <kbd>End</kbd> 跳到首项/末项</li>
        <li><kbd>PageUp</kbd> / <kbd>PageDown</kbd> 翻页</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.virtual-select-demo {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #303133;
}

.subtitle {
  margin: 0 0 24px 0;
  color: #909399;
  font-size: 14px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.demo-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.demo-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.value {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
  word-break: break-all;
}

/* 自定义选项样式 */
.custom-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.option-index {
  font-size: 12px;
  color: #909399;
  min-width: 40px;
}

.option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-badge {
  font-size: 12px;
  padding: 2px 6px;
  background: #409eff;
  color: white;
  border-radius: 4px;
}

/* 边界测试 */
.boundary-test {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.boundary-test h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.boundary-test p {
  margin: 0 0 16px 0;
  color: #909399;
  font-size: 13px;
}

.boundary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 200px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
}

.boundary-cell {
  padding: 10px;
}

/* 键盘提示 */
.keyboard-hint {
  background: #f0f9ff;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #b3d8ff;
}

.keyboard-hint h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #1890ff;
}

.keyboard-hint ul {
  margin: 0;
  padding-left: 20px;
  color: #606266;
  line-height: 2;
}

.keyboard-hint li {
  font-size: 13px;
}

.keyboard-hint kbd {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  font-family: monospace;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 0 #d9d9d9;
  margin: 0 2px;
}
</style>
