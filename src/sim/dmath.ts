/**
 * Deterministic math for the simulation.
 *
 * Online PvP runs the same fight on two machines from the same seed, so every number must come
 * out bit-identical in Chrome, Safari and Firefox. JavaScript only guarantees that for + − × ÷
 * and sqrt (IEEE 754, correctly rounded); Math.sin/cos/atan2/exp/hypot are "implementation-
 * approximated" and do differ in the last bits between engines, which a bouncing physics sim
 * amplifies into a different fight. These versions use only the exact operations.
 * Accuracy ~1e-12, far beyond what gameplay needs.
 */
const PI = Math.PI;
const TAU = 2 * PI;
const HALF_PI = PI / 2;

/** x reduced to [-π, π] */
function wrap(x: number) {
  return x - TAU * Math.round(x / TAU);
}

/** sin on [-π/2, π/2] by Taylor series (deg 19) */
function sinCore(x: number) {
  const x2 = x * x;
  let term = x, sum = x;
  for (let n = 1; n <= 9; n++) {
    term *= -x2 / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return sum;
}

export function dsin(x: number) {
  if (!Number.isFinite(x)) return NaN;
  let r = wrap(x);
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  return sinCore(r);
}

export function dcos(x: number) {
  return dsin(x + HALF_PI);
}

/** atan on [0, 1] via argument halving + series */
function atanCore(x: number) {
  // atan(x) = 2·atan(x / (1 + sqrt(1 + x²))): two halvings bring x below ~0.2
  let k = 1;
  for (let i = 0; i < 2; i++) {
    x = x / (1 + Math.sqrt(1 + x * x));
    k *= 2;
  }
  const x2 = x * x;
  let term = x, sum = x;
  for (let n = 1; n <= 12; n++) {
    term *= -x2;
    sum += term / (2 * n + 1);
  }
  return k * sum;
}

export function datan2(y: number, x: number) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  let a = ax >= ay ? atanCore(ay / ax) : HALF_PI - atanCore(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export function dexp(x: number) {
  // e^x = (e^(x/2^k))^(2^k) with a short series on the small part
  const k = 8;
  const r = x / 256;
  let term = 1, sum = 1;
  for (let n = 1; n <= 12; n++) {
    term *= r / n;
    sum += term;
  }
  for (let i = 0; i < k; i++) sum *= sum;
  return sum;
}

export function dhypot(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}
