"""
SiamWorld Shop — Playwright E2E Tests
Tests: homepage, navigation, shop, lootbox, topup, admin setup, admin login guard
"""
from playwright.sync_api import sync_playwright, expect
import sys

BASE = 'http://localhost:3000'
PASS = []
FAIL = []

def test(name, fn):
    try:
        fn()
        PASS.append(name)
        print(f'  [PASS] {name}')
    except Exception as e:
        FAIL.append((name, str(e)[:120]))
        print(f'  [FAIL] {name}: {str(e)[:120]}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()

    # ── 1. Homepage loads ──────────────────────────────────────
    def t_homepage():
        page.goto(BASE)
        page.wait_for_load_state('networkidle')
        assert page.title(), 'No page title'
        # Navbar present
        assert page.locator('nav').count() > 0, 'No nav element'
        # Footer present
        assert page.locator('footer').count() > 0, 'No footer'
    test('Homepage loads', t_homepage)

    # ── 2. Dynamic title from settings ────────────────────────
    def t_dynamic_title():
        title = page.title()
        # Should not be empty
        assert len(title) > 5, f'Title too short: {title}'
        print(f'       title = "{title}"')
    test('Dynamic page title set', t_dynamic_title)

    # ── 3. Navigation links present ───────────────────────────
    def t_nav_links():
        page.goto(BASE)
        page.wait_for_load_state('networkidle')
        links = page.locator('nav a').all()
        hrefs = [l.get_attribute('href') for l in links if l.get_attribute('href')]
        assert any('/shop' in h for h in hrefs), f'No /shop link found. hrefs={hrefs}'
        assert any('/topup' in h for h in hrefs), f'No /topup link found'
        assert any('/lootbox' in h for h in hrefs), f'No /lootbox link found'
    test('Nav links present (shop, topup, lootbox)', t_nav_links)

    # ── 4. Shop page loads ─────────────────────────────────────
    def t_shop_page():
        page.goto(f'{BASE}/shop')
        page.wait_for_load_state('networkidle')
        # Should have a heading
        assert page.locator('h1, h2').first.is_visible(), 'No heading on shop page'
    test('Shop page renders', t_shop_page)

    # ── 5. Lootbox page loads ──────────────────────────────────
    def t_lootbox_page():
        page.goto(f'{BASE}/lootbox')
        page.wait_for_load_state('networkidle')
        assert page.locator('body').is_visible(), 'Lootbox page body not visible'
    test('Lootbox page renders', t_lootbox_page)

    # ── 6. Topup page loads ────────────────────────────────────
    def t_topup_page():
        page.goto(f'{BASE}/topup')
        page.wait_for_load_state('networkidle')
        body_text = page.locator('body').inner_text()
        assert len(body_text) > 20, 'Topup page appears empty'
    test('Topup page renders', t_topup_page)

    # ── 7. Download page loads ─────────────────────────────────
    def t_download_page():
        page.goto(f'{BASE}/download')
        page.wait_for_load_state('networkidle')
        assert page.locator('body').is_visible()
    test('Download page renders', t_download_page)

    # ── 8. Admin requires auth ─────────────────────────────────
    def t_admin_guard():
        page.goto(f'{BASE}/admin')
        page.wait_for_load_state('networkidle')
        body = page.locator('body').inner_text()
        # Should show access denied OR spinner (not full dashboard for anonymous user)
        no_sidebar = page.locator('[href="/admin/users"]').count() == 0
        assert no_sidebar, 'Admin sidebar visible without auth!'
    test('Admin panel blocked without login', t_admin_guard)

    # ── 9. Admin/setup page accessible without auth ────────────
    def t_setup_page():
        page.goto(f'{BASE}/admin/setup')
        page.wait_for_load_state('networkidle')
        body = page.locator('body').inner_text()
        # Should show wizard OR access denied (not blank)
        assert len(body.strip()) > 10, 'Setup page completely empty'
    test('Setup wizard page accessible', t_setup_page)

    # ── 10. API /public/settings returns shop data ─────────────
    def t_api_settings():
        import json
        res = page.request.get(f'{BASE}/api/public/settings')
        assert res.ok, f'API returned {res.status}'
        data = res.json()
        assert 'settings' in data, f'No "settings" key in response: {data}'
    test('API /public/settings responds', t_api_settings)

    # ── 11. API /setup/status returns JSON ─────────────────────
    def t_api_setup_status():
        res = page.request.get(f'{BASE}/api/setup/status')
        assert res.ok, f'API returned {res.status}'
        data = res.json()
        assert 'hasAdmin' in data, f'Missing hasAdmin: {data}'
        assert 'isConfigured' in data, f'Missing isConfigured: {data}'
        print(f'       hasAdmin={data["hasAdmin"]}  isConfigured={data["isConfigured"]}')
    test('API /setup/status responds', t_api_setup_status)

    # ── 12. No console errors on homepage ─────────────────────
    def t_no_console_errors():
        errors = []
        page2 = ctx.new_page()
        page2.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page2.goto(BASE)
        page2.wait_for_load_state('networkidle')
        # Filter known third-party / font errors
        real_errors = [e for e in errors if 'fonts.googleapis' not in e and 'cdnjs' not in e and 'favicon' not in e]
        page2.close()
        assert not real_errors, f'Console errors: {real_errors}'
    test('No JS console errors on homepage', t_no_console_errors)

    # ── 13. Screenshot for visual inspection ──────────────────
    def t_screenshot():
        page.goto(BASE)
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/siamworld_home.png', full_page=True)
    test('Homepage screenshot captured', t_screenshot)

    browser.close()

# ── Summary ───────────────────────────────────────────────────
print()
print(f'Results: {len(PASS)} passed, {len(FAIL)} failed')
if FAIL:
    print()
    print('Failed tests:')
    for name, err in FAIL:
        print(f'  • {name}: {err}')
    sys.exit(1)
