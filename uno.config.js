// uno.config.ts
import { defineConfig } from 'unocss'

// 笔记本 1366px：font-size = 0.8333vw * 1366 ≈ 11.38px  → 缩小约 71%
// 普通 1080p 1920px：font-size = 16px                    → 基准 100%
// 2K 2560px：font-size = 0.8333vw * 2560 ≈ 21.3px       → 放大（加 media 限制）
export default defineConfig({
  theme: {
    // 设计稿 1px = 0.0625rem（16px基准）
    // UnoCSS spacing 1unit = 0.25rem = 4px @ 1920
  },
  presets: [
    presetUno({
      // rem 基准保持默认 16px 即可，根字体 vw 会自动缩放
    }),
  ],
  preflights: [
    {
      getCSS: () => `
        html {
          font-size: 0.8333vw;
        }
        /* 
          67% 对应根字体 = 16px * 67% = 10.72px
          1280px 时 0.8333vw = 10.67px，已经接近 67%，不需要 media 干预
          只需要限制更小屏幕的下限即可
        */
        @media screen and (max-width: 1280px) {
          html { font-size: 10.72px; } /* 固定在 67% */
        }
        /* 2K 限制上限 */
        @media screen and (min-width: 2560px) {
          html { font-size: 13.3px; }
        }
      `,
    },
  ],
})