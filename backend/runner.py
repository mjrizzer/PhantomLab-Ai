"""Durable single-consumer worker; isolated browsers and bounded, reviewed tools."""
import asyncio
import json
import os
import platform
import time
import uuid
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from .store import get, put, listing, now, ARTIFACTS, Session, Order
from .intelligence import decide, SCENARIOS
from .ml import assess, anomalies

PORT = int(os.getenv('PHANTOM_PORT', '8765'))
ORIGIN = f'http://127.0.0.1:{PORT}'
active_tasks = {}
def event(job, actor, message, **extra):
    job['events'].append({'at': now(), 'actor': actor, 'message': message, **extra})
    put('experiment', job['id'], job)
def cancelled(job):
    current = get(job['id'])
    if current and current.get('cancel_requested'):
        raise asyncio.CancelledError()
async def inference(job, role, evidence):
    cancelled(job)
    event(job, role, 'Local structured inference in progress', kind='inference')
    try:
        decision = await decide(role, job['objective'], evidence)
        job['agents'].append({'role': role, 'at': now(), **decision, 'source': 'ollama'})
        event(job, role, decision['summary'], kind='decision')
        return decision
    except RuntimeError as exc:
        job['agents'].append({'role': role, 'error': str(exc), 'source': 'unavailable'})
        event(job, role, str(exc) + '. Reviewed deterministic tools remain available.', kind='unavailable')
        job['ai_degraded'] = True
        return None
async def secure_route(route):
    parsed = urlsplit(route.request.url)
    if parsed.scheme in ('data', 'blob', 'about'):
        return await route.continue_()
    # Browser tools can only contact this controlled fixture and its local assets.
    if parsed.scheme == 'http' and parsed.hostname == '127.0.0.1' and parsed.port == PORT and (parsed.path.startswith('/demo/') or parsed.path.startswith('/fonts/')):
        return await route.continue_()
    await route.abort('blockedbyclient')
async def observation(browser, job):
    context = await browser.new_context(service_workers='block')
    await context.route('**/*', secure_route)
    page = await context.new_page()
    try:
        await page.goto(ORIGIN + '/demo/A', wait_until='networkidle')
        return await page.locator('body').inner_text(timeout=5000)
    finally:
        await context.close()
async def scenario(browser, job, release, name):
    cancelled(job)
    rid = f'{job["id"]}-{release}-{name}'
    folder = ARTIFACTS / job['id']
    folder.mkdir(exist_ok=True)
    context = await browser.new_context(viewport={'width': 1200, 'height': 850}, service_workers='block', reduced_motion='reduce')
    await context.route('**/*', secure_route)
    await context.tracing.start(screenshots=True, snapshots=True, sources=False)
    page = await context.new_page()
    page.set_default_timeout(8000)
    logs, failures, redirects = [], [], []
    page.on('pageerror', lambda exc: logs.append(str(exc)[:500]))
    page.on('console', lambda msg: logs.append(msg.text[:500]) if msg.type == 'error' else None)
    page.on('requestfailed', lambda req: failures.append({'url': urlsplit(req.url).path, 'failure': req.failure}))
    page.on('response', lambda response: redirects.append(response.status) if 300 <= response.status < 400 else None)
    started = time.perf_counter()
    result = {'id': rid, 'release': release, 'scenario': name, 'passed': False, 'status': 'error', 'console': logs, 'network': failures, 'steps': [], 'evidence': {}, 'screenshots': []}
    def step(message):
        result['steps'].append(message)
        event(job, 'Experiment Operator', message, release=release, scenario=name, kind='tool')
    async def capture(label):
        filename = f'{release}-{name}-{label}.png'
        await page.screenshot(path=str(folder / filename), full_page=True)
        url = f'/api/artifacts/{job["id"]}/{filename}'
        result['screenshots'].append(url)
        event(job, 'Experiment Operator', f'Captured {label}', screenshot=url, release=release, scenario=name, kind='capture')
    try:
        step(f'Open release {release} / {name}')
        await page.goto(ORIGIN + f'/demo/{release}' + ('?delay=1200' if name == 'slow_network' else ''), wait_until='networkidle')
        await page.get_by_role('button', name='Add The Quiet Vessel to bag').click()
        await page.locator('.cart-row').wait_for()
        await capture('before')
        step('Add one $48 vessel; new isolated guest session')
        if name == 'keyboard':
            await page.locator('#discount').focus()
            await page.keyboard.press('Tab')
            focused = await page.evaluate('document.activeElement.id')
            result['evidence'] = {'expected_focus': 'apply', 'actual_focus': focused}
            result['passed'] = focused == 'apply'
            step(f'Keyboard Tab from discount field; focus = {focused}')
        else:
            if name == 'discount':
                await page.locator('#discount').fill('STUDIO10')
                await page.locator('#apply').click()
                step('Apply advertised STUDIO10 discount')
            if name == 'rapid_checkout':
                # Two real DOM click events in the same browser task. A disables the button.
                await page.locator('#checkout').evaluate('(button) => { button.click(); button.click(); }')
                step('Dispatch two immediate clicks to the checkout button')
            else:
                await page.locator('#checkout').click()
                step('Submit one demo order')
            if name == 'slow_network':
                await page.wait_for_timeout(750)
                status_during_delay = await page.locator('#status').inner_text()
                result['evidence']['status_during_delay'] = status_during_delay
            await page.wait_for_function('document.querySelectorAll("[data-order]").length > 0')
            await page.wait_for_timeout(450)
            cookies = await context.cookies()
            sid = next(c['value'] for c in cookies if c['name'] == 'atelier_session')
            with Session() as db:
                orders = db.query(Order).filter_by(session=sid, release=release).all()
                db_evidence = [{'id': o.id, 'total_cents': o.total_cents, 'created': o.created} for o in orders]
            visible = await page.locator('[data-order]').count()
            result['evidence'].update({'database_orders': db_evidence, 'database_count': len(db_evidence), 'visible_order_count': visible, 'expected_count': 1, 'expected_total_cents': 4320 if name == 'discount' else 4800})
            result['passed'] = len(db_evidence) == 1 and visible == 1
            if name == 'discount':
                result['passed'] = result['passed'] and db_evidence[0]['total_cents'] == 4320
            if name == 'slow_network':
                result['passed'] = result['passed'] and 'timed out' not in result['evidence']['status_during_delay'].lower()
            step(f'Database order count = {len(db_evidence)}; browser order count = {visible}')
        result['status'] = 'passed' if result['passed'] else 'failed'
        result['assertion'] = {'single_checkout': 'One successful checkout creates exactly one order.', 'rapid_checkout': 'Repeated submission creates exactly one order.', 'discount': 'STUDIO10 reduces 4800 cents to 4320 cents.', 'keyboard': 'The Apply code button follows its input in keyboard order.', 'slow_network': 'A delayed successful checkout must not report a premature timeout.'}[name]
        result['reproduction'] = [f'Open /demo/{release}' + ('?delay=1200' if name == 'slow_network' else ''), *result['steps'][1:], result['assertion']]
        await capture('after')
        event(job, 'Evidence Analyst', f'{result["status"].upper()}: {result["assertion"]}', kind='assertion', release=release, scenario=name)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        result['error'] = f'{type(exc).__name__}: {str(exc)[:500]}'
        event(job, 'Experiment Operator', result['error'], kind='error', release=release, scenario=name)
        try:
            await capture('error')
        except Exception:
            pass
    finally:
        result['duration_ms'] = round((time.perf_counter() - started) * 1000)
        result['network_failures'] = len(failures)
        result['redirects'] = len(redirects)
        result['event_count'] = len(result['steps'])
        trace = f'{release}-{name}.zip'
        try:
            await context.tracing.stop(path=str(folder / trace))
            result['trace'] = f'/api/artifacts/{job["id"]}/{trace}'
        finally:
            await context.close()
        (folder / f'{release}-{name}.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result

async def run(job):
    job.update(status='running', started=now(), events=[], results=[], agents=[], ai_degraded=False, environment={'os': platform.platform(), 'python': platform.python_version(), 'browser': 'Chromium / Playwright', 'viewport': '1200 × 850', 'timezone': 'browser default', 'model': os.getenv('OLLAMA_MODEL', 'qwen3.5:4b'), 'network': 'only controlled localhost fixture permitted', 'run_origin': ORIGIN})
    event(job, 'Worker', 'Claimed persisted job. Browser concurrency: 1.')
    chosen = list(job['scenarios'])
    if job['mode'] == 'ai':
        await inference(job, 'Investigator', {'available_tools': SCENARIOS, 'approved_product': 'Atelier Commerce, releases A and B', 'persona': job.get('persona', 'The Impatient Buyer')})
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        job['environment']['browser'] = 'Chromium ' + browser.version
        try:
            if job['mode'] == 'ai':
                observed = await observation(browser, job)
                explorer = await inference(job, 'Explorer', {'visible_page_text': observed, 'tools': SCENARIOS})
                architect = await inference(job, 'Scenario Architect', {'explorer': explorer, 'allowed_scenarios': SCENARIOS, 'required_signature_scenarios': ['single_checkout', 'rapid_checkout'], 'requested': chosen})
                if architect:
                    chosen = list(dict.fromkeys(['single_checkout', 'rapid_checkout'] + architect['scenarios']))[:5]
                await inference(job, 'Experiment Operator', {'approved_plan': chosen, 'constraints': 'One isolated context per scenario. Max 10 browser runs. No arbitrary code.'})
            job['executed_scenarios'] = chosen
            for release in ['A', 'B']:
                for name in chosen:
                    cancelled(job)
                    result = await asyncio.wait_for(scenario(browser, job, release, name), timeout=50)
                    job['results'].append(result)
                    put('experiment', job['id'], job)
            job['risk'] = assess(job['results'])
            history = [r for j in listing('experiment') if j['id'] != job['id'] and j['status'] == 'completed' for r in j.get('results', [])]
            job['anomalies'] = anomalies(history, job['results'])
            if job['mode'] == 'ai' and not job.get('ai_degraded'):
                await inference(job, 'Evidence Analyst', {'results': [{k: r.get(k) for k in ['id', 'release', 'scenario', 'passed', 'status', 'assertion', 'evidence']} for r in job['results']]})
                await inference(job, 'Release Analyst', {'verified_results': job['results'], 'risk': job['risk'], 'warning': 'Do not invent predictive accuracy.'})
            job['status'] = 'completed'
            job['finished'] = now()
            event(job, 'Worker', 'Investigation sealed. Evidence and report are available.')
        finally:
            await browser.close()

async def execute(key):
    job = get(key)
    try:
        await asyncio.wait_for(run(job), timeout=900)
    except asyncio.CancelledError:
        job['status'] = 'cancelled'
        job['finished'] = now()
        event(job, 'Worker', 'Execution stopped. Completed evidence retained; checkout requests already sent may finish.')
    except Exception as exc:
        job.update(status='failed', finished=now(), error=f'{type(exc).__name__}: {str(exc)[:800]}')
        event(job, 'Worker', job['error'], kind='error')
    finally:
        put('experiment', key, job)

async def worker(stop):
    while not stop.is_set():
        queued = sorted([j for j in listing('experiment') if j['status'] == 'queued'], key=lambda j: j['created'])
        if queued:
            job = queued[0]
            task = asyncio.create_task(execute(job['id']))
            active_tasks[job['id']] = task
            try:
                await task
            finally:
                active_tasks.pop(job['id'], None)
        else:
            try:
                await asyncio.wait_for(stop.wait(), 0.5)
            except TimeoutError:
                pass

def recover():
    for job in listing('experiment'):
        if job['status'] == 'running':
            # Preserve interrupted evidence. Fresh contexts are created on explicit replay.
            job['status'] = 'interrupted'
            event(job, 'Worker', 'Previous execution interrupted. Evidence retained. Replay creates fresh isolated sessions.')
