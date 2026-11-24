"""assets/cards/originals/*.png -> public/cards/*.webp (512x820). 게임은 256x410으로 그리므로 2배 해상도면 충분하다."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src, dst = root / 'assets/cards/originals', root / 'public/cards'
dst.mkdir(parents=True, exist_ok=True)
for f in sorted(src.glob('*.png')):
    im = Image.open(f).convert('RGB').resize((512, 820), Image.LANCZOS)
    im.save(dst / (f.stem + '.webp'), 'WEBP', quality=88, method=6)
print('converted', len(list(src.glob('*.png'))))
