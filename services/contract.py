"""Public, provider-independent validation contract; exported by the build."""
CONTACT_LIMITS = {"name": 120, "email": 200, "project_type": 50, "budget": 80, "message": 4000}
PROJECT_TYPES = ["ai", "geospatial", "software", "consulting", "other"]
CHAT_MESSAGE_LIMIT = 800
HISTORY_TURNS = 10
