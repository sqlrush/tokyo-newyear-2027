"""把 ../0X-* 三份攻略同步成可发布的静态站点（v1/、v2/、v3/），并改写版本之间的链接。

用法（在仓库根目录）：python3 scripts/sync_site.py
只复制网页需要的文件：index.html、styles.css、app.js、data.js、img/。
"""
import logging
import shutil
from pathlib import Path

log = logging.getLogger("sync_site")

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT.parent
VERSIONS = {
    "v1": "05-东京新年攻略",
    "v2": "06-东京小众轻奢",
    "v3": "07-东京奢华",
}
FILES = ("index.html", "styles.css", "app.js", "data.js")
LINK_REWRITES = {f"../{src}/index.html": f"../{dest}/" for dest, src in VERSIONS.items()}


def sync_one(dest: str, src_name: str) -> None:
    src = PROJECT / src_name
    out = ROOT / dest
    if not (src / "index.html").exists():
        raise FileNotFoundError(f"找不到 {src / 'index.html'}")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in FILES:
        shutil.copy2(src / name, out / name)
    shutil.copytree(src / "img", out / "img")
    html_path = out / "index.html"
    html = html_path.read_text(encoding="utf-8")
    for old, new in LINK_REWRITES.items():
        html = html.replace(old, new)
    html_path.write_text(html, encoding="utf-8")
    leftovers = [k for k in LINK_REWRITES if k in html]
    if leftovers:
        raise RuntimeError(f"{dest} 里还有没改写的链接：{leftovers}")
    log.info("同步 %s <- %s（%d 张图片）", dest, src_name, len(list((out / "img").glob("*"))))


def main() -> None:
    for dest, src_name in VERSIONS.items():
        sync_one(dest, src_name)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
