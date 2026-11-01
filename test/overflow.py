import sys
from playwright.sync_api import sync_playwright
base = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True).new_page()
    page.goto(base + "/track.html", wait_until="networkidle")
    page.wait_for_timeout(500)
    res = page.evaluate("""() => {
      const vw = document.documentElement.clientWidth, out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0) out.push(el.tagName + '.' + (el.className.baseVal ?? el.className) + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width));
      }
      return {vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 12)};
    }""")
    print(res)
    b.close()
