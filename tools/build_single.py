#!/usr/bin/env python3
"""index.html と css/js を1つのHTMLにまとめます（オフラインで配布・利用する用）。

使い方:  python3 tools/build_single.py   ->  dist/lak-keycap-generator.html
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()

html = read("index.html")
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: "<style>\n" + read(m.group(1)) + "</style>", html)
html = re.sub(r'<script src="(js/[^"]+)"></script>',
              lambda m: "<script>\n" + read(m.group(1)).replace("</script", "<\\/script") + "</script>", html)

os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", "lak-keycap-generator.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", os.path.relpath(out, ROOT), f"({len(html.encode('utf-8'))//1024} KB)")
