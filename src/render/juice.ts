/** Global game-feel state: hit-stop, trauma shake, zoom punch, slow-mo. Render-only. */
export class Juice {
  enabled = true;
  reduceShake = false;
  trauma = 0;
  punch = 0;
  hitstop = 0;
  slowmoT = 0;
  slowmoScale = 1;
  shakeX = 0;
  shakeY = 0;
  shakeRot = 0;
  private t = 0;

  addTrauma(v: number) {
    if (!this.enabled) return;
    this.trauma = Math.min(1, this.trauma + v);
  }
  addPunch(v: number) {
    if (!this.enabled) return;
    this.punch = Math.max(this.punch, v);
  }
  addHitstop(sec: number) {
    if (!this.enabled) return;
    this.hitstop = Math.max(this.hitstop, sec);
  }
  slowmo(scale: number, sec: number) {
    if (!this.enabled) return;
    this.slowmoScale = scale;
    this.slowmoT = sec;
  }

  get timeScale() {
    return this.slowmoT > 0 ? this.slowmoScale : 1;
  }

  update(dt: number) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - 1.5 * dt);
    this.punch = Math.max(0, this.punch - 0.25 * dt * 4);
    if (this.slowmoT > 0) this.slowmoT -= dt;
    const amt = this.trauma * this.trauma * (this.reduceShake ? 0.35 : 1);
    const n = (f: number, o: number) => Math.sin(this.t * f + o) * 0.6 + Math.sin(this.t * f * 2.3 + o * 1.7) * 0.4;
    this.shakeX = amt * 16 * n(37, 0);
    this.shakeY = amt * 16 * n(41, 2.1);
    this.shakeRot = amt * 0.026 * n(29, 4.2);
  }
}
