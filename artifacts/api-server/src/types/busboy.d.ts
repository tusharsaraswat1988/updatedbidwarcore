declare module "busboy" {
  import type { IncomingHttpHeaders } from "node:http";
  import type { Writable } from "node:stream";

  interface BusboyConfig { headers: IncomingHttpHeaders; limits?: { fileSize?: number; files?: number } }
  interface FileInfo { filename: string; encoding: string; mimeType: string }
  interface Busboy extends Writable {
    on(event: "file", listener: (name: string, stream: NodeJS.ReadableStream, info: FileInfo) => void): this;
    on(event: "field", listener: (name: string, value: string) => void): this;
    on(event: "error" | "finish" | "close", listener: (...args: any[]) => void): this;
  }
  function busboy(config: BusboyConfig): Busboy;
  export default busboy;
}
