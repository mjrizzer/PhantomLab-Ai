import os
import subprocess
import sys
import time
from pathlib import Path
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
@pytest.fixture(scope='session')
def laboratory(tmp_path_factory):
    path = tmp_path_factory.mktemp('laboratory')
    env = {**os.environ, 'PHANTOM_DATA': str(path), 'PHANTOM_PORT': '8877', 'OLLAMA_URL': 'http://127.0.0.1:1'}
    log = (path / 'server.log').open('w')
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8877'], cwd=ROOT, env=env, stdout=log, stderr=log)
    base = 'http://127.0.0.1:8877'
    client = httpx.Client(base_url=base, timeout=15, trust_env=False)
    for _ in range(120):
        try:
            if client.get('/api/products').status_code == 200:
                break
        except httpx.HTTPError:
            pass
        if process.poll() is not None:
            pytest.fail((path / 'server.log').read_text())
        time.sleep(.25)
    else:
        process.terminate()
        pytest.fail('Test backend failed to start')
    yield client, path, process
    client.close()
    if process.poll() is None:
        process.terminate()
        process.wait(timeout=15)
    log.close()

def wait_job(client, key, timeout=180):
    started = time.monotonic()
    while time.monotonic()-started < timeout:
        job = client.get('/api/experiments/'+key).json()
        if job['status'] not in ('queued', 'running'):
            return job
        time.sleep(.5)
    pytest.fail('Experiment timed out: '+key)

@pytest.fixture(scope='session')
def signature(laboratory):
    client, _, _ = laboratory
    response = client.post('/api/experiments', json={'idempotency_key': 'automated-signature-test', 'mode': 'manual'})
    assert response.status_code == 202, response.text
    return wait_job(client, response.json()['id'])
