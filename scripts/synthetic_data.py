"""Generate reproducible illustrative rows, never described as real product history."""
import csv
import random
from pathlib import Path
from backend.ml import FEATURES
random.seed(42)
path=Path('data/synthetic-history.csv');path.parent.mkdir(exist_ok=True)
with path.open('w',newline='',encoding='utf-8') as file:
    writer=csv.DictWriter(file,fieldnames=['release_family',*FEATURES,'regressed','source'])
    writer.writeheader()
    for family in range(20):
        for version in range(8):
            values={'changed_modules':random.randint(0,20),'changed_dependencies':random.randint(0,5),'prior_failure_rate':random.random()*.5,'instability':random.random()*.3,'coverage':random.uniform(.2,1),'prior_regressions':random.randint(0,6),'prior_performance_delta':random.uniform(-.2,.6)}
            outcome=int(values['prior_failure_rate']+values['instability']+random.uniform(-.2,.2)>.35)
            writer.writerow({'release_family':f'synthetic-product-{family}',**values,'regressed':outcome,'source':'SYNTHETIC — NOT REAL RELEASE HISTORY'})
print(path)
