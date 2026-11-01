import io
import zipfile
import sqlite3
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import httpx
from conftest import wait_job

def test_signature_real_browser_database_evidence(laboratory, signature):
    assert signature['status'] == 'completed', signature.get('error')
    assert len(signature['results']) == 10
    rows = {(r['release'],r['scenario']):r for r in signature['results']}
    assert all(rows['A', s]['passed'] for s in ['single_checkout','rapid_checkout','discount','keyboard','slow_network'])
    assert rows['B','single_checkout']['passed']
    assert all(rows['B',s]['status']=='failed' for s in ['rapid_checkout','discount','keyboard','slow_network'])
    assert rows['A','rapid_checkout']['evidence']['database_count'] == 1
    assert rows['B','rapid_checkout']['evidence']['database_count'] == 2
    assert rows['B','discount']['evidence']['database_orders'][0]['total_cents'] == 4560
    assert signature['risk']['new_regressions'] == 4
    assert signature['risk']['probability'] is None
    client,path,_ = laboratory
    with sqlite3.connect(path / 'laboratory.sqlite') as db:
        for release in ['A','B']:
            for order in rows[release,'rapid_checkout']['evidence']['database_orders']:
                assert db.execute('SELECT total_cents FROM orders WHERE id=?', (order['id'],)).fetchone()[0] == 4800

def test_actual_artifacts_reports_and_graph(laboratory, signature):
    client,_,_ = laboratory
    for row in signature['results']:
        assert len(row['screenshots']) == 2
        for shot in row['screenshots']:
            response = client.get(shot)
            assert response.content.startswith(b'\x89PNG'), response.text[:100] if not response.is_success else ''
        response = client.get(row['trace'])
        with zipfile.ZipFile(io.BytesIO(response.content)) as trace:
            assert any(name.endswith('.trace') for name in trace.namelist())
    pdf = client.get('/api/reports/'+signature['id']+'.pdf')
    assert pdf.content.startswith(b'%PDF')
    assert all(name in pdf.content for name in (b'Playfair',b'LibreBaskerville',b'InstrumentSerif'))
    report = client.get('/api/reports/'+signature['id']+'.json').json()
    assert report['results'] == signature['results']
    graph = client.get('/api/graph').json()
    assert any(e['provenance'].startswith('stored assertion') for e in graph['edges'])

def test_idempotency_validation_and_origin_boundaries(laboratory, signature):
    client,_,_ = laboratory
    same = client.post('/api/experiments', json={'idempotency_key':'automated-signature-test'}).json()
    assert same['id'] == signature['id']
    assert client.post('/api/experiments', json={'idempotency_key':'invalid-scenario','scenarios':['shell']}).status_code == 422
    assert client.post('/api/products', json={'name':'Remote','description':'test','url':'https://example.com','release':'1','category':'test'}).status_code == 422
    assert client.post('/api/products', json={'name':'Credentials','description':'test','url':'http://secret@localhost:1234','release':'1','category':'test'}).status_code == 422
    assert client.post('/api/experiments', json={'idempotency_key':'cross-site-test'}, headers={'Origin':'https://evil.invalid'}).status_code == 403
    assert client.get('/api/products', headers={'Host':'evil.invalid'}).status_code == 403
    assert client.get('/api/artifacts/invalid/private.env').status_code == 404

def test_notes_conflict_and_idempotent_sync(laboratory):
    client,_,_ = laboratory
    note = {'text':'Keep the evidence.','revision':0,'idempotency_key':'note-test-first'}
    first = client.put('/api/notes/test-note',json=note)
    assert first.status_code == 200
    assert client.put('/api/notes/test-note',json=note).json() == first.json()
    assert client.put('/api/notes/test-note',json={**note,'text':'Conflicting','idempotency_key':'note-test-second'}).status_code == 409
    assert client.get('/api/notes/test-note').json()['text'] == 'Keep the evidence.'

def test_ollama_unavailable_is_truthful(laboratory):
    client,_,_ = laboratory
    health = client.get('/api/health').json()
    assert health['ollama']['available'] is False
    assert health['backend'] and health['database'] and health['worker']

def test_checkout_idempotency_at_api_boundary(laboratory):
    client,_,_ = laboratory
    # Independent session; baseline handles concurrent retry even without the UI guard.
    with httpx.Client(base_url=str(client.base_url),trust_env=False) as shop:
        shop.get('/demo/A/api/state')
        shop.put('/demo/A/api/cart',json={'product':'vessel','quantity':1})
        payload={'key':str(uuid.uuid4()),'discount':'STUDIO10','delay_ms':500}
        with ThreadPoolExecutor(max_workers=2) as executor:
            replies=list(executor.map(lambda _:shop.post('/demo/A/api/checkout',json=payload),range(2)))
        assert all(r.status_code==200 for r in replies)
        assert replies[0].json()['id'] == replies[1].json()['id']
        assert len(shop.get('/demo/A/api/state').json()['orders']) == 1

def test_cancel_preserves_terminal_state(laboratory):
    client,_,_ = laboratory
    job=client.post('/api/experiments',json={'idempotency_key':'cancel-real-run','scenarios':['slow_network']}).json()
    client.post('/api/experiments/'+job['id']+'/cancel')
    final=wait_job(client,job['id'])
    assert final['status']=='cancelled'
