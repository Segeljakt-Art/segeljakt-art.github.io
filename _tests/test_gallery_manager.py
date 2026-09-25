"""Exercise gallery edits against a disposable local Git remote."""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "_manager" / "server.py"
SPEC = importlib.util.spec_from_file_location("gallery_manager", SOURCE)
manager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manager)


def git(folder, *args):
    return subprocess.run(["git", *args], cwd=folder, check=True, capture_output=True, text=True).stdout.strip()


class GalleryManagerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        base = Path(self.temporary.name)
        remote = base / "remote.git"
        self.repo = base / "site"
        self.repo.mkdir()
        git(base, "init", "--bare", str(remote))
        git(self.repo, "init", "-b", "main")
        git(self.repo, "config", "user.name", "Test")
        git(self.repo, "config", "user.email", "test@example.com")
        (self.repo / "assets").mkdir()
        (self.repo / "_data").mkdir()
        (self.repo / "assets" / "first.jpg").write_bytes(b"\xff\xd8\xfffirst")
        (self.repo / "assets" / "second.jpg").write_bytes(b"\xff\xd8\xffsecond")
        data = {
            "_defaults": {"year": "Ej angivet", "copyright": "Andreas Segeljakt", "painting_number": "Ej angivet", "price": "Ej angivet", "medium": "Ej angivet", "dimensions": "Ej angivet"},
            "_order": ["first.jpg", "second.jpg"],
            "first.jpg": {"title": "Första"},
            "second.jpg": {"title": "Andra"},
        }
        (self.repo / "_data" / "artworks.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "Initial")
        git(self.repo, "remote", "add", "origin", str(remote))
        git(self.repo, "push", "-u", "origin", "main")
        manager.ROOT = self.repo
        manager.ASSETS = self.repo / "assets"
        manager.DATA = self.repo / "_data" / "artworks.json"
        self.session = manager.GallerySession()
        self.addCleanup(self.session.temporary.cleanup)
        self.assertIsNone(self.session.error)

    def test_add_edit_reorder_restore_and_publish(self):
        self.session.add("new.png", b"\x89PNG\r\n\x1a\nnew")
        details = {"title": "Ny målning", "year": "2026", "copyright": "Andreas Segeljakt", "painting_number": "3", "price": "500 kr", "medium": "Olja", "dimensions": "20 × 30 cm"}
        self.session.update("new.png", details)
        self.session.reorder(["new.png", "first.jpg", "second.jpg"])
        self.session.delete("first.jpg")
        self.session.restore("first.jpg")
        self.assertEqual(self.session.order, ["new.png", "first.jpg", "second.jpg"])
        self.session.delete("second.jpg")
        self.session.publish()
        saved = json.loads(manager.DATA.read_text(encoding="utf-8"))
        self.assertEqual(saved["_order"], ["new.png", "first.jpg"])
        self.assertEqual(saved["new.png"], details)
        self.assertFalse((manager.ASSETS / "second.jpg").exists())
        self.assertTrue((manager.ASSETS / "new.png").exists())
        self.assertEqual(git(self.repo, "rev-list", "--count", "origin/main..HEAD"), "0")
        self.assertFalse(self.session.state()["dirty"])

    def test_reject_duplicate_and_missing_title(self):
        with self.assertRaises(manager.GalleryError):
            self.session.add("first.jpg", b"\xff\xd8\xffagain")
        self.session.add("new.png", b"\x89PNG\r\n\x1a\nnew")
        with self.assertRaises(manager.GalleryError):
            self.session.publish()
        self.assertFalse((manager.ASSETS / "new.png").exists())

    def test_new_paintings_receive_stable_sequential_numbers(self):
        data = json.loads(manager.DATA.read_text(encoding="utf-8"))
        data["first.jpg"]["painting_number"] = "10"
        data["second.jpg"]["painting_number"] = "1"
        manager.DATA.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        git(self.repo, "add", "_data/artworks.json")
        git(self.repo, "commit", "-m", "Add existing numbers")
        git(self.repo, "push", "origin", "main")
        self.session.load()
        self.session.base_commit = git(self.repo, "rev-parse", "HEAD")
        self.session.add("new.png", b"\x89PNG\r\n\x1a\nnew")
        self.assertEqual(self.session.entries["new.png"]["painting_number"], "11")
        self.session.add("discarded.png", b"\x89PNG\r\n\x1a\nother")
        self.assertEqual(self.session.entries["discarded.png"]["painting_number"], "12")
        self.session.delete("discarded.png")
        self.session.add("another.png", b"\x89PNG\r\n\x1a\nlast")
        self.assertEqual(self.session.entries["another.png"]["painting_number"], "13")
        self.session.entries["new.png"]["title"] = "Ny"
        self.session.entries["another.png"]["title"] = "En till"
        self.session.publish()
        saved = json.loads(manager.DATA.read_text(encoding="utf-8"))
        self.assertEqual(saved["_next_painting_number"], 14)
        self.session.add("later.png", b"\x89PNG\r\n\x1a\nlater")
        self.assertEqual(self.session.entries["later.png"]["painting_number"], "14")


if __name__ == "__main__":
    unittest.main()
