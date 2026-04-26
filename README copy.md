> npm install postcss-pxtorem amfe-flexible -D

vite.config.ts
```ts
import pxtorem from 'postcss-pxtorem'

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        pxtorem({
          rootValue: 192,        // 1920 / 10 = 192
          propList: ['*'],
          unitPrecision: 5,
          minPixelValue: 1,
          exclude: /node_modules/,
          // 不转换边框
          selectorBlackList: [],
        }),
      ],
    },
  },
})
```
flexible.ts
```ts
const BASE_WIDTH = 1920
const BASE_FONT_SIZE = 192  // rootValue 对应，1rem = 192px @ 1920

function setRem() {
  const cssWidth = document.documentElement.clientWidth

  // 和之前手动 67% 一致：按比例自动计算根字体
  // cssWidth=1280 时：1280/1920 * 192 = 128px → 自动 67% 缩放
  // cssWidth=1920 时：192px → 100% 基准
  // cssWidth=2560 时：256px → 133%，加 max 限制
  const fontSize = (cssWidth / BASE_WIDTH) * BASE_FONT_SIZE

  // 限制最大，防止 2K 过大（按需调整上限）
  const finalFontSize = Math.min(fontSize, BASE_FONT_SIZE * 1.2)

  document.documentElement.style.fontSize = `${finalFontSize}px`
}

setRem()
window.addEventListener('resize', setRem)

// 监听系统 DPI 变化（外接显示器切换等）
let mqList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
mqList.addEventListener('change', () => {
  mqList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  setRem()
})
```