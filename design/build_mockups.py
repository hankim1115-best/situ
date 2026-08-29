"""Turn the .dc.html artboards into plain standalone screens + a board page.

    py design/build_mockups.py

No dependencies. Reads design/*.dc.html, strips the Design-Component
wrappers, writes design/screens/*.html, and writes design/mockups.html
laying every screen out on one scrollable board using the sizes in
design/canvas.json.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.path.join(HERE, "screens")


def strip_wrappers(src: str) -> str:
    src = src.replace('<script src="./support.js"></script>', "")
    src = src.replace("<x-dc>", "").replace("</x-dc>", "")
    src = src.replace("<helmet>", "").replace("</helmet>", "")
    # move the <style> (was inside <helmet> in <body>) into <head>
    m = re.search(r"<style>.*?</style>", src, re.S)
    if m and "<head>" in src:
        style = m.group(0)
        src = src.replace(style, "", 1)
        src = src.replace("</head>", style + "\n</head>", 1)
    return src


def main():
    os.makedirs(SCREENS, exist_ok=True)
    canvas = json.load(open(os.path.join(HERE, "canvas.json"), encoding="utf-8"))
    frames = []
    for ab in canvas["artboards"]:
        name = ab["file"].replace(".dc.html", "")
        src = open(os.path.join(HERE, ab["file"]), encoding="utf-8").read()
        out = strip_wrappers(src)
        fn = name.lower() + ".html"
        open(os.path.join(SCREENS, fn), "w", encoding="utf-8").write(out)
        frames.append((ab.get("title", name), out, ab["w"], ab["h"]))
        print("wrote screens/" + fn)

    # Self-contained board: each screen inlined via srcdoc (double-quoted attr).
    def srcdoc(html: str) -> str:
        return html.replace("&", "&amp;").replace('"', "&quot;")

    cards = "\n".join(
        f'''      <figure class="frame">
        <figcaption>{title}</figcaption>
        <iframe srcdoc="{srcdoc(doc)}" width="{w}" height="{h}" loading="lazy"
                title="{title}" scrolling="no"></iframe>
      </figure>'''
        for (title, doc, w, h) in frames
    )

    board = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Situ — 화면 구성 목업</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: #23252f; color: #f2f3f7;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Malgun Gothic", "Noto Sans KR", sans-serif; }}
  header {{ padding: 24px 28px 8px; }}
  header h1 {{ margin: 0 0 4px; font-size: 20px; }}
  header p {{ margin: 0; color: #a3a8b8; font-size: 14px; }}
  .board {{ display: flex; gap: 40px; padding: 24px 28px 60px; overflow-x: auto; align-items: flex-start; }}
  .frame {{ margin: 0; flex: none; }}
  .frame figcaption {{ font-size: 13px; font-weight: 600; color: #a3a8b8; margin-bottom: 10px; }}
  .frame iframe {{ border: 0; border-radius: 24px; background: #f4f4f7;
                   box-shadow: 0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06); }}
  @media (max-width: 720px) {{
    .board {{ flex-direction: column; align-items: center; }}
  }}
</style>
</head>
<body>
  <header>
    <h1>Situ · 앱 화면 구성</h1>
    <p>현재 앱의 인디고 톤·컴포넌트를 그대로 반영한 7개 핵심 화면. 각 프레임은 실제 화면 스크롤 높이입니다.</p>
  </header>
  <div class="board">
{cards}
  </div>
</body>
</html>
"""
    open(os.path.join(HERE, "mockups.html"), "w", encoding="utf-8").write(board)
    print("wrote mockups.html")


if __name__ == "__main__":
    main()
