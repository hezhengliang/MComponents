declare module 'utif' {
  export function decode(buffer: ArrayBuffer): any[]
  export function decodeImage(buffer: ArrayBuffer, ifd: any, ifds: any[]): void
  export function toRGBA8(ifd: any): Uint8Array
  export function encodeImage(rgba: Uint8Array, width: number, height: number): ArrayBuffer
  export function encode(ifds: any[]): ArrayBuffer
}
