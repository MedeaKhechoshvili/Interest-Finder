"""Export the running code's contract, without starting the server or database.

Run: python scripts/export_openapi.py
Check: python scripts/export_openapi.py --check
"""

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from app.main import create_app  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'openapi.yaml'
    schema = create_app().openapi()
    if args.check:
        if not path.exists() or yaml.safe_load(path.read_text(encoding='utf-8')) != schema:
            raise SystemExit('openapi.yaml differs from the code. Run python scripts/export_openapi.py')
        print('openapi.yaml matches the application.')
    else:
        path.write_text(yaml.safe_dump(schema, sort_keys=False, allow_unicode=True), encoding='utf-8')
        print('Exported openapi.yaml')


if __name__ == '__main__':
    main()
