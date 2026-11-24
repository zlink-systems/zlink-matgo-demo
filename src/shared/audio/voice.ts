import { audioSettings } from './sfx';

/** 브라우저 음성 합성(ko-KR)으로 짧은 외침을 낸다. 한국어 음성이 없는 브라우저에서는 조용히 넘어간다. */

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ko'));
  // 자연스러운 온라인 음성을 우선
  voice = voices.find((v) => /natural|online|neural/i.test(v.name)) ?? voices[0] ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function say(text: string, opts: { pitch?: number; rate?: number } = {}) {
  if (!audioSettings.voice || !voice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = opts.rate ?? 1.25;
    u.pitch = opts.pitch ?? 1.1;
    u.volume = audioSettings.volume;
    speechSynthesis.speak(u);
  } catch {
    /* 무시 */
  }
}

const LINES: Record<string, string[]> = {
  jjok: ['쪽!', '쪽~ 이게 웬 떡이야'],
  ppeok: ['뻑!', '아이고, 뻑이네'],
  firstPpeok: ['첫뻑!'],
  ttadak: ['따닥!'],
  sweep: ['싹쓸이!', '싹 쓸었다!'],
  bomb: ['폭탄!', '폭탄 받아라!'],
  shake: ['흔들고!'],
  ppeokEat: ['뻑 먹었다!'],
  jappeok: ['자뻑!'],
  godori: ['고도리!'],
  hongdan: ['홍단!'],
  cheongdan: ['청단!'],
  chodan: ['초단!'],
  samgwang: ['삼광!'],
  sagwang: ['사광!'],
  ogwang: ['오광!'],
  chongtong: ['총통!'],
  samppeok: ['삼뻑!'],
  go1: ['원 고!'],
  go2: ['투 고!'],
  go3: ['쓰리 고!'],
  go4: ['포 고!'],
  go5: ['파이브 고!'],
  stop: ['스톱!', '여기서 스톱!'],
  pibak: ['피박!'],
  gwangbak: ['광박!'],
  nagari: ['나가리!'],
};

export function shout(key: string) {
  const lines = LINES[key];
  if (!lines) return;
  say(lines[Math.floor(Math.random() * lines.length)], { pitch: key === 'ppeok' ? 0.8 : 1.15 });
}
