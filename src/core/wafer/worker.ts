/**
 * Wafer 渲染 Web Worker
 * 在后台线程处理繁重的数据计算
 */

import { CompactWaferGrid, calculateWaferStats } from './compact-grid'
import type { WaferConfig, WaferMapData, WaferStats } from './types'

export interface WorkerMessage {
  type: 'calculateStats' | 'processDies' | 'filterDies'
  payload: unknown
  id: string
}

export interface WorkerResponse {
  type: string
  result: unknown
  id: string
  error?: string
}

/**
 * Wafer Worker 脚本（字符串形式，用于内联 Worker）
 */
export const waferWorkerScript = `
// Worker 内部代码
self.onmessage = function(e) {
  const { type, payload, id } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'calculateStats':
        result = calculateStats(payload.dies, payload.config);
        break;
      case 'filterDies':
        result = filterDies(payload.dies, payload.filter);
        break;
      case 'processDies':
        result = processDies(payload.dies, payload.options);
        break;
      default:
        throw new Error('Unknown message type: ' + type);
    }
    
    self.postMessage({ type, result, id });
  } catch (error) {
    self.postMessage({ 
      type, 
      result: null, 
      id, 
      error: error.message 
    });
  }
};

function calculateStats(grid, config) {
  const { data, minX, minY, width } = grid;
  const { radius, edgeExclusion, scale, dieSize } = config;
  const edgeExclusionPx = edgeExclusion * scale;
  const effectiveRadius = radius * scale - edgeExclusionPx;
  const diePixelSize = dieSize * scale;
  
  let totalDies = 0;
  let goodDies = 0;
  const binCounts = new Map();
  
  for (let i = 0; i < data.length; i++) {
    const bin = data[i];
    if (bin === 0) continue;
    
    const iy = Math.floor(i / width);
    const ix = i - iy * width;
    const x = ix + minX;
    const y = iy + minY;
    
    const dieCenterX = x * diePixelSize;
    const dieCenterY = y * diePixelSize;
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY);
    
    if (distance + diePixelSize / 2 <= effectiveRadius) {
      totalDies++;
      
      if (bin === 1) {
        goodDies++;
      }
      
      const count = binCounts.get(bin) || 0;
      binCounts.set(bin, count + 1);
    }
  }
  
  return {
    totalDies,
    goodDies,
    badDies: totalDies - goodDies,
    yield: totalDies > 0 ? (goodDies / totalDies) * 100 : 0,
    binCounts: Object.fromEntries(binCounts)
  };
}

function filterDies(grid, filter) {
  const { data, minX, minY, width } = grid;
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    const bin = data[i];
    if (bin === 0) continue;
    
    const iy = Math.floor(i / width);
    const ix = i - iy * width;
    const x = ix + minX;
    const y = iy + minY;
    
    if (filter.bin !== undefined && bin !== filter.bin) continue;
    if (filter.minX !== undefined && x < filter.minX) continue;
    if (filter.maxX !== undefined && x > filter.maxX) continue;
    if (filter.minY !== undefined && y < filter.minY) continue;
    if (filter.maxY !== undefined && y > filter.maxY) continue;
    
    result.push({ x, y, bin });
  }
  
  return result;
}

function processDies(grid, options) {
  const { data, minX, minY, width } = grid;
  const { scale, centerX, centerY, dieSize } = options;
  const pixelSize = dieSize * scale;
  const halfSize = pixelSize / 2;
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    const bin = data[i];
    if (bin === 0) continue;
    
    const iy = Math.floor(i / width);
    const ix = i - iy * width;
    const x = ix + minX;
    const y = iy + minY;
    
    result.push({
      x,
      y,
      bin,
      screenX: centerX + x * pixelSize - halfSize,
      screenY: centerY + y * pixelSize - halfSize,
      pixelSize
    });
  }
  
  return result;
}
`;

/**
 * Wafer Worker 管理器
 */
export class WaferWorkerManager {
  private worker: Worker | null = null
  private pendingTasks = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>()
  private taskId = 0

  constructor() {
    this.initWorker()
  }

  private initWorker(): void {
    try {
      // 创建内联 Worker
      const blob = new Blob([waferWorkerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, result, error } = e.data;
        const task = this.pendingTasks.get(id);

        if (task) {
          if (error) {
            task.reject(new Error(error));
          } else {
            task.resolve(result);
          }
          this.pendingTasks.delete(id);
        }
      };

      this.worker.onerror = () => {
        // Worker error handled silently
      };
    } catch {
      // Web Worker not supported, will fallback to main thread
    }
  }

  /**
   * 发送任务到 Worker
   */
  public async sendTask<T>(type: string, payload: unknown): Promise<T> {
    if (!this.worker) {
      // Worker 不可用，在主线程执行
      return this.fallbackExecute(type, payload) as Promise<T>;
    }

    const id = String(++this.taskId);

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker!.postMessage({ type, payload, id });
    });
  }

  /**
   * 主线程回退执行
   */
  private fallbackExecute(type: string, payload: unknown): unknown {
    switch (type) {
      case 'calculateStats': {
        const { grid, config } = payload as { grid: ReturnType<CompactWaferGrid['toJSON']>; config: Record<string, number> }
        const instance = new CompactWaferGrid({
          ...grid,
          data: new Uint8Array(grid.data),
        })
        return calculateWaferStats(instance, config as unknown as WaferConfig, config.scale ?? 1)
      }
      default:
        throw new Error(`Fallback not implemented for type: ${type}`);
    }
  }

  /**
   * 批量处理多个 wafer 的统计
   */
  public async calculateBatchStats(
    waferDataList: WaferMapData[]
  ): Promise<WaferStats[]> {
    const promises = waferDataList.map(async (data) => {
      const grid = data.dies instanceof CompactWaferGrid
        ? data.dies
        : CompactWaferGrid.fromDies(data.dies, data.config.dieSize)

      const stats = await this.sendTask<WaferStats>('calculateStats', {
        grid: grid.toJSON(),
        config: {
          diameter: data.config.diameter,
          dieSize: data.config.dieSize,
          edgeExclusion: data.config.edgeExclusion,
          radius: data.config.diameter / 2,
          scale: 1, // 简化处理
        },
      });

      // Worker 通过结构化克隆传递时 binCounts 可能变成普通对象，统一转回 Map
      if (!(stats.binCounts instanceof Map)) {
        const raw = stats.binCounts as unknown as Record<string, number>
        stats.binCounts = new Map(Object.entries(raw).map(([bin, count]) => [Number(bin), count]))
      }

      return stats;
    });

    return Promise.all(promises);
  }

  /**
   * 终止 Worker
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
  }
}

export function createWaferWorkerManager(): WaferWorkerManager {
  return new WaferWorkerManager();
}
