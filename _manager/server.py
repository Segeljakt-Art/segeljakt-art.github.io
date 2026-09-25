"""Local, cross-platform browser editor for the Segeljakt art repository."""

import json
import mimetypes
import secrets
import shutil
import subprocess
import tempfile
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
DATA = ROOT / "_data" / "artworks.json"
HERE = Path(__file__).resolve().parent
FIELDS = ("title", "year", "copyright", "painting_number", "price", "medium", "dimensions")
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
UPLOAD_EXTENSIONS = EXTENSIONS - {".svg"}
MAX_IMAGE_BYTES = 30 * 1024 * 1024


class GalleryError(Exception):
    pass


def git(*args):
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=180,
        **({"creationflags": subprocess.CREATE_NO_WINDOW} if hasattr(subprocess, "CREATE_NO_WINDOW") else {}),
    )
    if result.returncode:
        raise GalleryError((result.stderr or result.stdout).strip() or f"Git misslyckades: {' '.join(args)}")
    return result.stdout.strip()


def image_is_valid(name, content):
    extension = Path(name).suffix.lower()
    if extension not in UPLOAD_EXTENSIONS:
        return False
    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".gif":
        return content.startswith((b"GIF87a", b"GIF89a"))
    if extension == ".webp":
        return content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False


class GallerySession:
    def __init__(self):
        self.lock = threading.RLock()
        self.temporary = tempfile.TemporaryDirectory(prefix="segeljakt-manager-")
        self.new_files = {}
        self.deleted = set()
        self.deleted_positions = {}
        self.dirty = False
        self.pending_push = False
        self.error = None
        try:
            self.sync()
            self.load()
        except Exception as exc:
            self.error = str(exc)
            self.data = {"_defaults": {}}
            self.entries = {}
            self.order = []

    def sync(self):
        if shutil.which("git") is None:
            raise GalleryError("Git saknas. Installera Git och starta om gallerihanteraren.")
        if not (ROOT / ".git").exists():
            raise GalleryError("Öppna programmet från den klonade projektmappen.")
        if git("branch", "--show-current") != "main":
            raise GalleryError("Byt till grenen main innan du startar programmet.")
        if git("status", "--porcelain", "--untracked-files=no"):
            raise GalleryError("Projektet har lokala ändringar. Spara eller ångra dem innan du startar programmet.")
        git("fetch", "origin", "main")
        if git("rev-list", "--count", "origin/main..HEAD") != "0":
            raise GalleryError("Lokala commits väntar på uppladdning. Kör git push origin main först.")
        git("pull", "--ff-only", "origin", "main")
        self.base_commit = git("rev-parse", "HEAD")

    def load(self):
        self.data = json.loads(DATA.read_text(encoding="utf-8-sig"))
        files = {path.name for path in ASSETS.iterdir() if path.is_file() and path.suffix.lower() in EXTENSIONS and not path.name.startswith(('_', '.'))}
        saved_order = self.data.get("_order", [])
        self.order = [name for name in saved_order if name in files]
        self.order.extend(sorted(files - set(self.order), key=str.casefold))
        defaults = self.data.get("_defaults", {})
        self.entries = {}
        for name in self.order:
            info = self.data.get(name, {})
            self.entries[name] = {key: str(info.get(key, defaults.get(key, ""))) for key in FIELDS}
            self.entries[name]["title"] = str(info.get("title") or "Utan titel")

    def state(self):
        with self.lock:
            return {
                "artworks": [{"name": name, "details": self.entries[name], "new": name in self.new_files} for name in self.order],
                "deleted": sorted(self.deleted),
                "dirty": self.dirty,
                "pending_push": self.pending_push,
                "error": self.error,
            }

    def add(self, name, content):
        with self.lock:
            if self.error:
                raise GalleryError(self.error)
            if self.pending_push:
                raise GalleryError("Slutför den väntande uppladdningen först.")
            if not name or name != Path(name).name or "\\" in name or name.startswith(("_", ".")):
                raise GalleryError("Ogiltigt filnamn.")
            if len(content) > MAX_IMAGE_BYTES or not image_is_valid(name, content):
                raise GalleryError("Välj en JPG-, PNG-, WebP- eller GIF-bild under 30 MB.")
            if any(existing.casefold() == name.casefold() for existing in self.entries):
                raise GalleryError("En bild med samma filnamn finns redan.")
            if (ASSETS / name).exists():
                raise GalleryError("Filnamnet används redan i projektet.")
            target = Path(self.temporary.name) / name
            target.write_bytes(content)
            defaults = self.data.get("_defaults", {})
            self.entries[name] = {key: str(defaults.get(key, "")) for key in FIELDS}
            self.entries[name]["title"] = ""
            self.new_files[name] = target
            self.order.append(name)
            self.dirty = True
            return self.state()

    def update(self, name, details):
        with self.lock:
            if name not in self.order or self.pending_push:
                raise GalleryError("Målningen kan inte redigeras.")
            if not isinstance(details, dict) or any(key not in details for key in FIELDS):
                raise GalleryError("Alla uppgifter måste finnas med.")
            cleaned = {key: str(details[key]).strip() for key in FIELDS}
            if any(not value or len(value) > 500 for value in cleaned.values()):
                raise GalleryError("Fyll i alla fält. Använd ”Ej angivet” om något är okänt.")
            self.entries[name] = cleaned
            self.dirty = True
            return self.state()

    def reorder(self, names):
        with self.lock:
            if self.pending_push or not isinstance(names, list) or len(names) != len(self.order) or set(names) != set(self.order):
                raise GalleryError("Ogiltig ordning.")
            self.order = names
            self.dirty = True
            return self.state()

    def delete(self, name):
        with self.lock:
            if name not in self.order or self.pending_push:
                raise GalleryError("Målningen finns inte.")
            self.deleted_positions[name] = self.order.index(name)
            self.order.remove(name)
            if name in self.new_files:
                self.new_files.pop(name).unlink(missing_ok=True)
                self.entries.pop(name)
                self.deleted_positions.pop(name, None)
            else:
                self.deleted.add(name)
            self.dirty = True
            return self.state()

    def restore(self, name):
        with self.lock:
            if name not in self.deleted or self.pending_push:
                raise GalleryError("Målningen kan inte återställas.")
            self.deleted.remove(name)
            position = self.deleted_positions.pop(name, len(self.order))
            self.order.insert(min(position, len(self.order)), name)
            self.dirty = True
            return self.state()

    def publish(self):
        with self.lock:
            if self.error:
                raise GalleryError(self.error)
            if self.pending_push:
                git("push", "origin", "main")
                self.pending_push = False
                self.base_commit = git("rev-parse", "HEAD")
                self.load()
                self.new_files.clear()
                self.deleted.clear()
                self.deleted_positions.clear()
                self.dirty = False
                return self.state()
            if not self.dirty:
                return self.state()
            for name in self.order:
                if not self.entries[name]["title"].strip():
                    raise GalleryError("Ange en titel för varje ny målning innan publicering.")
            if git("status", "--porcelain", "--untracked-files=no"):
                raise GalleryError("Projektet har ändrats utanför programmet. Starta om gallerihanteraren.")
            git("fetch", "origin", "main")
            if git("rev-parse", "origin/main") != self.base_commit:
                raise GalleryError("Någon har uppdaterat projektet. Starta om programmet så att den senaste versionen hämtas.")
            updated = dict(self.data)
            for name in self.deleted:
                updated.pop(name, None)
            for name in self.order:
                updated[name] = dict(self.entries[name])
            updated["_order"] = list(self.order)
            for name, source in self.new_files.items():
                shutil.copy2(source, ASSETS / name)
            for name in self.deleted:
                (ASSETS / name).unlink()
            temporary_data = DATA.with_suffix(".json.tmp")
            temporary_data.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary_data.replace(DATA)
            paths = ["_data/artworks.json"] + [f"assets/{name}" for name in self.new_files] + [f"assets/{name}" for name in self.deleted]
            git("add", "-A", "--", *paths)
            if not git("diff", "--cached", "--name-only"):
                self.dirty = False
                return self.state()
            git("commit", "-m", "Update gallery paintings")
            self.pending_push = True
            git("push", "origin", "main")
            self.pending_push = False
            self.base_commit = git("rev-parse", "HEAD")
            self.data = updated
            self.load()
            self.new_files.clear()
            self.deleted.clear()
            self.deleted_positions.clear()
            self.dirty = False
            return self.state()


SESSION = None
TOKEN = secrets.token_urlsafe(32)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_bytes(self, status, content, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob:; object-src 'none'")
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status, value):
        self.send_bytes(status, json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def allowed_host(self):
        return self.headers.get("Host", "").split(":")[0] in {"127.0.0.1", "localhost"}

    def do_GET(self):
        if not self.allowed_host():
            self.send_json(403, {"error": "Ogiltig adress."})
            return
        path = urlparse(self.path).path
        if path == "/":
            html = (HERE / "manager.html").read_text(encoding="utf-8").replace("__TOKEN__", TOKEN)
            self.send_bytes(200, html.encode("utf-8"), "text/html; charset=utf-8")
        elif path in {"/manager.css", "/manager.js", "/artwork-sort.js"}:
            file = ROOT / "artwork-sort.js" if path == "/artwork-sort.js" else HERE / path[1:]
            self.send_bytes(200, file.read_bytes(), "text/css; charset=utf-8" if path.endswith(".css") else "text/javascript; charset=utf-8")
        elif path == "/api/state":
            self.send_json(200, SESSION.state())
        elif path.startswith("/art/"):
            name = unquote(path[5:])
            if name not in SESSION.entries or (name not in SESSION.order and name not in SESSION.deleted):
                self.send_json(404, {"error": "Bilden finns inte."})
                return
            source = SESSION.new_files.get(name) or ASSETS / name
            if not source.is_file():
                self.send_json(404, {"error": "Bilden finns inte."})
                return
            kind = mimetypes.guess_type(name)[0] or "application/octet-stream"
            self.send_bytes(200, source.read_bytes(), kind)
        else:
            self.send_json(404, {"error": "Sidan finns inte."})

    def do_POST(self):
        if not self.allowed_host():
            self.send_json(403, {"error": "Ogiltig adress."})
            return
        if self.headers.get("X-Gallery-Token") != TOKEN:
            self.send_json(403, {"error": "Ogiltig session."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > MAX_IMAGE_BYTES + 1024:
                raise GalleryError("Filen är för stor.")
            content = self.rfile.read(length)
            path = urlparse(self.path).path
            if path == "/api/add":
                name = unquote(self.headers.get("X-Filename", ""))
                result = SESSION.add(name, content)
            else:
                payload = json.loads(content.decode("utf-8")) if content else {}
                if path == "/api/update":
                    result = SESSION.update(payload.get("name"), payload.get("details"))
                elif path == "/api/reorder":
                    result = SESSION.reorder(payload.get("order"))
                elif path == "/api/delete":
                    result = SESSION.delete(payload.get("name"))
                elif path == "/api/restore":
                    result = SESSION.restore(payload.get("name"))
                elif path == "/api/publish":
                    result = SESSION.publish()
                elif path == "/api/quit":
                    self.send_json(200, {"ok": True})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                else:
                    raise GalleryError("Okänt kommando.")
            self.send_json(200, result)
        except (GalleryError, ValueError, OSError, subprocess.TimeoutExpired) as exc:
            self.send_json(400, {"error": str(exc)})


def main():
    global SESSION
    SESSION = GallerySession()
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Gallerihanteraren: {url}")
    webbrowser.open(url)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        SESSION.temporary.cleanup()


if __name__ == "__main__":
    main()
