"""Guest buys jewelry in a real browser: add to bag -> drawer -> checkout -> M-Pesa (demo) -> confirmation -> track.
Usage: python3 test/flow.py http://localhost:3222 /tmp/ssc-ui/flow
"""
import sys, os, re, time
from playwright.sync_api import sync_playwright

base, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
errors = []
ok = lambda c, m: print(("  ok   " if c else "  FAIL ") + m) or (None if c else errors.append(m))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "404" not in m.text and "400" not in m.text else None)

    page.goto(base + "/shop.html", wait_until="networkidle")
    page.click(".card >> nth=0 >> .add")
    page.wait_for_selector("#cart-drawer.open")
    ok(page.inner_text(".badge-count") == "1", "bag badge shows 1 after adding")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/1-drawer.png")
    page.click("#cart-drawer a.btn-gold")
    page.wait_for_selector("#co-form", timeout=8000)
    page.wait_for_timeout(700)
    ok("Checking out as a guest" in page.inner_text("body"), "checkout is guest-first")
    page.screenshot(path=f"{out}/2-checkout.png", full_page=True)

    # Validation: submit empty
    page.click(".sticky-pay .btn-gold")
    page.wait_for_selector(".field-error")
    ok(page.is_visible(".field-error"), "empty form shows a field error")

    page.fill("#f-name", "Wanjiku Test")
    page.fill("#f-phone", "0712 345 678")
    page.fill("#f-address", "Kilimani, Nairobi")
    page.click("text=Apply")  # empty coupon message
    ok("Enter a code" in page.inner_text(".co-summary"), "empty coupon is explained")
    page.fill("#coupon", "welcome10"); page.click("text=Apply")
    page.wait_for_selector("text=applied", timeout=5000)
    ok("Discount" in page.inner_text(".co-summary"), "coupon discount appears in summary")
    total_txt = page.inner_text(".co-summary .sum-row.total")
    page.click(".sticky-pay .btn-gold")
    page.wait_for_selector(".modal", timeout=8000)
    page.wait_for_timeout(500)
    ok("Check your phone" in page.inner_text(".modal"), "M-Pesa waiting dialog opens")
    page.screenshot(path=f"{out}/3-pay.png")
    page.wait_for_url(re.compile(r"/order\.html\?n=SSC-\d+&t=\w+"), timeout=20000)
    page.wait_for_selector(".order-no")
    page.wait_for_timeout(600)
    ok("Thank you, Wanjiku" in page.inner_text("body"), "confirmation greets the customer")
    ok("paid" in page.inner_text("body").lower(), "order shows as paid after demo payment")
    ok(total_txt.split("\n")[-1].strip() in page.inner_text("body"), "order total matches checkout total")
    ok(page.evaluate("localStorage.getItem('ssc_cart_v2')") in ("[]", None), "bag is emptied after ordering")
    page.screenshot(path=f"{out}/4-order.png", full_page=True)
    order_no = page.inner_text(".order-no")

    # Guest returns later and finds the order with number + phone
    page.goto(base + "/track.html", wait_until="networkidle")
    page.fill("#t-number", order_no); page.fill("#t-phone", "0712345678")
    page.click("#track-form button")
    page.wait_for_url(re.compile(r"/order\.html"), timeout=8000)
    ok(order_no in page.inner_text("body"), "tracking by number + phone finds the order")

    # Save-to-account (optional sign-up) from the confirmation page
    page.fill("#s-email", f"wanjiku.{int(time.time())}@example.com"); page.fill("#s-pw", "goldstandard1")
    page.click("text=Create my account")
    page.wait_for_selector(".save-card", state="detached", timeout=10000)
    page.goto(base + "/account.html", wait_until="networkidle"); page.wait_for_timeout(600)
    ok(order_no in page.inner_text("body"), "order was saved into the new account")
    page.screenshot(path=f"{out}/5-account.png", full_page=True)
    b.close()

print("\nFAILURES:" if errors else "\nALL FLOW CHECKS PASSED", errors if errors else "")
