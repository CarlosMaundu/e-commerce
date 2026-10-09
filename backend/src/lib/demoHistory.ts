// src/lib/demoHistory.ts — believable stage times for demo orders, so the SLA
// report has something to show: most stages finish well inside their
// targets, some run late. Only ever used for demo shoppers' orders.
const HOUR = 3600000;
const between = (a: number, b: number) => a + Math.random() * (b - a);
/** Mostly quick, sometimes slow, occasionally very slow. */
const spread = (fast: [number, number], slow: [number, number], late: [number, number]) => {
  const r = Math.random();
  return (r < 0.72 ? between(...fast) : r < 0.9 ? between(...slow) : between(...late)) * HOUR;
};

const PATH: Record<string, string[]> = {
  pending: [],
  processing: ['processing'],
  shipped: ['processing', 'shipped'],
  delivered: ['processing', 'shipped', 'delivered'],
  refunded: ['processing', 'shipped', 'delivered', 'refunded'],
  cancelled: ['cancelled'],
};

/** The status changes after placement, each with its time (never in the future). */
export const demoStageChain = (status: string, placedAt: Date, shippingMethod: string, now = Date.now()) => {
  const steps = PATH[status] || [];
  const durations = steps.map((s) => {
    if (s === 'processing') return spread([1, 18], [18, 30], [30, 60]);
    if (s === 'shipped') return spread([6, 36], [36, 52], [52, 96]);
    if (s === 'delivered') {
      return shippingMethod === 'express' ? spread([6, 30], [30, 44], [44, 80]) : spread([20, 70], [70, 90], [90, 150]);
    }
    if (s === 'refunded') return between(48, 240) * HOUR;
    return between(2, 30) * HOUR; // cancelled
  });
  // Squeeze into the time since placement if needed (recent orders).
  const room = now - placedAt.getTime() - 5 * 60000;
  const sum = durations.reduce((a, b) => a + b, 0);
  const scale = sum > room && sum > 0 ? Math.max(room, 0) / sum : 1;
  let t = placedAt.getTime();
  return steps.map((s, i) => {
    t += durations[i] * scale;
    return { status: s, at: new Date(t) };
  });
};
