import asyncio
import io
import json
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
import networkx as nx
from . import store, intelligence, runner, ml
from .commerce import router as commerce

ROOT = Path(__file__).resolve().parents[1]
PERSONAS = [
    {'id': 'first', 'name': 'The First-Timer', 'goal': 'Complete a purchase without prior knowledge.', 'constraints': 'Follow visible labels; no hidden routes.', 'limit': 15},
    {'id': 'impatient', 'name': 'The Impatient Buyer', 'goal': 'Verify safe repeated submission.', 'constraints': 'At most two immediate checkout clicks; fake payments only.', 'limit': 12},
    {'id': 'cautious', 'name': 'The Cautious User', 'goal': 'Verify before committing.', 'constraints': 'Review quantities and order totals.', 'limit': 15},
    {'id': 'keyboard', 'name': 'The Keyboard User', 'goal': 'Reach checkout controls by keyboard.', 'constraints': 'Use Tab and focus checks.', 'limit': 20},
    {'id': 'slow', 'name': 'The Slow Network User', 'goal': 'Preserve correct feedback during latency.', 'constraints': 'A 1200 ms local fixture delay; no external traffic.', 'limit': 12},
    {'id': 'edge', 'name': 'The Edge-Case Explorer', 'goal': 'Test unusual valid input sequences.', 'constraints': 'Valid discount code and bounded quantities.', 'limit': 20},
]
@asynccontextmanager
async def lifespan(app):
    store.init()
    if not store.get('atelier'):
        store.put('product', 'atelier', {'id': 'atelier', 'name': 'Atelier Commerce', 'description': 'Considered objects. A fictional shop with real checkout behavior.', 'url': runner.ORIGIN + '/demo/A', 'origin': runner.ORIGIN, 'release': 'A + B', 'category': 'Commerce', 'revision': 1, 'versions': ['A', 'B'], 'scenarios': intelligence.SCENARIOS})
    runner.recover()
    stop = asyncio.Event()
    app.state.worker = asyncio.create_task(runner.worker(stop))
    yield
    stop.set()
    for task in list(runner.active_tasks.values()):
        task.cancel()
    await app.state.worker

app = FastAPI(title='PhantomLab Local Laboratory', version='0.1.0', lifespan=lifespan)

@app.middleware('http')
async def local_boundary(request: Request, call_next):
    # DNS rebinding and cross-origin browser mutations are rejected.
    host = request.headers.get('host', '').split(':')[0]
    if host not in ('localhost', '127.0.0.1', 'testserver'):
        return JSONResponse({'detail': 'Loopback host required'}, status_code=403)
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        origin = request.headers.get('origin')
        if origin:
            parsed = urlsplit(origin)
            if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1') or parsed.port not in (5173, 4173, runner.PORT):
                return JSONResponse({'detail': 'Unapproved request origin'}, status_code=403)
        if request.headers.get('sec-fetch-site') == 'cross-site':
            return JSONResponse({'detail': 'Cross-site mutation blocked'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if request.url.path.startswith(('/api', '/demo')):
        response.headers['Cache-Control'] = 'no-store'
    return response

app.include_router(commerce)
class ExperimentInput(BaseModel):
    objective: str = Field(default='The Double Checkout Paradox: determine whether the candidate safely handles checkout.', min_length=10, max_length=2000)
    mode: Literal['manual', 'ai'] = 'manual'
    persona: str = Field(default='The Impatient Buyer', max_length=200)
    scenarios: list[Literal['single_checkout', 'rapid_checkout', 'discount', 'keyboard', 'slow_network']] = Field(default_factory=lambda: list(intelligence.SCENARIOS), min_length=1, max_length=5)
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')

@app.get('/api/experiments')
async def experiments():
    return store.listing('experiment')
@app.post('/api/experiments', status_code=202)
async def begin(body: ExperimentInput):
    key = 'EXP-' + str(uuid.uuid5(uuid.NAMESPACE_URL, body.idempotency_key))[:12]
    existing = store.get(key)
    if existing:
        return existing
    if sum(j['status'] in ('queued', 'running') for j in store.listing('experiment')) >= 10:
        raise HTTPException(429, 'Queue limit reached: 10 active or pending experiments')
    job = {'id': key, 'title': 'The Double Checkout Paradox', 'objective': body.objective, 'mode': body.mode, 'persona': body.persona, 'scenarios': list(dict.fromkeys(body.scenarios)), 'status': 'queued', 'created': store.now(), 'events': [], 'results': [], 'agents': []}
    return store.put('experiment', key, job)
@app.get('/api/experiments/{key}')
async def experiment(key: str):
    job = store.get(key)
    if not job or not key.startswith('EXP-'):
        raise HTTPException(404, 'Experiment not found')
    return job
@app.post('/api/experiments/{key}/cancel')
async def cancel(key: str):
    job = await experiment(key)
    if job['status'] == 'queued':
        job['status'] = 'cancelled'
        store.put('experiment', key, job)
    elif job['status'] == 'running':
        job['cancel_requested'] = True
        store.put('experiment', key, job)
        task = runner.active_tasks.get(key)
        if task:
            task.cancel()
    return {'status': 'cancellation requested', 'id': key}
@app.get('/api/products')
async def products():
    return store.listing('product')
class ProductInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(max_length=2000)
    url: str = Field(max_length=500)
    release: str = Field(min_length=1, max_length=80)
    category: str = Field(max_length=80)
    @field_validator('url')
    @classmethod
    def loopback(cls, value):
        p = urlsplit(value)
        if p.scheme != 'http' or p.hostname not in ('127.0.0.1', 'localhost') or p.username or p.password:
            raise ValueError('Only HTTP localhost products are supported. External origins are disabled.')
        return value
@app.post('/api/products', status_code=201)
async def product(body: ProductInput):
    key = 'PRD-' + uuid.uuid4().hex[:12]
    return store.put('product', key, {'id': key, **body.model_dump(), 'origin': f'{urlsplit(body.url).scheme}://{urlsplit(body.url).netloc}', 'revision': 1, 'versions': [body.release], 'scenarios': []})
@app.get('/api/personas')
async def personas():
    return PERSONAS
class NoteInput(BaseModel):
    text: str = Field(max_length=10000)
    revision: int = Field(ge=0)
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
@app.put('/api/notes/{key}')
async def note(key: str, body: NoteInput):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', key):
        raise HTTPException(422, 'Invalid note identifier')
    prior_op = store.get('op:' + body.idempotency_key)
    if prior_op:
        return prior_op
    previous = store.get('note:' + key) or {'revision': 0}
    if body.revision != previous['revision']:
        raise HTTPException(409, {'message': 'Revision conflict. Keep both drafts and resolve explicitly.', 'server': previous})
    saved = {'id': key, 'text': body.text, 'revision': previous['revision'] + 1}
    # One transaction ensures operation result and note revision change together.
    with store.Session.begin() as db:
        for rid, kind in [('note:' + key, 'note'), ('op:' + body.idempotency_key, 'operation')]:
            row = db.get(store.Record, rid)
            if row:
                row.body = json.dumps(saved)
            else:
                db.add(store.Record(id=rid, kind=kind, body=json.dumps(saved)))
    return saved
@app.get('/api/notes/{key}')
async def read_note(key: str):
    return store.get('note:' + key) or {'id': key, 'text': '', 'revision': 0}

@app.get('/api/health')
async def health():
    with store.engine.connect() as db:
        database = db.execute(text('PRAGMA quick_check')).scalar() == 'ok'
    return {'backend': True, 'database': database, 'worker': not app.state.worker.done(), 'active': len(runner.active_tasks), 'queued': sum(j['status'] == 'queued' for j in store.listing('experiment')), 'ollama': await intelligence.status(), 'storage_bytes': sum(p.stat().st_size for p in store.DATA.rglob('*') if p.is_file()), 'artifact_bytes': sum(p.stat().st_size for p in store.ARTIFACTS.rglob('*') if p.is_file()), 'internet': 'Frontend reports navigator.onLine; no internet probe is required for local operation.'}
@app.get('/api/graph')
async def graph():
    g = nx.DiGraph()
    g.add_node('checkout', label='Checkout', kind='feature')
    g.add_node('cart', label='Shopping bag', kind='screen')
    g.add_node('orders', label='POST /checkout', kind='operation')
    g.add_edge('cart', 'checkout', provenance='registered fixture dependency')
    g.add_edge('checkout', 'orders', provenance='registered fixture dependency')
    for scenario in intelligence.SCENARIOS:
        g.add_node(scenario, label=scenario.replace('_', ' '), kind='scenario')
        g.add_edge('checkout', scenario, provenance='reviewed scenario tool registry')
    for job in store.listing('experiment'):
        for result in job.get('results', []):
            if result['status'] == 'failed':
                g.add_node(result['id'], label=f'{result["release"]} / verified failure', kind='failure')
                g.add_edge(result['scenario'], result['id'], provenance='stored assertion ' + result['id'])
    return {'nodes': [{'id': n, **d} for n, d in g.nodes(data=True)], 'edges': [{'source': a, 'target': b, **d} for a, b, d in g.edges(data=True)]}
@app.get('/api/risk')
async def risk():
    jobs = store.listing('experiment')
    history = [r for j in jobs if j['status'] == 'completed' for r in j.get('results', [])]
    model = store.DATA / 'risk-model.joblib'
    return {'ranking': ml.prioritize(history), 'observations': len(history), 'model_trained': model.exists(), 'note': 'Release verdict uses actual assertion regressions. Offline training is available via python -m scripts.train; no probability without validated pre-release features.'}
@app.get('/api/artifacts/{key}/{filename}')
async def artifact(key: str, filename: str):
    if not re.fullmatch(r'EXP-[a-f0-9-]{12}', key) or not re.fullmatch(r'[A-Za-z0-9_.-]+', filename):
        raise HTTPException(404)
    path = store.ARTIFACTS / key / filename
    if not path.is_file() or path.suffix not in ('.png', '.zip', '.json'):
        raise HTTPException(404)
    return FileResponse(path, filename=filename if path.suffix == '.zip' else None)

@app.get('/api/reports/{key}.json')
async def report_json(key: str):
    return JSONResponse(await experiment(key), headers={'Content-Disposition': f'attachment; filename="{key}.json"'})
@app.get('/api/reports/{key}.pdf')
async def report_pdf(key: str):
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor
    from xml.sax.saxutils import escape
    job = await experiment(key)
    stream = io.BytesIO()
    styles = getSampleStyleSheet()
    from .pdf_fonts import register
    register()
    for style in ('Title', 'Heading1', 'Heading2', 'Heading3'):
        styles[style].fontName = 'Playfair'
    styles['Title'].textColor = HexColor('#762E3A')
    styles['BodyText'].fontName = 'Libre'
    styles['BodyText'].fontSize = 9
    styles['BodyText'].leading = 15
    styles.add(ParagraphStyle('Verdict', fontName='Instrument', fontSize=30, leading=34, textColor=HexColor('#762E3A')))
    parts = []
    def para(value, style='BodyText'):
        parts.append(Paragraph(escape(str(value)), styles[style]))
        parts.append(Spacer(1, 10))
    para('PHANTOMLAB / FINDINGS JOURNAL', 'Title')
    para(job['title'], 'Heading1')
    para(job['id'] + ' / ' + job['status'])
    para('Objective: ' + job['objective'])
    para('Atelier Commerce / releases A and B / isolated fake guest sessions')
    para('Environment: ' + json.dumps(job.get('environment', {})))
    para('Readiness: ' + job.get('risk', {}).get('verdict', 'No verdict yet'), 'Heading2')
    para(job.get('risk', {}).get('verdict', 'Investigation incomplete'), 'Verdict')
    para(job.get('risk', {}).get('limitations', 'No risk assessment available.'))
    for r in job.get('results', []):
        para(f'{r["release"]} / {r["scenario"]} / {r["status"]}', 'Heading2')
        para(r.get('assertion', r.get('error', 'Execution incomplete')))
        para('Evidence ID: ' + r['id'])
        para(json.dumps(r['evidence']))
        para('Reproduce: ' + ' → '.join(r.get('reproduction', [])))
        para('Trace: ' + r.get('trace', 'unavailable'))
    for agent in job.get('agents', []):
        para(agent['role'] + ' / ' + agent.get('source', 'unknown'), 'Heading2')
        para(agent.get('summary', agent.get('error', '')))
        para('Uncertainty: ' + agent.get('uncertainty', 'Inference unavailable.'))
    para('Unresolved: a bounded fixture investigation does not establish production readiness. Personas specify test constraints. No production ML accuracy is claimed.')
    SimpleDocTemplate(stream, title=job['title'], author='PhantomLab').build(parts)
    return Response(stream.getvalue(), media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{key}.pdf"'})

fonts = ROOT / 'public' / 'fonts'
fonts.mkdir(parents=True, exist_ok=True)
app.mount('/fonts', StaticFiles(directory=fonts), name='fonts')
@app.get('/{path:path}', include_in_schema=False)
async def frontend(path: str):
    dist = ROOT / 'dist'
    file = (dist / path).resolve()
    if file.is_relative_to(dist) and file.is_file():
        return FileResponse(file)
    if path.startswith(('api/', 'demo/')):
        raise HTTPException(404)
    if (dist / 'index.html').exists():
        return FileResponse(dist / 'index.html')
    raise HTTPException(503, 'Build the frontend with npm run build, or use the Vite development server.')
