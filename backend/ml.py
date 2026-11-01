"""Honest baselines: no trained prediction until meaningful, grouped history exists."""
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import precision_score, recall_score, f1_score, balanced_accuracy_score
from .store import DATA

FEATURES = ['changed_modules', 'changed_dependencies', 'prior_failure_rate', 'instability', 'coverage', 'prior_regressions', 'prior_performance_delta']
def train(csv_path: Path, synthetic=False):
    df = pd.read_csv(csv_path)
    required = FEATURES + ['release_family', 'regressed']
    if not set(required).issubset(df.columns):
        raise ValueError('Missing training columns: ' + ', '.join(required))
    if len(df) < 40 or df.release_family.nunique() < 8:
        raise ValueError('Need at least 40 observations and 8 independent release families')
    if not np.isfinite(df[FEATURES].to_numpy(dtype=float)).all():
        raise ValueError('Non-finite training features')
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=42).split(df, groups=df.release_family))
    if df.iloc[train_idx].regressed.nunique() < 2 or df.iloc[test_idx].regressed.nunique() < 2:
        raise ValueError('Both labels must occur in training and held-out groups')
    model = RandomForestClassifier(n_estimators=120, max_depth=5, min_samples_leaf=3, class_weight='balanced', random_state=42, n_jobs=1)
    model.fit(df.iloc[train_idx][FEATURES], df.iloc[train_idx].regressed)
    pred = model.predict(df.iloc[test_idx][FEATURES])
    truth = df.iloc[test_idx].regressed
    metrics = {'precision': precision_score(truth, pred, zero_division=0), 'recall': recall_score(truth, pred, zero_division=0), 'f1': f1_score(truth, pred, zero_division=0), 'balanced_accuracy': balanced_accuracy_score(truth, pred)}
    info = {'metrics': metrics, 'synthetic': synthetic, 'rows': len(df), 'train_families': df.iloc[train_idx].release_family.unique().tolist(), 'held_out_families': df.iloc[test_idx].release_family.unique().tolist(), 'features': FEATURES, 'importance': dict(zip(FEATURES, model.feature_importances_.tolist())), 'limitations': 'Grouped holdout, small baseline. Inputs must be known before the outcome. Synthetic evaluation is not evidence of real-world accuracy.'}
    joblib.dump({'model': model, 'info': info}, DATA / ('synthetic-model.joblib' if synthetic else 'risk-model.joblib'))
    return info
def assess(results):
    baseline = {r['scenario']: r for r in results if r['release'] == 'A'}
    new = [r for r in results if r['release'] == 'B' and r['status'] == 'failed' and baseline.get(r['scenario'], {}).get('passed')]
    return {'mode': 'deterministic fallback', 'verdict': 'Hold release' if new else 'Review coverage', 'new_regressions': len(new), 'probability': None, 'confidence': None, 'reason': f'{len(new)} verified baseline-to-candidate regressions in this experiment.', 'limitations': 'No trained production risk estimate: insufficient independent release history. This verdict is a rule over assertions, not a probability or prediction accuracy.'}
def anomalies(history, current):
    if len(history) < 20:
        return {'available': False, 'reason': 'Need 20 prior completed executions. An anomaly alone does not establish a defect.'}
    keys = ['duration_ms', 'network_failures', 'redirects', 'event_count']
    x = np.array([[r.get(k, 0) for k in keys] for r in history])
    forest = IsolationForest(n_estimators=100, random_state=42, contamination='auto', n_jobs=1).fit(x)
    y = np.array([[r.get(k, 0) for k in keys] for r in current])
    return {'available': True, 'flags': (forest.predict(y) == -1).tolist(), 'scores': forest.decision_function(y).tolist(), 'reason': 'Unusual execution patterns, not verified software defects.'}
def prioritize(history):
    from .intelligence import SCENARIOS
    ranked = []
    for scenario in SCENARIOS:
        runs = [r for r in history if r['scenario'] == scenario]
        failures = sum(not r['passed'] for r in runs)
        criticality = 3 if 'checkout' in scenario else 2
        score = criticality * 2 + (failures / len(runs) * 4 if runs else 2)
        ranked.append({'scenario': scenario, 'score': round(score, 2), 'reason': f'Criticality {criticality}/3; {failures} failures in {len(runs)} observations; untested bonus 2.'})
    return sorted(ranked, key=lambda r: r['score'], reverse=True)
