import { generate } from "./engine";
import type { Layer } from "./types";
const cache = new Map<string, ReturnType<typeof generate>>();
self.onmessage = (e: MessageEvent<{ id: number; layers: Layer[] }>) => {
  try {
    const drawings = e.data.layers.map((l) => {
      const key = JSON.stringify([l.mode, l.seed, l.controls]);
      let d = cache.get(key);
      if (!d) {
        d = generate(l.mode, l.seed, l.controls);
        cache.set(key, d);
        if (cache.size > 24) cache.delete(cache.keys().next().value!);
      }
      return { id: l.id, drawing: d };
    });
    self.postMessage({ id: e.data.id, drawings });
  } catch (error) {
    self.postMessage({ id: e.data.id, error: String(error) });
  }
};
