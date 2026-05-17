<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { VxeGridInstance, VxeGridProps } from 'vxe-table'

interface RowVO {
  id: number
  name: string
  bgColor: string
}

const xGrid = ref<VxeGridInstance<RowVO>>()

const generateRandomColor = (): string => {
  const letters = '789ABCD'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)]
  }
  return color
}

const generateData = (count: number): RowVO[] => {
  const list: RowVO[] = []
  for (let i = 0; i < count; i++) {
    list.push({ id: i + 1, name: `User ${i + 1}`, bgColor: generateRandomColor() })
  }
  return list
}

// 框选状态集中管理
const rangeState = reactive({
  isRanging: false,
  ctrlKey: false,
  shiftKey: false,
  startIds: new Set<number>(),
  currentIds: new Set<number>()
})

// 实际要高亮的行：Ctrl 时只高亮新增的，否则高亮当前所有选中行
const highlightIds = computed(() => {
  if (!rangeState.isRanging) return new Set<number>()
  if (rangeState.ctrlKey) {
    return new Set([...rangeState.currentIds].filter(id => !rangeState.startIds.has(id)))
  }
  return rangeState.currentIds
})

const gridOptions = reactive<VxeGridProps<RowVO>>({
  border: true,
  showOverflow: true,
  height: '100%',
  rowConfig: { isHover: true },
  checkboxConfig: { highlight: true, range: true },
  cellStyle: ({ row, column }: any) => {
    if (column.field === 'name') {
      return { backgroundColor: row.bgColor }
    }
    return {}
  },
  cellClassName: ({ row }: any) => {
    return highlightIds.value.has(row.id) ? 'range-selecting' : ''
  },
  columns: [
    { type: 'checkbox', width: 60, fixed: 'left', align: 'center' },
    { field: 'name', title: 'Name', minWidth: 200 }
  ],
  data: generateData(100)
})

const selectedInfo = ref('')

const getIds = (rows: RowVO[]): Set<number> => new Set(rows.map(r => r.id))

const getKeysText = () => `${rangeState.ctrlKey ? '[Ctrl]' : ''}${rangeState.shiftKey ? '[Shift]' : ''}`

const checkboxChangeEvent = () => {
  const $grid = xGrid.value
  if ($grid) {
    selectedInfo.value = `Selected ${$grid.getCheckboxRecords().length} rows`
  }
}

const checkboxAllEvent = () => {
  const $grid = xGrid.value
  if ($grid) {
    selectedInfo.value = `Selected ${$grid.getCheckboxRecords().length} rows`
  }
}

const checkboxRangeStartEvent = (params: any) => {
  const $grid = xGrid.value
  rangeState.startIds = $grid ? getIds($grid.getCheckboxRecords()) : new Set()
  rangeState.isRanging = true
  rangeState.ctrlKey = !!params.$event?.ctrlKey
  rangeState.shiftKey = !!params.$event?.shiftKey
  rangeState.currentIds = new Set()
  selectedInfo.value = `框选开始... ${getKeysText()}`
}

const checkboxRangeChangeEvent = (params: any) => {
  const $grid = xGrid.value
  if (!$grid) return

  rangeState.ctrlKey = !!params.$event?.ctrlKey
  rangeState.shiftKey = !!params.$event?.shiftKey
  rangeState.currentIds = getIds($grid.getCheckboxRecords())

  selectedInfo.value = `框选中... ${rangeState.currentIds.size} rows ${getKeysText()}`
}

const checkboxRangeEndEvent = (params: any) => {
  const $grid = xGrid.value
  if ($grid) {
    rangeState.ctrlKey = !!params.$event?.ctrlKey
    rangeState.shiftKey = !!params.$event?.shiftKey
    selectedInfo.value = `框选完成，共选中 ${$grid.getCheckboxRecords().length} 行 ${getKeysText()}`
  }
  rangeState.isRanging = false
  rangeState.currentIds = new Set()
  rangeState.startIds = new Set()
  rangeState.ctrlKey = false
  rangeState.shiftKey = false
}
</script>

<template>
  <div class="vxe-grid-demo">
    <div class="demo-header">
      <h2>vxe-grid Checkbox Range 框选演示</h2>
      <p class="desc">
        开启 <code>checkbox-config.range: true</code> 后，在左侧复选框列按住鼠标拖动即可框选多行。
        框选过程中范围内的行背景色变为 <code>#999</code>。
        支持 Ctrl 追加高亮、Shift 范围选择。
      </p>
      <div class="info">{{ selectedInfo || '请在左侧复选框列按住鼠标拖动框选' }}</div>
    </div>
    <div class="grid-wrapper">
      <vxe-grid
        ref="xGrid"
        v-bind="gridOptions"
        @checkbox-change="checkboxChangeEvent"
        @checkbox-all="checkboxAllEvent"
        @checkbox-range-start="checkboxRangeStartEvent"
        @checkbox-range-change="checkboxRangeChangeEvent"
        @checkbox-range-end="checkboxRangeEndEvent"
      />
    </div>
  </div>
</template>

<style scoped>
.vxe-grid-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.demo-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.demo-header h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #333;
}

.demo-header .desc {
  margin: 0 0 8px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.demo-header .desc code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  color: #d63384;
}

.info {
  font-size: 14px;
  color: #1890ff;
  font-weight: 500;
}

.grid-wrapper {
  flex: 1;
  min-height: 0;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}
</style>

<style>
/* 框选过程中范围内的单元格背景色 */
.vxe-grid-demo td.range-selecting {
  background-color: #999 !important;
}
</style>
