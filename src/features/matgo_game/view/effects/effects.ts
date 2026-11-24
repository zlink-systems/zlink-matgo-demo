import { Container, FillGradient, Graphics, Sprite, Text, Texture, type Application, type TextStyleOptions } from 'pixi.js';
import gsap from 'gsap';

/** 파티클, 충격파, 화면 흔들림, 번쩍임, 큰 글씨 연출 */

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  max: number;
  gravity: number;
  drag: number;
  fade: boolean;
  startScale: number;
  endScale: number;
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!, size);
  return Texture.from(cv);
}

/** 움직임 줄이기 설정 (main 에서 바꾼다) */
export const fxPrefs = { calm: false };

export class Effects {
  readonly layer = new Container();
  readonly overlay = new Container();
  private particles: Particle[] = [];
  private tex: Record<string, Texture> = {};
  private shakeTween?: gsap.core.Tween;
  speed = 1;

  private shakeTarget: Container;

  constructor(app: Application, shakeTarget: Container) {
    this.shakeTarget = shakeTarget;
    this.layer.eventMode = 'none';
    this.overlay.eventMode = 'none';
    this.tex.soft = canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    this.tex.dust = canvasTex(48, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(240,230,200,0.9)');
      r.addColorStop(1, 'rgba(240,230,200,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    this.tex.spark = canvasTex(64, (g, s) => {
      const r = g.createLinearGradient(0, 0, s, 0);
      r.addColorStop(0, 'rgba(255,255,255,0)');
      r.addColorStop(0.7, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, s / 2 - 3, s, 6);
    });
    this.tex.star = canvasTex(64, (g, s) => {
      g.translate(s / 2, s / 2);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? s * 0.18 : s * 0.48;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = '#fff';
      g.fill();
    });
    this.tex.heart = canvasTex(64, (g, s) => {
      g.translate(s / 2, s / 2 + 4);
      g.beginPath();
      g.moveTo(0, s * 0.3);
      g.bezierCurveTo(-s * 0.5, -s * 0.05, -s * 0.25, -s * 0.45, 0, -s * 0.18);
      g.bezierCurveTo(s * 0.25, -s * 0.45, s * 0.5, -s * 0.05, 0, s * 0.3);
      g.fillStyle = '#fff';
      g.fill();
    });
    this.tex.leaf = canvasTex(48, (g, s) => {
      g.translate(s / 2, s / 2);
      g.beginPath();
      g.ellipse(0, 0, s * 0.45, s * 0.2, 0.4, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
    });
    this.tex.coin = canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s * 0.4, s * 0.35, 2, s / 2, s / 2, s / 2);
      r.addColorStop(0, '#fff7c2');
      r.addColorStop(0.5, '#f5c542');
      r.addColorStop(1, '#a86b00');
      g.fillStyle = r;
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#7a4d00';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#7a4d00';
      g.fillRect(s * 0.42, s * 0.42, s * 0.16, s * 0.16);
    });
    app.ticker.add((t) => this.update(t.deltaMS / 1000));
  }

  private update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) {
        p.s.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.vr * dt;
      const sc = p.startScale + (p.endScale - p.startScale) * k;
      p.s.scale.set(sc);
      if (p.fade) p.s.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  burst(
    x: number,
    y: number,
    o: {
      count: number;
      tex?: string;
      tint?: number | number[];
      speed?: [number, number];
      life?: [number, number];
      gravity?: number;
      drag?: number;
      scale?: [number, number];
      endScale?: number;
      angle?: [number, number];
      additive?: boolean;
      spin?: number;
      alignToVelocity?: boolean;
      spread?: number;
    },
  ) {
    const tex = this.tex[o.tex ?? 'soft'];
    for (let i = 0; i < o.count; i++) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      const tints = Array.isArray(o.tint) ? o.tint : [o.tint ?? 0xffffff];
      s.tint = tints[Math.floor(Math.random() * tints.length)];
      if (o.additive) s.blendMode = 'add';
      const [a0, a1] = o.angle ?? [0, Math.PI * 2];
      const ang = a0 + Math.random() * (a1 - a0);
      const [sp0, sp1] = o.speed ?? [100, 400];
      const sp = sp0 + Math.random() * (sp1 - sp0);
      const spread = o.spread ?? 0;
      s.x = x + (Math.random() - 0.5) * spread;
      s.y = y + (Math.random() - 0.5) * spread * 0.6;
      const [sc0, sc1] = o.scale ?? [0.4, 1];
      const startScale = sc0 + Math.random() * (sc1 - sc0);
      const vx = Math.cos(ang) * sp,
        vy = Math.sin(ang) * sp;
      if (o.alignToVelocity) s.rotation = ang;
      const [l0, l1] = o.life ?? [0.4, 0.9];
      this.layer.addChild(s);
      this.particles.push({
        s,
        vx,
        vy,
        vr: o.alignToVelocity ? 0 : (Math.random() - 0.5) * (o.spin ?? 4),
        life: 0,
        max: (l0 + Math.random() * (l1 - l0)) / this.speed,
        gravity: o.gravity ?? 0,
        drag: o.drag ?? 2,
        fade: true,
        startScale,
        endScale: startScale * (o.endScale ?? 0.3),
      });
    }
  }

  /** 패가 바닥에 꽂힐 때: 먼지 + 충격파 링 */
  impact(x: number, y: number, power: number) {
    this.burst(x, y + 50, {
      count: 8 + Math.round(power * 14),
      tex: 'dust',
      speed: [80, 260 + power * 200],
      angle: [Math.PI * 0.05, Math.PI * 0.95],
      life: [0.35, 0.7],
      scale: [0.6, 1.4],
      endScale: 1.6,
      drag: 5,
      spread: 80,
    });
    this.burst(x, y, {
      count: Math.round(power * 10),
      tex: 'spark',
      tint: [0xfff2b0, 0xffffff],
      speed: [400, 900],
      life: [0.15, 0.3],
      scale: [0.5, 1],
      alignToVelocity: true,
      additive: true,
      drag: 6,
    });
    this.ring(x, y, 0xfff4d0, 60 + power * 90, 0.35 + power * 0.3);
  }

  ring(x: number, y: number, color: number, radius: number, alpha = 0.6, width = 6) {
    const g = new Graphics().circle(0, 0, 50).stroke({ width, color, alpha: 1 });
    g.x = x;
    g.y = y;
    g.scale.set(0.2);
    g.alpha = alpha;
    g.blendMode = 'add';
    this.layer.addChild(g);
    const sc = radius / 50;
    gsap.to(g.scale, { x: sc, y: sc * 0.7, duration: 0.4 / this.speed, ease: 'expo.out' });
    gsap.to(g, { alpha: 0, duration: 0.4 / this.speed, ease: 'power2.in', onComplete: () => g.destroy() });
  }

  /** 흔들림: 특수 상황에서만 세게 */
  shake(intensity: number, duration = 0.25) {
    if (fxPrefs.calm) intensity *= 0.2;
    this.shakeTween?.kill();
    const t = this.shakeTarget;
    const base = { x: 0, y: 0 };
    const o = { k: 1 };
    this.shakeTween = gsap.to(o, {
      k: 0,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        t.x = base.x + (Math.random() - 0.5) * 2 * intensity * o.k;
        t.y = base.y + (Math.random() - 0.5) * 2 * intensity * o.k;
      },
      onComplete: () => {
        t.x = base.x;
        t.y = base.y;
      },
    });
  }

  flash(color = 0xffffff, alpha = 0.5, duration = 0.3) {
    if (fxPrefs.calm) alpha *= 0.3;
    const g = new Graphics().rect(0, 0, 1920, 1080).fill(color);
    g.alpha = alpha;
    g.blendMode = 'add';
    this.overlay.addChild(g);
    gsap.to(g, { alpha: 0, duration: duration / this.speed, ease: 'power2.out', onComplete: () => g.destroy() });
  }

  dim(alpha = 0.5, duration = 0.6) {
    const g = new Graphics().rect(0, 0, 1920, 1080).fill(0x000000);
    g.alpha = 0;
    this.overlay.addChildAt(g, 0);
    gsap
      .timeline({ onComplete: () => g.destroy() })
      .to(g, { alpha, duration: 0.1 })
      .to(g, { alpha: 0, duration: duration / this.speed, delay: 0.25 / this.speed });
  }

  /** 큰 글씨 도장: 크게 날아와 쾅 박히고 사라진다 */
  stamp(text: string, o: { x?: number; y?: number; fill: string[]; stroke?: string; size?: number; hold?: number; sub?: string }) {
    const style: TextStyleOptions = {
      fontFamily: '"Black Han Sans", "Noto Sans KR", sans-serif',
      fontSize: o.size ?? 170,
      fill:
        o.fill.length > 1
          ? new FillGradient({
              type: 'linear',
              start: { x: 0, y: 0 },
              end: { x: 0, y: 1 },
              textureSpace: 'local',
              colorStops: o.fill.map((color, i) => ({ offset: i / (o.fill.length - 1), color })),
            })
          : o.fill[0],
      stroke: { color: o.stroke ?? '#2a0a00', width: 14, join: 'round' },
      dropShadow: { color: '#000000', alpha: 0.6, blur: 10, distance: 8, angle: Math.PI / 2 },
      letterSpacing: 4,
    };
    const t = new Text({ text, style });
    t.anchor.set(0.5);
    const c = new Container();
    c.addChild(t);
    if (o.sub) {
      const sub = new Text({
        text: o.sub,
        style: { fontFamily: '"Black Han Sans", sans-serif', fontSize: 54, fill: '#fff6d8', stroke: { color: '#2a0a00', width: 8 } },
      });
      sub.anchor.set(0.5);
      sub.y = (o.size ?? 170) * 0.68;
      c.addChild(sub);
    }
    c.x = o.x ?? 960;
    c.y = o.y ?? 470;
    c.scale.set(3.2);
    c.alpha = 0;
    c.rotation = -0.12;
    this.overlay.addChild(c);
    const sp = this.speed;
    const tl = gsap.timeline({ onComplete: () => c.destroy({ children: true }) });
    tl.to(c, { alpha: 1, duration: 0.08 / sp })
      .to(c.scale, { x: 1, y: 1, duration: 0.22 / sp, ease: 'back.out(2.2)' }, 0)
      .to(c, { rotation: -0.04, duration: 0.22 / sp, ease: 'back.out(2)' }, 0)
      .add(() => {
        this.shake(10, 0.25);
        this.burst(c.x, c.y, {
          count: 26,
          tex: 'star',
          tint: [0xffe066, 0xffffff, 0xff9f43],
          speed: [300, 900],
          life: [0.4, 0.9],
          scale: [0.3, 0.8],
          additive: true,
          drag: 3,
        });
      }, 0.18 / sp)
      .to(c.scale, { x: 1.06, y: 1.06, duration: (o.hold ?? 0.7) / sp, ease: 'sine.inOut' })
      .to(c, { alpha: 0, y: c.y - 60, duration: 0.25 / sp, ease: 'power2.in' });
    return tl;
  }

  coins(x: number, y: number, count = 40) {
    this.burst(x, y, {
      count,
      tex: 'coin',
      speed: [400, 1100],
      angle: [-Math.PI * 0.9, -Math.PI * 0.1],
      gravity: 1600,
      drag: 0.5,
      life: [1.2, 2],
      scale: [0.5, 0.9],
      endScale: 1,
      spin: 10,
    });
  }

  hearts(x: number, y: number) {
    this.burst(x, y, {
      count: 24,
      tex: 'heart',
      tint: [0xff5c8a, 0xff9ab8, 0xff2d6b],
      speed: [200, 600],
      life: [0.6, 1.1],
      gravity: -200,
      scale: [0.4, 0.9],
      drag: 2,
    });
  }

  fire(x: number, y: number) {
    this.burst(x, y, {
      count: 60,
      tex: 'soft',
      tint: [0xffd24a, 0xff7a1a, 0xff3b1a, 0xffffff],
      speed: [300, 1300],
      life: [0.4, 1],
      scale: [1, 2.6],
      endScale: 0.2,
      additive: true,
      drag: 3,
    });
    this.burst(x, y, {
      count: 10,
      tex: 'dust',
      tint: [0x8a7a6a, 0xa09080],
      speed: [100, 400],
      life: [0.5, 1],
      scale: [1, 2],
      endScale: 1.6,
      gravity: -150,
      drag: 2,
    });
    this.ring(x, y, 0xffb347, 520, 0.9, 14);
    this.flash(0xffaa55, 0.55, 0.5);
  }

  lightning(x: number, y: number) {
    const g = new Graphics();
    let px = x + (Math.random() - 0.5) * 200,
      py = 0;
    g.moveTo(px, py);
    while (py < y) {
      px += (Math.random() - 0.5) * 90;
      py += 50 + Math.random() * 50;
      g.lineTo(px, Math.min(py, y));
    }
    g.stroke({ width: 8, color: 0xe8f4ff });
    g.blendMode = 'add';
    this.overlay.addChild(g);
    gsap.to(g, { alpha: 0, duration: 0.3 / this.speed, ease: 'power3.in', onComplete: () => g.destroy() });
    this.flash(0xcfe6ff, 0.45, 0.2);
  }

  wind(y: number) {
    this.burst(-40, y, {
      count: 40,
      tex: 'leaf',
      tint: [0xc9f2c7, 0xffffff, 0xffe9a8],
      speed: [1200, 2000],
      angle: [-0.25, 0.25],
      life: [0.8, 1.2],
      scale: [0.4, 1],
      drag: 0.6,
      spread: 400,
      spin: 12,
    });
  }

  /** 카드 위로 반짝임 */
  sparkleAt(x: number, y: number, tint = 0xffe680) {
    this.burst(x, y, {
      count: 14,
      tex: 'star',
      tint: [tint, 0xffffff],
      speed: [80, 260],
      life: [0.4, 0.8],
      scale: [0.2, 0.5],
      additive: true,
      drag: 3,
      spread: 60,
    });
  }
}
