"""Make a source-only isolated spike; never copy .env, DBs or production secrets."""
from pathlib import Path
import json
import shutil
ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / '.artifacts/python-spike'
DEST.mkdir(parents=True, exist_ok=True)
for name in ['app.py','config.py','content.py','models.py','extensions.py']:
    shutil.copyfile(ROOT / name, DEST / name)
for name in ['blueprints','services','templates','static']:
    shutil.copytree(ROOT / name, DEST / name, dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
for name in ['entry.py','pyproject.toml','probe.py']:
    shutil.copyfile(Path(__file__).parent / name, DEST / name)
(DEST / 'wrangler.jsonc').write_text(json.dumps({
    'name':'portfolio-python-spike', 'main':'entry.py', 'compatibility_date':'2026-09-01',
    'compatibility_flags':['python_workers'],
    'd1_databases':[{'binding':'DB','database_name':'spike','database_id':'00000000-0000-0000-0000-000000000001'}],
    'rules':[{'type':'Text','globs':['**/*.html'], 'fallthrough':True}],
}), encoding='utf8')
print('Prepared isolated source-only spike in .artifacts/python-spike')
