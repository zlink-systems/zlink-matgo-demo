/**
 * Web Audio로 효과음을 합성한다. 외부 음원 파일 없이 동작.
 * 타격음 = 고음 어택(딱) + 저음 몸통(쿵) + 쓸림 노이즈. 매번 피치를 ±4% 흔들어 귀 피로를 줄인다.
 */

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let comp: DynamicsCompressorNode;
let noiseBuf: AudioBuffer;

export const audioSettings = { sfx: true, music: true, voice: true, volume: 0.8 };

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = audioSettings.volume;
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.22;
  sfxBus.connect(comp);
  musicBus.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function audioContext() {
  return ctx;
}
export function musicOut() {
  return musicBus;
}
export function setVolume(v: number) {
  audioSettings.volume = v;
  if (ctx) master.gain.value = v;
}

const jitter = (amt = 0.04) => 1 + (Math.random() * 2 - 1) * amt;

function noise(
  t: number,
  dur: number,
  opts: { type?: BiquadFilterType; freq: number; freqEnd?: number; q?: number; gain: number; attack?: number },
) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = jitter(0.1);
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  const a = opts.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

function tone(
  t: number,
  dur: number,
  opts: { type?: OscillatorType; freq: number; freqEnd?: number; gain: number; attack?: number; dest?: AudioNode },
) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
  const g = ctx.createGain();
  const a = opts.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(opts.dest ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const now = () => (ctx ? ctx.currentTime : 0);
const on = () => !!ctx && audioSettings.sfx;

/** 패를 바닥에 내리치는 소리. power 0~1 (먹을 때 더 세게) */
export function slam(power = 0.6) {
  if (!on()) return;
  const t = now();
  const p = jitter();
  // 어택: 플라스틱 "딱"
  noise(t, 0.045, { type: 'highpass', freq: 2600 * p, gain: 0.55 + power * 0.35 });
  noise(t, 0.03, { type: 'bandpass', freq: 4200 * p, q: 3, gain: 0.35 });
  // 몸통: 모포 위 "쿵"
  tone(t, 0.16 + power * 0.08, { freq: 170 * p, freqEnd: 55, gain: 0.55 + power * 0.45 });
  tone(t, 0.06, { type: 'triangle', freq: 420 * p, freqEnd: 180, gain: 0.25 });
  // 모포 쓸림
  noise(t + 0.01, 0.12, { type: 'lowpass', freq: 900, gain: 0.18 + power * 0.2 });
}

/** 패를 들어 올릴 때 */
export function lift() {
  if (!on()) return;
  const t = now();
  noise(t, 0.08, { type: 'bandpass', freq: 1800, freqEnd: 3200, q: 1.5, gain: 0.12, attack: 0.02 });
}

/** 패가 공기를 가르는 소리 */
export function swish(dur = 0.14) {
  if (!on()) return;
  const t = now();
  noise(t, dur, { type: 'bandpass', freq: 900, freqEnd: 3500, q: 0.8, gain: 0.16, attack: dur * 0.6 });
}

/** 더미 뒤집기 */
export function flip() {
  if (!on()) return;
  const t = now();
  noise(t, 0.07, { type: 'bandpass', freq: 3000 * jitter(), q: 2, gain: 0.22 });
  tone(t + 0.05, 0.05, { type: 'triangle', freq: 900 * jitter(), freqEnd: 600, gain: 0.12 });
}

/** 먹은 패를 쓸어 담는 소리 */
export function sweepIn(count = 2) {
  if (!on()) return;
  const t = now();
  noise(t, 0.22, { type: 'bandpass', freq: 600, freqEnd: 2400, q: 0.9, gain: 0.2, attack: 0.08 });
  for (let i = 0; i < Math.min(count, 5); i++) {
    noise(t + 0.12 + i * 0.035, 0.03, { type: 'highpass', freq: 3000, gain: 0.18 });
  }
}

/** 손패에 마우스 올림 */
export function hover() {
  if (!on()) return;
  tone(now(), 0.05, { type: 'triangle', freq: 1300 * jitter(0.02), gain: 0.05 });
}

/** 카드 나눠주기 */
export function deal() {
  if (!on()) return;
  const t = now();
  noise(t, 0.05, { type: 'bandpass', freq: 2500 * jitter(), q: 1.2, gain: 0.12 });
}

export function click() {
  if (!on()) return;
  tone(now(), 0.06, { type: 'square', freq: 880, freqEnd: 660, gain: 0.06 });
}

/** 점수 오를 때 */
export function scoreUp(level = 0) {
  if (!on()) return;
  const t = now();
  const base = 660 * 2 ** (level / 12);
  tone(t, 0.12, { type: 'triangle', freq: base, gain: 0.15 });
  tone(t + 0.07, 0.18, { type: 'triangle', freq: base * 1.5, gain: 0.13 });
}

function arpeggio(t: number, notes: number[], step: number, type: OscillatorType = 'triangle', gain = 0.16, len = 0.3) {
  notes.forEach((f, i) => tone(t + i * step, len, { type, freq: f, gain }));
}

/** 놋쇠 같은 화음 (고, 승리) */
function brass(t: number, freqs: number[], dur: number, gain = 0.09) {
  if (!ctx) return;
  for (const f of freqs) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.linearRampToValueAtTime(3200, t + 0.08);
      lp.frequency.exponentialRampToValueAtTime(900, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
      g.gain.setValueAtTime(gain, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

/** 징 */
function gong(t: number, base = 110, gain = 0.3, dur = 2.2) {
  [1, 1.48, 2.02, 2.74, 3.3].forEach((r, i) =>
    tone(t, dur * (1 - i * 0.12), { freq: base * r, freqEnd: base * r * 0.985, gain: gain / (i + 1), attack: 0.01 }),
  );
  noise(t, 0.08, { type: 'lowpass', freq: 800, gain: 0.3 });
}

/** 북 */
function drum(t: number, gain = 0.7) {
  tone(t, 0.35, { freq: 120, freqEnd: 45, gain });
  noise(t, 0.06, { type: 'lowpass', freq: 1200, gain: gain * 0.4 });
}

export type SpecialSound =
  | 'jjok'
  | 'ppeok'
  | 'ttadak'
  | 'sweep'
  | 'bomb'
  | 'shake'
  | 'ppeokEat'
  | 'steal'
  | 'go'
  | 'stop'
  | 'win'
  | 'lose'
  | 'combo'
  | 'gwang'
  | 'nagari'
  | 'coin'
  | 'stamp'
  | 'start';

export function special(kind: SpecialSound, level = 1) {
  if (!on()) return;
  const t = now();
  switch (kind) {
    case 'jjok':
      // 뽀뽀 "쪽" + 실로폰
      tone(t, 0.09, { freq: 500, freqEnd: 1800, gain: 0.3 });
      noise(t + 0.06, 0.03, { type: 'highpass', freq: 3000, gain: 0.3 });
      arpeggio(t + 0.12, [1047, 1319, 1568, 2093], 0.06, 'sine', 0.14, 0.4);
      break;
    case 'ppeok':
      // 둔탁한 쿵 + 불길한 징
      tone(t, 0.5, { freq: 90, freqEnd: 35, gain: 0.9 });
      noise(t, 0.25, { type: 'lowpass', freq: 500, gain: 0.5 });
      gong(t + 0.05, 92, 0.22, 1.6);
      break;
    case 'ttadak':
      slam(1);
      setTimeout(() => slam(1), 110);
      arpeggio(t + 0.25, [784, 1175], 0.08, 'square', 0.07, 0.2);
      break;
    case 'sweep':
      // 바람 + 뽀득
      noise(t, 0.9, { type: 'bandpass', freq: 300, freqEnd: 4000, q: 0.6, gain: 0.35, attack: 0.3 });
      arpeggio(t + 0.4, [1568, 1976, 2349, 3136], 0.05, 'sine', 0.1, 0.35);
      break;
    case 'bomb':
      tone(t, 0.9, { freq: 80, freqEnd: 25, gain: 1 });
      noise(t, 1.2, { type: 'lowpass', freq: 2200, freqEnd: 120, gain: 0.9, attack: 0.005 });
      noise(t, 0.15, { type: 'highpass', freq: 1500, gain: 0.5 });
      break;
    case 'shake':
      for (let i = 0; i < 8; i++) noise(t + i * 0.045, 0.04, { type: 'bandpass', freq: 2400 + (i % 2) * 600, q: 2, gain: 0.2 });
      break;
    case 'ppeokEat':
      arpeggio(t, [523, 659, 784, 1047], 0.07, 'triangle', 0.16, 0.35);
      noise(t, 0.4, { type: 'highpass', freq: 5000, gain: 0.12, attack: 0.1 });
      break;
    case 'steal':
      tone(t, 0.18, { type: 'triangle', freq: 600, freqEnd: 1400, gain: 0.14 });
      noise(t + 0.15, 0.04, { type: 'highpass', freq: 3500, gain: 0.15 });
      break;
    case 'go': {
      // 고 횟수가 늘수록 높고 커진다
      const up = 2 ** (((level - 1) * 2) / 12);
      drum(t, 0.8);
      drum(t + 0.12, 0.6);
      brass(t + 0.15, [262 * up, 330 * up, 392 * up], 0.25);
      brass(t + 0.42, [349 * up, 440 * up, 523 * up], 0.6, 0.1 + level * 0.01);
      if (level >= 3) gong(t + 0.42, 130, 0.25, 2);
      break;
    }
    case 'stop':
      tone(t, 0.6, { freq: 70, freqEnd: 30, gain: 1 });
      noise(t, 0.12, { type: 'bandpass', freq: 1800, q: 1, gain: 0.7 });
      gong(t + 0.02, 150, 0.2, 1.2);
      break;
    case 'win':
      drum(t, 0.7);
      brass(t, [392, 494, 587], 0.22);
      brass(t + 0.24, [392, 494, 587], 0.12);
      brass(t + 0.38, [523, 659, 784], 1.2, 0.11);
      arpeggio(t + 0.4, [1568, 2093, 2637, 3136], 0.07, 'sine', 0.07, 0.6);
      break;
    case 'lose':
      arpeggio(t, [440, 415, 392, 330], 0.22, 'triangle', 0.14, 0.4);
      break;
    case 'combo':
      arpeggio(t, [784, 988, 1175, 1568], 0.05, 'square', 0.06, 0.25);
      brass(t + 0.2, [523, 659, 784], 0.5, 0.07);
      break;
    case 'gwang':
      arpeggio(t, [1047, 1568, 2093], 0.06, 'sine', 0.12, 0.8);
      gong(t, 260, 0.1, 1.2);
      break;
    case 'nagari':
      arpeggio(t, [392, 330, 262], 0.18, 'sine', 0.14, 0.5);
      break;
    case 'coin':
      tone(t, 0.08, { type: 'square', freq: 1976 * jitter(0.03), gain: 0.05 });
      tone(t + 0.06, 0.25, { type: 'square', freq: 2637 * jitter(0.03), gain: 0.05 });
      break;
    case 'stamp':
      tone(t, 0.25, { freq: 110, freqEnd: 40, gain: 0.9 });
      noise(t, 0.08, { type: 'lowpass', freq: 2500, gain: 0.6 });
      break;
    case 'start':
      drum(t, 0.6);
      drum(t + 0.18, 0.6);
      drum(t + 0.3, 0.8);
      arpeggio(t + 0.3, [587, 659, 784, 880, 1175], 0.06, 'triangle', 0.1, 0.3);
      break;
  }
}

/** 모바일 진동 */
export function haptic(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 지원 안 함 */
  }
}
