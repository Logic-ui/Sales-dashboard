import sys
import os
from urllib.parse import parse_qs, urlencode, unquote

# Ensure root and backend directories can be imported properly on Vercel Serverless
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.app.main import app as fastapi_app


class VercelPathFixMiddleware:
    """
    On Vercel, URL rewrites to /api/index.py cause ASGI scope['path'] to be
    rewritten to '/api/index.py'. This prevents FastAPI routers from matching
    endpoints like /api/auth/register, triggering 405 Method Not Allowed.
    
    This middleware intercepts the request and restores the original requested
    path from proxy headers (x-forwarded-uri, x-matched-path) or query parameter
    (__path__), ensuring FastAPI receives the correct route.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            current_path = scope.get("path", "")
            # Only adjust when Vercel rewrote the incoming path to the function entrypoint
            if current_path in (
                "/api/index.py",
                "/api/index",
                "/api/index.py/",
                "/api/index/",
                "api/index.py",
                "api/index",
            ):
                headers = dict(scope.get("headers", []))
                orig_path = None

                # 1. Check proxy headers populated by Vercel's edge network
                for header_key in (
                    b"x-forwarded-uri",
                    b"x-now-route-matches",
                    b"x-matched-path",
                    b"x-invoke-path",
                ):
                    val = headers.get(header_key)
                    if val:
                        decoded = val.decode("utf-8", errors="ignore").strip()
                        if decoded and not decoded.startswith("/api/index.py"):
                            orig_path = decoded
                            break

                # 2. Check query string for captured path passed via ?__path__=
                qs_bytes = scope.get("query_string", b"")
                if qs_bytes:
                    qs_str = qs_bytes.decode("utf-8", errors="ignore")
                    qs_dict = parse_qs(qs_str, keep_blank_values=True)
                    if "__path__" in qs_dict and qs_dict["__path__"]:
                        if not orig_path:
                            orig_path = qs_dict["__path__"][0]
                        # Remove internal __path__ parameter so endpoint sees clean query params
                        del qs_dict["__path__"]
                        scope["query_string"] = urlencode(qs_dict, doseq=True).encode("utf-8")

                # 3. Apply the recovered path to ASGI scope
                if orig_path:
                    clean_path = unquote(orig_path.split("?")[0])
                    # Ensure path begins with /api (unless it's docs or openapi)
                    if (
                        not clean_path.startswith("/api")
                        and not clean_path.startswith("/docs")
                        and not clean_path.startswith("/openapi.json")
                    ):
                        clean_path = "/api" + (clean_path if clean_path.startswith("/") else f"/{clean_path}")
                    scope["path"] = clean_path
                    scope["raw_path"] = clean_path.encode("utf-8")

        await self.app(scope, receive, send)


app = VercelPathFixMiddleware(fastapi_app)
