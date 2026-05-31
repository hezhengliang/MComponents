declare module 'dagre' {
  export class Graph {
    constructor()
    setGraph(options: Record<string, any>): void
    setDefaultEdgeLabel(label: () => Record<string, any>): void
    setNode(id: string, options: Record<string, any>): void
    setEdge(source: string, target: string): void
    node(id: string): { x: number; y: number; width: number; height: number } | undefined
    nodes(): string[]
    edges(): Array<{ v: string; w: string }>
  }
  export function layout(graph: Graph): void
  export const graphlib: {
    Graph: new () => Graph
  }
}
