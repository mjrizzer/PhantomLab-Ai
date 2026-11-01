"""Verify real Ollama evidence; never substituted by mocks. Backend must be running."""
import argparse
import json
import time
import uuid
import httpx

parser=argparse.ArgumentParser()
parser.add_argument('--experiment',help='Verify an existing actual local AI run instead of starting a new one')
args=parser.parse_args()
with httpx.Client(base_url='http://127.0.0.1:8765',timeout=15,trust_env=False) as client:
    health=client.get('/api/health').json()
    assert health['ollama']['available'],'Install/start the selected local Ollama model first.'
    if args.experiment:
        key=args.experiment
    else:
        response=client.post('/api/experiments',json={'mode':'ai','idempotency_key':str(uuid.uuid4())})
        response.raise_for_status();key=response.json()['id']
    for _ in range(450):
        job=client.get('/api/experiments/'+key).json()
        if job['status'] not in ('queued','running'):break
        time.sleep(2)
    assert job['status']=='completed',job.get('error',job['status'])
    expected={'Investigator','Explorer','Scenario Architect','Experiment Operator','Evidence Analyst','Release Analyst'}
    assert {a['role'] for a in job['agents'] if a['source']=='ollama'}==expected,job['agents']
    rows={(r['release'],r['scenario']):r for r in job['results']}
    assert rows['A','rapid_checkout']['evidence']['database_count']==1
    assert rows['B','rapid_checkout']['evidence']['database_count']==2
    assert job['risk']['verdict']=='Hold release'
    print(json.dumps({'experiment':key,'roles_verified':6,'executions':len(job['results']),'new_regressions':job['risk']['new_regressions'],'mode':job['risk']['mode']},indent=2))
