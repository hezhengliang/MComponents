/**
 * Wafer 渲染 Web Worker
 * 在后台线程处理繁重的数据计算
 */

import type { DieData, WaferMapData, WaferStats } from './types'

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

function calculateStats(dies, config) {
  const { radius, edgeExclusion, scale } = config;
  const edgeExclusionPx = edgeExclusion * scale;
  const effectiveRadius = radius * scale - edgeExclusionPx;
  
  let totalDies = 0;
  let goodDies = 0;
  const binCounts = new Map();
  
  for (const die of dies) {
    const dieCenterX = die.x * config.dieSize * scale;
    const dieCenterY = die.y * config.dieSize * scale;
    const distance = Math.sqrt(dieCenterX * dieCenterX + dieCenterY * dieCenterY);
    
    if (distance + config.dieSize * scale / 2 <= effectiveRadius) {
      totalDies++;
      
      if (die.bin === 1) {
        goodDies++;
      }
      
      const count = binCounts.get(die.bin) || 0;
      binCounts.set(die.bin, count + 1);
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

function filterDies(dies, filter) {
  return dies.filter(die => {
    if (filter.bin !== undefined && die.bin !== filter.bin) return false;
    if (filter.minX !== undefined && die.x < filter.minX) return false;
    if (filter.maxX !== undefined && die.x > filter.maxX) return false;
    if (filter.minY !== undefined && die.y < filter.minY) return false;
    if (filter.maxY !== undefined && die.y > filter.maxY) return false;
    return true;
  });
}

function processDies(dies, options) {
  const { scale, centerX, centerY, dieSize } = options;
  
  return dies.map(die => {
    const pixelSize = dieSize * scale;
    const halfSize = pixelSize / 2;
    
    return {
      ...die,
      screenX: centerX + die.x * pixelSize - halfSize,
      screenY: centerY + die.y * pixelSize - halfSize,
      pixelSize
    };
  });
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
      case 'calculateStats':
        return this.calculateStatsFallback(payload as { dies: DieData[]; config: Record<string, number> });
      default:
        throw new Error(`Fallback not implemented for type: ${type}`);
    }
  }

  private calculateStatsFallback({ dies }: { dies: DieData[]; config?: Record<string, number> }): WaferStats {
    const binCounts = new Map<number, number>();
    let goodDies = 0;

    for (const die of dies) {
      const count = binCounts.get(die.bin) ?? 0;
      binCounts.set(die.bin, count + 1);

      if (die.bin === 1) {
        goodDies++;
      }
    }

    const totalDies = dies.length;

    return {
      totalDies,
      goodDies,
      badDies: totalDies - goodDies,
      yield: totalDies > 0 ? (goodDies / totalDies) * 100 : 0,
      binCounts,
    };
  }

  /**
   * 批量处理多个 wafer 的统计
   */
  public async calculateBatchStats(
    waferDataList: WaferMapData[]
  ): Promise<WaferStats[]> {
    const promises = waferDataList.map(async (data) => {
      const stats = await this.sendTask<WaferStats>('calculateStats', {
        dies: data.dies,
        config: {
          diameter: data.config.diameter,
          dieSize: data.config.dieSize,
          edgeExclusion: data.config.edgeExclusion,
          radius: data.config.diameter / 2,
          scale: 1, // 简化处理
        },
      });
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
