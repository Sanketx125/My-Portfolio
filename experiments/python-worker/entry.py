"""Literal minimal wrapper under test. Never point this at real credentials/data."""
from workers import wsgi
from app import app
Default = wsgi.entrypoint(app)
