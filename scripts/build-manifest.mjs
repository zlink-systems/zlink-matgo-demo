// public/cards 의 생성 그림을 정리하고 manifest.json 을 만든다.
// 월별 피 그림(<mm>-pi.webp)은 pi1, pi2 두 장으로 복사한다 (실제 화투도 두 장 그림이 같다).
import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'public', 'cards');
for (let m = 1; m <= 12; m++) {
  const mm = String(m).padStart(2, '0');
  const src = join(dir, `${mm}-pi.webp`);
  if (!existsSync(src)) continue;
  for (const n of ['pi1', 'pi2']) {
    const dst = join(dir, `${mm}-${n}.webp`);
    if (!existsSync(dst)) copyFileSync(src, dst);
  }
}
const ids = readdirSync(dir)
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.replace(/\.webp$/, ''))
  .filter((id) => !/^\d\d-pi$/.test(id))
  .sort();
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(ids, null, 0));
console.log(`manifest: ${ids.length} images`);
