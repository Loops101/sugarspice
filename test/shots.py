"""Loads pages in Chromium, records console/page errors, saves screenshots.
Usage: python3 test/shots.py http://localhost:3222 /tmp/ssc-ui/shots
"""
import sys, os, json
from playwright.sync_api import sync_playwright

base, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
pages = [("home", "/"), ("shop", "/shop.html"), ("product", None), ("track", "/track.html"), ("account", "/account.html"),
         ("about", "/about.html"), ("contact", "/contact.html"), ("notfound", "/nope")]
problems = []

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in (("desktop", {"width": 1440, "height": 900}), ("mobile", {"width": 390, "height": 844})):
        ctx = b.new_context(viewport=vp, device_scale_factor=1, is_mobile=(label == "mobile"), has_touch=(label == "mobile"))
        page = ctx.new_page()
        page.on("console", lambda m, l=label: problems.append((l, "console." + m.type, m.text)) if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e, l=label: problems.append((l, "pageerror", str(e))))
        page.on("requestfailed", lambda r, l=label: problems.append((l, "requestfailed", r.url)) if "fonts.g" not in r.url else None)
        pid = None
        for name, path in pages:
            if name == "product":
                page.goto(base + "/shop.html"); page.wait_for_selector(".card")
                href = page.get_attribute(".card h3 a", "href"); path = href
            page.goto(base + path, wait_until="networkidle")
            page.wait_for_timeout(700)
            if name == "home":  # scroll through so scroll-reveal sections fire, like a real visitor
                h = page.evaluate("document.body.scrollHeight")
                for y in range(0, h, 500): page.evaluate(f"window.scrollTo(0,{y})"); page.wait_for_timeout(90)
                page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(500)
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            if overflow > 0: problems.append((label, "horizontal-overflow", f"{name}: {overflow}px"))
            page.screenshot(path=f"{out}/{label}-{name}.png", full_page=(name in ("home",)))
        if label == "mobile":
            page.goto(base + "/shop.html", wait_until="networkidle")
            cols = page.evaluate("""() => { const c=[...document.querySelectorAll('.prod-grid .card')].slice(0,2); return c.length===2 && Math.abs(c[0].getBoundingClientRect().top-c[1].getBoundingClientRect().top)<4 }""")
            print("mobile two columns side by side:", cols)
        ctx.close()
    b.close()

print("PROBLEMS:", json.dumps(problems, indent=1) if problems else "none")
