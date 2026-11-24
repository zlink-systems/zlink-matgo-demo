import type { Difficulty } from '../features/matgo_game/model/types';

export interface Settings {
  difficulty: Difficulty;
  speed: number;
  sfx: boolean;
  music: boolean;
  voice: boolean;
  monthBadge: boolean;
  /** 화면 흔들림·번쩍임 줄이기 */
  calmFx: boolean;
}

const KEY = 'motgo.settings.v1';

function load(): Settings {
  const d: Settings = { difficulty: 'normal', speed: 1, sfx: true, music: true, voice: true, monthBadge: true, calmFx: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* 저장소 없음 */
  }
  return d;
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
}
