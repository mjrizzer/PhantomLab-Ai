"""Usage: python -m scripts.train path/to/history.csv [--synthetic]"""
import argparse
import json
from pathlib import Path
from backend.ml import train
parser = argparse.ArgumentParser()
parser.add_argument('csv', type=Path)
parser.add_argument('--synthetic', action='store_true')
args = parser.parse_args()
print(json.dumps(train(args.csv, args.synthetic), indent=2))
