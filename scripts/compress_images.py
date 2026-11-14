"""压缩 v1/v2/v3 的图片，便于手机加载（需要 Pillow，在装了 Pillow 的机器上运行）。

规则：首屏图 hero*.jpg 长边不超过 1920 像素，其余不超过 1280 像素；JPEG 质量 80、渐进式；
只有压缩后更小才替换原文件。用法（在仓库根目录）：python3 scripts/compress_images.py
"""
import io
import logging
from pathlib import Path

from PIL import Image, ImageOps

log = logging.getLogger("compress_images")
ROOT = Path(__file__).resolve().parent.parent
QUALITY = 80


def compress(path: Path) -> tuple[int, int]:
    limit = 1920 if path.name.startswith("hero") else 1280
    before = path.stat().st_size
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((limit, limit), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    data = buf.getvalue()
    if len(data) < before:
        path.write_bytes(data)
        return before, len(data)
    return before, before


def main() -> None:
    total_before = total_after = 0
    for path in sorted(ROOT.glob("v*/img/*.jpg")):
        b, a = compress(path)
        total_before, total_after = total_before + b, total_after + a
    log.info("图片合计 %.1f MB -> %.1f MB", total_before / 1e6, total_after / 1e6)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
