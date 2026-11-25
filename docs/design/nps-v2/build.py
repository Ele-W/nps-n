"""把原型片段导出为离线网页，仅使用 Python 标准库。"""

from pathlib import Path


def main() -> None:
    # 以脚本目录为基准，避免调用者从其他工作目录运行时读错文件。
    root = Path(__file__).resolve().parent
    template = (root / "template.html").read_text(encoding="utf-8")
    fragment = (root / "prototype.fragment.html").read_text(encoding="utf-8")
    marker = "<!-- NPS_V2_FRAGMENT -->"
    if template.count(marker) != 1:
        raise ValueError("导出模板必须包含且仅包含一个原型插入标记")
    if not (root / "vendor" / "lucide.min.js").is_file():
        raise FileNotFoundError("本地图标资源缺失，请保留完整 vendor 目录")

    # 不嵌入个人电脑路径，也不依赖 Codex 或在线 CDN，便于其他人克隆后预览。
    result = template.replace(marker, fragment)
    (root / "index.html").write_text(result, encoding="utf-8", newline="\n")
    print("已生成 docs/design/nps-v2/index.html")


if __name__ == "__main__":
    main()
