"""Optional one-time media conversion; dependencies are in requirements-tools.txt."""

from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
imgdir = root / "assets/img"
for source, prefix, widths, quality in [
    ("candle-editorial.png", "candle", [480, 960, 1536], 80),
    ("loomos-maker.png", "maker", [480, 960, 1536], 80),
    ("loomos-logo-preview.png", "logo", [96, 192], 88),
]:
    im = Image.open(imgdir / source).convert("RGB")
    for width in widths:
        resized = im.copy()
        resized.thumbnail(
            (width, round(width * im.height / im.width)), Image.Resampling.LANCZOS
        )
        resized.save(
            imgdir / f"{prefix}-{width}.webp", "WEBP", quality=quality, method=6
        )
logo = Image.open(imgdir / "loomos-logo-preview.png").convert("RGB")
for size in [32, 48, 180, 192, 512]:
    logo.resize((size, size), Image.Resampling.LANCZOS).save(
        imgdir / f"favicon-{size}.png", optimize=True
    )
logo.resize((48, 48), Image.Resampling.LANCZOS).save(
    imgdir / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)
for name in ["cormorant-garamond", "cormorant-garamond-italic", "dm-sans", "lora"]:
    font = TTFont(root / f"assets/fonts/{name}.ttf")
    font.flavor = "woff2"
    font.save(root / f"assets/fonts/{name}.woff2")
print("Hero PNG bytes:", (imgdir / "candle-editorial.png").stat().st_size)
print("Hero WebP bytes:", (imgdir / "candle-1536.webp").stat().st_size)
print("Card WebP bytes:", (imgdir / "candle-480.webp").stat().st_size)
