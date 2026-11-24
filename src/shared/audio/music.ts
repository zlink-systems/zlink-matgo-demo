import { audioContext, audioSettings, musicOut } from './sfx';

/**
 * 국악풍 배경 음악을 실시간 합성한다.
 * 가야금 비슷한 뜯는 소리(5음계, 농현 떨림) + 장구 장단(세마치 느낌). 효과음 대역을 비우려고 부드럽게.
 */

// 평조 5음계 (D 기준)
const SCALE = [146.8, 164.8, 196.0, 220.0, 246.9, 293.7, 329.6, 392.0, 440.0, 493.9, 587.3];
const BPM = 96;
const STEP = 60 / BPM / 2; // 8분음표

let timer: number | null = null;
let nextTime = 0;
let step = 0;
let phrase: number[] = [];

function pluck(t: number, freq: number, gain: number) {
  const ctx = audioContext();
  if (!ctx) return;
  const out = musicOut();
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'triangle';
  o2.type = 'sine';
  o1.frequency.setValueAtTime(freq, t);
  o2.frequency.setValueAtTime(freq * 2.01, t);
  // 농현: 뜯은 뒤 살짝 밀어 올렸다 내림
  if (Math.random() < 0.35) {
    o1.frequency.setValueAtTime(freq, t + 0.12);
    o1.frequency.linearRampToValueAtTime(freq * 1.04, t + 0.3);
    o1.frequency.linearRampToValueAtTime(freq, t + 0.5);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3500, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  const g2 = ctx.createGain();
  g2.gain.value = 0.3;
  o1.connect(lp);
  o2.connect(g2).connect(lp);
  lp.connect(g).connect(out);
  o1.start(t);
  o2.start(t);
  o1.stop(t + 1.2);
  o2.stop(t + 1.2);
}

function janggu(t: number, kind: 'deong' | 'kung' | 'deok' | 'gi') {
  const ctx = audioContext();
  if (!ctx) return;
  const out = musicOut();
  if (kind === 'deong' || kind === 'kung') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(kind === 'deong' ? 150 : 110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.35);
  }
  if (kind !== 'kung') {
    // 채편: 딱 하는 고음
    const len = 0.06;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'gi' ? 2200 : 1500;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = kind === 'gi' ? 0.25 : 0.4;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
  }
}

// 세마치 장단 비슷한 9박 패턴 (8분음표 단위 12칸)
const RHYTHM: (Parameters<typeof janggu>[1] | null)[] = [
  'deong',
  null,
  'gi',
  'deok',
  null,
  'kung',
  'deok',
  null,
  'gi',
  'kung',
  null,
  'deok',
];

function newPhrase() {
  // 앞뒤가 이어지게 걸음걸이로 가락을 만든다
  let idx = 3 + Math.floor(Math.random() * 4);
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (i % 3 === 1 && Math.random() < 0.5) {
      out.push(-1);
      continue;
    }
    idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
    out.push(idx);
  }
  out[11] = Math.random() < 0.5 ? 3 : 5; // 마무리 음
  return out;
}

function schedule() {
  const ctx = audioContext();
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.25) {
    const s = step % 12;
    if (s === 0) phrase = newPhrase();
    const note = phrase[s];
    if (note >= 0) pluck(nextTime, SCALE[note], 0.22);
    // 저음 받침
    if (s === 0) pluck(nextTime, SCALE[Math.random() < 0.5 ? 0 : 2] / 2, 0.2);
    const j = RHYTHM[s];
    if (j) janggu(nextTime, j);
    nextTime += STEP;
    step++;
  }
}

export function startMusic() {
  const ctx = audioContext();
  if (!ctx || timer !== null || !audioSettings.music) return;
  nextTime = ctx.currentTime + 0.1;
  step = 0;
  timer = window.setInterval(schedule, 60);
}

export function stopMusic() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function setMusic(onOff: boolean) {
  audioSettings.music = onOff;
  if (onOff) startMusic();
  else stopMusic();
}
