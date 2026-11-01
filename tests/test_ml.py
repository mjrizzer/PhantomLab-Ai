import numpy as np
import pandas as pd
import pytest
from backend import ml

def test_errors_do_not_become_verified_regressions():
    a={'release':'A','scenario':'checkout','passed':True,'status':'passed'}
    b={'release':'B','scenario':'checkout','passed':False,'status':'error'}
    assert ml.assess([a,b])['new_regressions'] == 0
    b['status']='failed'
    assert ml.assess([a,b])['new_regressions'] == 1

def test_grouped_training_metrics_and_synthetic_label(tmp_path,monkeypatch):
    monkeypatch.setattr(ml,'DATA',tmp_path)
    rng=np.random.default_rng(42)
    rows=[]
    for family in range(16):
        for release in range(6):
            row={k:float(rng.uniform()) for k in ml.FEATURES}
            row.update(release_family=f'family-{family}',regressed=release%2)
            rows.append(row)
    csv=tmp_path/'synthetic.csv'
    pd.DataFrame(rows).to_csv(csv,index=False)
    result=ml.train(csv,synthetic=True)
    assert result['synthetic'] is True
    assert set(result['train_families']).isdisjoint(result['held_out_families'])
    assert set(result['metrics'])=={'precision','recall','f1','balanced_accuracy'}
    assert (tmp_path/'synthetic-model.joblib').exists()
    assert not (tmp_path/'risk-model.joblib').exists()
    pd.DataFrame(rows[:12]).to_csv(csv,index=False)
    with pytest.raises(ValueError,match='independent release families'):
        ml.train(csv)

def test_anomalies_and_interpretable_ranking():
    assert ml.anomalies([],[])['available'] is False
    history=[{'duration_ms':100+i,'network_failures':0,'redirects':0,'event_count':5} for i in range(25)]
    result=ml.anomalies(history,[{'duration_ms':100000,'network_failures':100,'redirects':20,'event_count':1000}])
    assert result['available'] and result['flags']==[True]
    ranked=ml.prioritize([])
    assert ranked[0]['scenario'] in ('single_checkout','rapid_checkout')
    assert len(ranked)==5
