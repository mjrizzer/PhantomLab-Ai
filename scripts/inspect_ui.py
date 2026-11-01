"""Produce real desktop/mobile screenshots and check all laboratory rooms."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    out=Path('data/ui-checks');out.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        page=await browser.new_page(viewport={'width':1440,'height':1100})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://127.0.0.1:8765',wait_until='networkidle')
        await page.evaluate('document.fonts.ready')
        fonts=await page.evaluate('''() => Object.fromEntries(['Playfair Display','Libre Baskerville','Instrument Serif'].map(f=>[f,document.fonts.check('16px "'+f+'"')]))''')
        await page.screenshot(path=str(out/'observatory-desktop.png'),full_page=True)
        for room in ['registry','studio','personas','evidence','compare','atlas','risk','journal','services']:
            await page.goto('http://127.0.0.1:8765/#'+room,wait_until='networkidle')
            await page.wait_for_timeout(500)
            await page.screenshot(path=str(out/(room+'.png')),full_page=True)
        await page.set_viewport_size({'width':390,'height':844})
        await page.goto('http://127.0.0.1:8765',wait_until='networkidle')
        await page.screenshot(path=str(out/'observatory-mobile.png'),full_page=True)
        overflow=await page.evaluate('document.documentElement.scrollWidth > innerWidth')
        await browser.close()
        result={'fonts':fonts,'page_errors':errors,'mobile_overflow':overflow}
        print(json.dumps(result,indent=2))
        (out/'checks.json').write_text(json.dumps(result,indent=2))
        assert all(fonts.values()) and not errors and not overflow,result
asyncio.run(main())
