"""Real backend outage + restart; internet is isolated at the test browser boundary."""
import asyncio
import json
import os
import sqlite3
import subprocess
import sys
import time
import uuid
from pathlib import Path
import pytest
from playwright.async_api import async_playwright
from conftest import wait_job, ROOT

@pytest.mark.asyncio
async def test_pwa_archive_outage_safe_sync_and_worker_restart(laboratory,signature):
    client,path,process=laboratory
    if not (ROOT/'dist'/'sw.js').exists():
        pytest.fail('Build the PWA before testing its real offline behavior')
    restarted=None
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        context=await browser.new_context(service_workers='allow')
        # Explicitly disconnect this browser from non-loopback destinations while retaining localhost.
        async def isolate(route):
            from urllib.parse import urlsplit
            if urlsplit(route.request.url).hostname in ('127.0.0.1','localhost'):
                await route.continue_()
            else:
                await route.abort('internetdisconnected')
        await context.route('**/*',isolate)
        page=await context.new_page()
        await page.goto(str(client.base_url),wait_until='networkidle')
        await page.evaluate('navigator.serviceWorker.ready')
        await page.reload(wait_until='networkidle')
        await page.wait_for_function('navigator.serviceWorker.controller !== null')
        await page.wait_for_function('indexedDB.databases().then(d=>d.some(x=>x.name==="phantomlab-v1"))')
        await page.wait_for_timeout(1500)
        assert await page.evaluate('fetch("https://example.com").then(()=>false).catch(()=>true)')
        assert (await page.request.get(str(client.base_url)+'/api/products')).ok
        # Actually stop the owned FastAPI process. Cached interface must open without it.
        process.terminate();process.wait(timeout=15)
        await page.reload(wait_until='domcontentloaded')
        await page.get_by_text('ARCHIVE MODE',exact=True).wait_for(timeout=15000)
        await page.goto(str(client.base_url)+'/#journal',wait_until='domcontentloaded')
        await page.get_by_role('combobox',name='Selected experiment').select_option(signature['id'])
        await page.get_by_role('heading',name='The Double Checkout Paradox',exact=True).wait_for()
        await page.get_by_role('textbox',name='Engineer’s notes').fill('Evidence kept during a real backend outage.')
        await page.get_by_role('button',name='Save note',exact=True).click()
        await page.wait_for_timeout(500)
        # Persist one safe queued job and one interrupted record to test restart recovery.
        key='EXP-'+str(uuid.uuid4())[:12]
        job={'id':key,'title':'Restart recovery','objective':'Verify durable queued execution after backend restart.','mode':'manual','persona':'The Impatient Buyer','scenarios':['rapid_checkout'],'status':'queued','created':'2026-01-01T00:00:00+00:00','events':[],'results':[],'agents':[]}
        interrupted={**job,'id':'EXP-00000000-000','status':'running','events':[]}
        with sqlite3.connect(path/'laboratory.sqlite') as db:
            for row in [job,interrupted]:
                db.execute('INSERT INTO records(id,kind,body,updated) VALUES(?,?,?,?)',(row['id'],'experiment',json.dumps(row),row['created']))
        env={**os.environ,'PHANTOM_DATA':str(path),'PHANTOM_PORT':'8877','OLLAMA_URL':'http://127.0.0.1:1'}
        with (path/'restarted.log').open('w') as log:
            restarted=subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8877'],cwd=ROOT,env=env,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        if client.get('/api/products').status_code==200:break
                    except Exception:pass
                    await asyncio.sleep(.25)
                # Closing the tab does not stop queued work in the Python service.
                await page.wait_for_timeout(5500)
                await browser.close()
                final=await asyncio.to_thread(wait_job,client,key)
                assert final['status']=='completed',final.get('error')
                assert client.get('/api/experiments/EXP-00000000-000').json()['status']=='interrupted'
                note=client.get('/api/notes/'+signature['id']).json()
                assert note['text']=='Evidence kept during a real backend outage.'
                assert note['revision']==1
            finally:
                restarted.terminate();restarted.wait(timeout=15)
