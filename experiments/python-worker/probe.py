"""Fallback diagnostic entry: independent package imports and D1 binding probe."""
import importlib
from workers import WorkerEntrypoint, Response

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        results = {}
        for name in ['flask','flask_sqlalchemy','flask_limiter','dotenv','requests','gunicorn','jinja2','sqlite3','smtplib','content']:
            try:
                importlib.import_module(name)
                results[name] = 'import OK'
            except Exception as exc:
                results[name] = type(exc).__name__ + ': ' + str(exc)[:250]
        try:
            row = await self.env.DB.prepare('SELECT 1 AS ok').first()
            results['d1'] = str(row)
        except Exception as exc:
            results['d1'] = type(exc).__name__ + ': ' + str(exc)[:250]
        return Response.json(results)
