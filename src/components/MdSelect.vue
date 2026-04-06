<script setup lang="ts">
import { ref, computed } from 'vue'
import { MdSelect } from './MdSelect'
import type { SelectOptionOrGroup, SelectOption } from './MdSelect'

// ─── Basic options ─────────────────────────────────────────────────────────────
const frameworks: SelectOptionOrGroup<string>[] = [
  { value: 'vue', label: 'Vue.js' },
  { value: 'react', label: 'React' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solidjs', label: 'SolidJS' },
  { value: 'qwik', label: 'Qwik' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
]

// ─── Grouped options ───────────────────────────────────────────────────────────
const grouped: SelectOptionOrGroup<number>[] = [
  {
    label: 'Frontend',
    options: [
      { value: 1, label: 'Vue.js' },
      { value: 2, label: 'React' },
      { value: 3, label: 'Svelte', disabled: true },
    ],
  },
  {
    label: 'Backend',
    options: [
      { value: 4, label: 'Express' },
      { value: 5, label: 'Fastify' },
      { value: 6, label: 'NestJS' },
      { value: 7, label: 'Hono' },
    ],
  },
  {
    label: 'Fullstack',
    options: [
      { value: 8, label: 'Next.js', disabled: true },
      { value: 9, label: 'Nuxt' },
      { value: 10, label: 'Remix' },
    ],
  },
]

// ─── Large dataset ─────────────────────────────────────────────────────────────
function genOpts(n: number): SelectOptionOrGroup<number>[] {
  return Array.from({ length: n }, (_, i) => ({
    value: i + 1,
    label: `Item ${String(i + 1).padStart(6, '0')} — ${((Math.random() * 1e9) | 0).toString(36)}`,
  }))
}

function genGrouped(n: number): SelectOptionOrGroup<number>[] {
  const groups = ['Frontend', 'Backend', 'Fullstack', 'Mobile', 'Desktop', 'Database', 'Cloud', 'DevOps', 'AI/ML', 'Testing']
  const pp = Math.ceil(n / groups.length)
  return groups.map((lbl, gi) => ({
    label: lbl,
    options: Array.from({ length: pp }, (_, i) => {
      const id = gi * pp + i + 1
      return {
        value: id,
        label: `${lbl}-${String(id).padStart(4, '0')} ${((Math.random() * 1e6) | 0).toString(36)}`,
        disabled: Math.random() < 0.04,
      }
    }),
  }))
}

const opts10k = genOpts(10_000)
const opts100k = genOpts(100_000)
const opts10kMulti = genOpts(10_000)
const groupedLarge = genGrouped(2000)

// ─── Demo values ───────────────────────────────────────────────────────────────
const v1 = ref<string | null>('react')
const v2 = ref<number | null>(null)
const v3 = ref<number | null>(null)
const v4 = ref<number[]>([])
const v5 = ref<number | null>(null)
const v6a = ref<string | null>(null)
const v6b = ref<string | null>('svelte')
const v6c = ref<string | null>(null)

// ─── fit-input-width demo ──────────────────────────────────────────────────────
// Simulate a custom renderer whose displayed text is wider than the raw label.
// Without fit-input-width the dropdown would be sized to the trigger width
// (≈ label width) and the custom content would overflow or be clipped.
function richRender(opt: SelectOption<string>): string {
  const icons: Record<string, string> = {
    vue: '🟢', react: '🔵', angular: '🔴', svelte: '🟠',
    solidjs: '🟣', qwik: '⚡', astro: '🚀', nuxt: '💚', nextjs: '⬛', remix: '💿',
  }
  const icon = icons[opt.value] ?? '📦'
  return `<span style="display:flex;align-items:center;gap:8px;width:100%">
    <span style="font-size:16px;line-height:1">${icon}</span>
    <span style="flex:1">${opt.label}</span>
    <span style="font-size:10px;font-family:ui-monospace,monospace;color:#71717a;white-space:nowrap">${opt.value}.js · popular framework</span>
  </span>`
}
const cornerOpts: SelectOptionOrGroup<string>[] = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa']
  .map(l => ({ value: l.toLowerCase(), label: l }))
const vcTL = ref<string | null>(null)
const vcTR = ref<string | null>(null)
const vcBL = ref<string | null>(null)
const vcBR = ref<string | null>(null)

// ─── Display helpers ───────────────────────────────────────────────────────────
const v4Display = computed(() =>
  v4.value.length ? v4.value.slice(0, 5).join(', ') + (v4.value.length > 5 ? ` +${v4.value.length - 5}` : '') : '未选择'
)
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="page-header">
      <h1>md-select</h1>
      <p>Vue 3 + TypeScript · Virtual scroll · Adaptive placement · Keyboard nav</p>
    </div>

    <!-- Keyboard hints -->
    <div class="kbd-hints">
      <span class="kbd-hint"><kbd>↑↓</kbd> Navigate / switch value when closed</span>
      <span class="kbd-hint"><kbd>Enter</kbd> Confirm / Open</span>
      <span class="kbd-hint"><kbd>Esc</kbd> Close</span>
      <span class="kbd-hint"><kbd>Space</kbd> Open</span>
      <span class="kbd-hint"><kbd>Tab</kbd> Move focus</span>
    </div>

    <p class="section-title">Demos</p>

    <div class="demo-grid">
      <!-- 01 basic -->
      <div class="demo-card">
        <div class="demo-card__label">01 · basic</div>
        <div class="demo-card__title">单选</div>
        <div class="demo-card__desc">基础单选，可清除</div>
        <MdSelect v-model="v1" :options="frameworks" placeholder="选择框架" clearable />
        <div class="value-display">value: {{ v1 ?? '未选择' }}</div>
      </div>

      <!-- 02 virtual 10k -->
      <div class="demo-card">
        <div class="demo-card__label">02 · virtual · 10k</div>
        <div class="demo-card__title">大数据单选</div>
        <div class="demo-card__desc">1 万条，可搜索</div>
        <MdSelect v-model="v2" :options="opts10k" placeholder="从 1 万条中选择" filterable clearable :dropdown-height="240" />
        <div class="value-display">{{ v2 != null ? `value: ${v2}` : '未选择' }}</div>
      </div>

      <!-- 03 virtual 100k -->
      <div class="demo-card">
        <div class="demo-card__label">03 · virtual · 100k</div>
        <div class="demo-card__title">超大数据</div>
        <div class="demo-card__desc">10 万条流畅渲染</div>
        <MdSelect v-model="v3" :options="opts100k" placeholder="从 10 万条中选择" filterable clearable
          :dropdown-height="240" />
        <div class="value-display">{{ v3 != null ? `value: ${v3}` : '未选择' }}</div>
      </div>

      <!-- 04 multiple -->
      <div class="demo-card">
        <div class="demo-card__label">04 · multiple</div>
        <div class="demo-card__title">多选</div>
        <div class="demo-card__desc">1 万条 · 搜索 · 全选</div>
        <MdSelect v-model="v4" :options="opts10kMulti" placeholder="多选…" multiple filterable clearable
          :max-tag-count="3" :dropdown-height="240" />
        <div class="value-display">{{ v4Display }}</div>
      </div>

      <!-- 05 grouped -->
      <div class="demo-card">
        <div class="demo-card__label">05 · grouped</div>
        <div class="demo-card__title">分组 + 禁用</div>
        <div class="demo-card__desc">分组虚拟滚动</div>
        <MdSelect v-model="v5" :options="groupedLarge" placeholder="分组选择" filterable clearable :dropdown-height="240" />
        <div class="value-display">{{ v5 != null ? `value: ${v5}` : '未选择' }}</div>
      </div>

      <!-- 06 sizes -->
      <div class="demo-card">
        <div class="demo-card__label">06 · sizes</div>
        <div class="demo-card__title">尺寸变体</div>
        <div class="demo-card__desc">sm / default / lg</div>
        <MdSelect v-model="v6a" :options="frameworks" placeholder="Small" size="sm" />
        <MdSelect v-model="v6b" :options="frameworks" placeholder="Default" style="margin-top:6px" />
        <MdSelect v-model="v6c" :options="frameworks" placeholder="Large" size="lg" style="margin-top:6px" />
      </div>

      <!-- 07 disabled -->
      <div class="demo-card">
        <div class="demo-card__label">07 · disabled</div>
        <div class="demo-card__title">禁用状态</div>
        <MdSelect :options="frameworks" placeholder="已禁用" value="react" disabled />
      </div>

      <!-- 08 grouped small -->
      <div class="demo-card">
        <div class="demo-card__label">08 · grouped small</div>
        <div class="demo-card__title">分组（小数据）</div>
        <MdSelect :options="grouped" placeholder="选择框架" filterable clearable />
      </div>

      <!-- 09 fit-input-width -->
      <div class="demo-card">
        <div class="demo-card__label">09 · fit-input-width</div>
        <div class="demo-card__title">固定下拉宽度</div>
        <div class="demo-card__desc">
          自定义渲染时 label 宽度计算可能偏差，<br>
          用 <code>fit-input-width</code> 固定为 320px
        </div>
        <MdSelect :options="frameworks" :fit-input-width="320" :render-option="richRender"
          placeholder="自定义渲染 · 固定宽 320px" clearable />
      </div>
    </div>

    <!-- Corner placement tests -->
    <div class="edge-corner tl">
      <div class="corner-label">top-left</div>
      <MdSelect v-model="vcTL" :options="cornerOpts" placeholder="top-left" filterable clearable />
    </div>
    <div class="edge-corner tr">
      <div class="corner-label">top-right</div>
      <MdSelect v-model="vcTR" :options="cornerOpts" placeholder="top-right" filterable clearable />
    </div>
    <div class="edge-corner bl">
      <div class="corner-label">bottom-left</div>
      <MdSelect v-model="vcBL" :options="cornerOpts" placeholder="bottom-left" filterable clearable />
    </div>
    <div class="edge-corner br">
      <div class="corner-label">bottom-right</div>
      <MdSelect v-model="vcBR" :options="cornerOpts" placeholder="bottom-right" filterable clearable />
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --background: #ffffff;
  --foreground: #09090b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --radius: 0.5rem;
}

body {
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  background: #f9f9fb;
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}

.page {
  min-height: 200vh;
  padding: 48px 24px 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.page-header {
  text-align: center;
}

.page-header h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -.3px;
  margin-bottom: 4px;
}

.page-header p {
  font-size: 13px;
  color: var(--muted-foreground);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: .08em;
  width: 100%;
  max-width: 860px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.kbd-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 860px;
  width: 100%;
  justify-content: center;
}

.kbd-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted-foreground);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 10px;
}

.kbd-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  padding: 1px 5px;
  min-width: 20px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 860px;
}

.demo-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 2px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.demo-card__label {
  font-size: 10px;
  font-weight: 500;
  font-family: ui-monospace, monospace;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: .08em;
}

.demo-card__title {
  font-size: 13px;
  font-weight: 500;
}

.demo-card__desc {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: -4px;
}

.value-display {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--muted-foreground);
  padding: 7px 10px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.edge-corner {
  position: fixed;
  z-index: 900;
  width: 170px;
}

.edge-corner.tl {
  top: 14px;
  left: 14px;
}

.edge-corner.tr {
  top: 14px;
  right: 14px;
}

.edge-corner.bl {
  bottom: 14px;
  left: 14px;
}

.edge-corner.br {
  bottom: 14px;
  right: 14px;
}

.corner-label {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  color: var(--muted-foreground);
  margin-bottom: 3px;
  text-align: center;
}
</style>
