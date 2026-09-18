"""Fail closed on credential patterns/known local secret values; never print values."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [rb'gh[pousr]_[A-Za-z0-9]{30,}', rb'github_pat_[A-Za-z0-9_]{40,}',
            rb'sk-[A-Za-z0-9_-]{24,}', rb'xkeysib-[A-Za-z0-9-]{30,}',
            rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
PUBLIC_NAMES = [b'LLM_API_KEY', b'GITHUB_TOKEN', b'SMTP_PASS', b'DATABASE_URL',
                b'FLASK_SECRET_KEY', b'BREVO_API_KEY', b'CLOUDFLARE_API_TOKEN',
                b'TURNSTILE_SECRET_KEY', b'SESSION_SECRET', b'MAIL_FROM',
                b'CONTACT_TO_EMAIL']

def known_secrets():
    from dotenv import dotenv_values
    # Read locally for comparison only. Values and snippets are never reported.
    values = []
    for path in [ROOT / '.env', ROOT / '.dev.vars']:
        if path.exists():
            for name, value in dotenv_values(path).items():
                if value and len(value) >= 12 and any(x in name for x in ['TOKEN', 'KEY', 'PASS', 'SECRET']):
                    values.append(value.encode())
    return values

def main():
    public = '--public' in sys.argv
    paths = [ROOT / p for p in subprocess.check_output(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT, text=True
    ).splitlines()]
    if public:
        paths = [p for p in (ROOT / 'dist').rglob('*') if p.is_file()]
        if not paths: raise SystemExit('Missing public build')
    secrets = known_secrets()
    failed = []
    for p in paths:
        if not p.is_file(): continue
        data = p.read_bytes()
        if any(re.search(pattern, data) for pattern in PATTERNS) or any(value in data for value in secrets) or (public and any(name in data for name in PUBLIC_NAMES)):
            failed.append(str(p.relative_to(ROOT)))
        if (p.name == '.env' or p.suffix in {'.db', '.sqlite', '.sqlite3'}
                or (p.name.startswith('.dev.vars') and p.name != '.dev.vars.example')):
            failed.append(str(p.relative_to(ROOT)))
    if not public:
        # Scan every committed blob as well as the current tree. Never emit a
        # matching line or value: a historical credential must be rotated.
        seen = set()
        objects = subprocess.check_output(['git', 'rev-list', '--objects', '--all'], cwd=ROOT, text=True)
        for entry in objects.splitlines():
            object_id, _, historical_path = entry.partition(' ')
            if not historical_path or object_id in seen:
                continue
            seen.add(object_id)
            kind = subprocess.run(['git', 'cat-file', '-t', object_id], cwd=ROOT, capture_output=True, text=True)
            if kind.returncode or kind.stdout.strip() != 'blob':
                continue
            data = subprocess.check_output(['git', 'cat-file', '-p', object_id], cwd=ROOT)
            if any(re.search(pattern, data) for pattern in PATTERNS) or any(value in data for value in secrets):
                failed.append(f'history:{historical_path}')
    if failed:
        print('Potential secret/data exposure in files:', ', '.join(sorted(set(failed))))
        raise SystemExit(1)
    print(f'Secret scan passed ({len(paths)} files). No credential values logged.')

if __name__ == '__main__': main()
