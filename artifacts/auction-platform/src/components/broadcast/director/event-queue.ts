import type { BroadcastEvent } from "./types";

const MAX_QUEUE = 64;

/** FIFO event queue with dedupe for identical consecutive events. */
export class BroadcastEventQueue {
  private queue: BroadcastEvent[] = [];
  private lastType: string | null = null;

  enqueue(event: BroadcastEvent): void {
    if (event.type === this.lastType && event.type === "auction.tick") return;
    this.lastType = event.type;
    this.queue.push(event);
    if (this.queue.length > MAX_QUEUE) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE);
    }
  }

  drain(): BroadcastEvent[] {
    const batch = this.queue;
    this.queue = [];
    return batch;
  }

  peek(): BroadcastEvent | undefined {
    return this.queue[0];
  }

  get size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.lastType = null;
  }
}
