import { Container, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { backTexture, faceTexture } from './textures';
import { CARD_H, CARD_W } from './painter';
import { cardOf } from '../../model/engine';

/** 화면 위 카드 기준 크기 (scale 1일 때) */
export const VIEW_W = 104;
export const VIEW_H = Math.round((VIEW_W * CARD_H) / CARD_W);

let shadowTex: Texture | null = null;
let glowTex: Texture | null = null;
const badgeTex = new Map<string, Texture>();

function shadowTexture() {
  if (shadowTex) return shadowTex;
  const pad = 30;
  const cv = document.createElement('canvas');
  cv.width = VIEW_W + pad * 2;
  cv.height = VIEW_H + pad * 2;
  const g = cv.getContext('2d')!;
  g.filter = 'blur(9px)';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.roundRect(pad, pad, VIEW_W, VIEW_H, 10);
  g.fill();
  shadowTex = Texture.from(cv);
  return shadowTex;
}

function glowTexture() {
  if (glowTex) return glowTex;
  const pad = 34;
  const cv = document.createElement('canvas');
  cv.width = VIEW_W + pad * 2;
  cv.height = VIEW_H + pad * 2;
  const g = cv.getContext('2d')!;
  g.shadowColor = 'rgba(255,230,90,1)';
  g.shadowBlur = 26;
  g.strokeStyle = 'rgba(255,240,150,1)';
  g.lineWidth = 7;
  g.beginPath();
  g.roundRect(pad, pad, VIEW_W, VIEW_H, 10);
  g.stroke();
  g.stroke();
  glowTex = Texture.from(cv);
  return glowTex;
}

/** 왼쪽 위 월 표시와 쌍피 표시 (중장년 이용자 식별 보조) */
function badgeTexture(id: string): Texture | null {
  const c = cardOf(id);
  if (!c || c.bonus) return null;
  const key = `${c.month}-${c.piValue}`;
  const hit = badgeTex.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 120;
  cv.height = 60;
  const g = cv.getContext('2d')!;
  g.fillStyle = 'rgba(20,10,5,0.82)';
  g.beginPath();
  g.roundRect(2, 2, 54, 44, 12);
  g.fill();
  g.fillStyle = '#ffe9a8';
  g.font = 'bold 34px "Black Han Sans", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(c.month), 29, 26);
  if (c.piValue >= 2) {
    g.fillStyle = '#c8102e';
    g.beginPath();
    g.roundRect(60, 2, 56, 44, 12);
    g.fill();
    g.fillStyle = '#fff';
    g.font = 'bold 26px "Black Han Sans", sans-serif';
    g.fillText('쌍피', 88, 25);
  }
  const t = Texture.from(cv);
  badgeTex.set(key, t);
  return t;
}

export let showMonthBadge = true;
export function setShowMonthBadge(v: boolean) {
  showMonthBadge = v;
}

export class CardView extends Container {
  readonly id: string;
  private flipper = new Container();
  private face: Sprite;
  private back: Sprite;
  private shadow: Sprite;
  private glow: Sprite;
  private badge: Sprite | null = null;
  private glowTween?: gsap.core.Tween;
  faceUp = false;
  /** 그림자 높이 (들어 올린 정도) 0~1 */
  private _lift = 0;

  constructor(id: string) {
    super();
    this.id = id;
    this.shadow = new Sprite(shadowTexture());
    this.shadow.anchor.set(0.5);
    this.shadow.alpha = 0.8;
    this.glow = new Sprite(glowTexture());
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.visible = false;
    const isDummy = id.startsWith('dummy');
    // 가린 카드(상대 손패·더미)는 앞면이 없다
    const isHidden = id.startsWith('hidden-');
    this.face = new Sprite(isDummy || isHidden ? backTexture() : faceTexture(id));
    this.face.anchor.set(0.5);
    this.face.width = VIEW_W;
    this.face.height = VIEW_H;
    this.back = new Sprite(backTexture());
    this.back.anchor.set(0.5);
    this.back.width = VIEW_W;
    this.back.height = VIEW_H;
    if (isDummy) this.face.tint = 0x9a9a9a;
    const bt = isDummy || isHidden ? null : badgeTexture(id);
    if (bt) {
      this.badge = new Sprite(bt);
      this.badge.scale.set(0.42);
      this.badge.x = -VIEW_W / 2 + 4;
      this.badge.y = -VIEW_H / 2 + 4;
    }
    this.flipper.addChild(this.face, this.back);
    if (this.badge) this.flipper.addChild(this.badge);
    this.addChild(this.shadow, this.glow, this.flipper);
    this.setFaceUp(false);
    this.lift = 0;
  }

  get lift() {
    return this._lift;
  }
  set lift(v: number) {
    this._lift = v;
    this.shadow.x = 4 + v * 14;
    this.shadow.y = 6 + v * 26;
    this.shadow.scale.set(1 + v * 0.08);
    this.shadow.alpha = 0.75 - v * 0.35;
  }

  setFaceUp(up: boolean) {
    this.faceUp = up;
    this.face.visible = up;
    this.back.visible = !up;
    if (this.badge) this.badge.visible = up && showMonthBadge;
  }

  /** 뒤집기: 가로로 접혔다 펴진다 */
  flipTo(up: boolean, duration = 0.18): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(this.flipper.scale, { x: 0, duration: duration / 2, ease: 'power2.in' })
      .add(() => this.setFaceUp(up))
      .to(this.flipper.scale, { x: 1, duration: duration / 2, ease: 'power2.out' });
    return tl;
  }

  setGlow(on: boolean, color = 0xffe066) {
    this.glowTween?.kill();
    this.glow.visible = on;
    this.glow.tint = color;
    if (on) {
      this.glow.alpha = 0.6;
      this.glowTween = gsap.to(this.glow, { alpha: 1, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
  }

  setDim(on: boolean) {
    this.face.tint = on ? 0x777777 : this.id.startsWith('dummy') ? 0x9a9a9a : 0xffffff;
  }

  /** 바닥에 닿는 순간 찌그러졌다 돌아오기 */
  squash(power = 1) {
    const f = this.flipper;
    gsap.killTweensOf(f.scale, 'y');
    gsap.fromTo(f.scale, { y: 1 - 0.1 * power }, { y: 1, duration: 0.22, ease: 'elastic.out(1.2, 0.4)' });
  }
}
