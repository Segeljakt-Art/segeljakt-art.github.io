"""Windows GUI for adding a painting to the Segeljakt art gallery."""

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

REPO = Path(__file__).resolve().parent
METADATA = REPO / "_data" / "artworks.json"
ASSETS = REPO / "assets"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}
FIELDS = (
    ("title", "Titel"),
    ("year", "År"),
    ("painting_number", "Målningsnummer"),
    ("price", "Pris, t.ex. 4 500 kr"),
    ("medium", "Medium"),
    ("dimensions", "Dimensioner, t.ex. 50 × 70 cm"),
    ("copyright", "Upphovsrätt"),
)


def git(*args):
    options = {"cwd": REPO, "capture_output": True, "text": True, "encoding": "utf-8", "errors": "replace", "timeout": 180}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW
    result = subprocess.run(["git", *args], **options)
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(f"Git misslyckades ({' '.join(args)}).\n{detail}")
    return result.stdout.strip()


def upload(image, details, report):
    if not (REPO / ".git").exists():
        raise RuntimeError("Programmet måste ligga i den klonade webbplatsens projektmapp.")
    if shutil.which("git") is None:
        raise RuntimeError("Git saknas. Installera Git for Windows och starta om programmet.")
    if git("branch", "--show-current") != "main":
        raise RuntimeError("Byt till grenen main innan du laddar upp.")
    if git("status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("Det finns redan ändrade projektfiler. Spara eller ångra dem först.")

    report("Hämtar senaste versionen...")
    git("fetch", "origin", "main")
    if git("rev-list", "--count", "origin/main..HEAD") != "0":
        raise RuntimeError("Det finns lokala commits som ännu inte har laddats upp. Ladda upp dem först.")
    git("pull", "--ff-only", "origin", "main")

    destination = ASSETS / image.name
    if any(path.name.casefold() == image.name.casefold() for path in ASSETS.iterdir()):
        raise RuntimeError(f"En bild med namnet {image.name} finns redan. Byt namn på den nya filen.")
    data = json.loads(METADATA.read_text(encoding="utf-8-sig"))
    if any(key.casefold() == image.name.casefold() for key in data):
        raise RuntimeError(f"Metadata för {image.name} finns redan. Byt namn på den nya filen.")

    data[image.name] = details
    report("Kopierar bilden och sparar detaljerna...")
    shutil.copy2(image, destination)
    temporary = METADATA.with_suffix(".json.tmp")
    try:
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(METADATA)
    except Exception:
        temporary.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        raise

    report("Publicerar på GitHub...")
    paths = ["_data/artworks.json", f"assets/{image.name}"]
    git("add", "--", *paths)
    git("commit", "--only", "-m", f"Lägg till målning: {details['title']}", "--", *paths)
    git("push", "origin", "main")


class UploadWindow:
    def __init__(self, root):
        self.root = root
        root.title("Segeljakt art – ladda upp målning")
        root.geometry("620x490")
        root.minsize(560, 450)
        root.columnconfigure(0, weight=1)
        self.events = queue.Queue()
        self.image_path = tk.StringVar(value="Ingen bild vald")
        self.status = tk.StringVar(value="Välj en bild och fyll i uppgifterna.")
        self.values = {}
        self.controls = []
        defaults = json.loads(METADATA.read_text(encoding="utf-8-sig"))["_defaults"]

        frame = ttk.Frame(root, padding=20)
        frame.grid(sticky="nsew")
        frame.columnconfigure(1, weight=1)
        ttk.Label(frame, text="Ny målning", font=("Segoe UI", 16, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 12))
        self.choose_button = ttk.Button(frame, text="Välj bild...", command=self.choose_image)
        self.choose_button.grid(row=1, column=0, sticky="w", pady=(0, 12))
        ttk.Label(frame, textvariable=self.image_path, wraplength=420).grid(row=1, column=1, sticky="w", padx=(12, 0), pady=(0, 12))

        for row, (key, label) in enumerate(FIELDS, start=2):
            ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", padx=(0, 14), pady=5)
            value = tk.StringVar(value=defaults.get(key, ""))
            entry = ttk.Entry(frame, textvariable=value)
            entry.grid(row=row, column=1, sticky="ew", pady=5)
            self.values[key] = value
            self.controls.append(entry)
        self.values["title"].set("")

        self.upload_button = ttk.Button(frame, text="Ladda upp målning", command=self.start_upload)
        self.upload_button.grid(row=9, column=1, sticky="e", pady=(18, 8))
        ttk.Label(frame, textvariable=self.status, wraplength=570).grid(row=10, column=0, columnspan=2, sticky="w")
        root.after(100, self.check_events)

    def choose_image(self):
        filename = filedialog.askopenfilename(
            title="Välj målning",
            filetypes=[("Bilder", "*.jpg *.jpeg *.png *.webp *.svg *.gif"), ("Alla filer", "*.*")],
        )
        if filename:
            image = Path(filename)
            self.image_path.set(str(image))

    def start_upload(self):
        image = Path(self.image_path.get())
        if not image.is_file() or image.suffix.lower() not in EXTENSIONS:
            messagebox.showerror("Välj bild", "Välj först en JPG-, PNG-, WebP-, SVG- eller GIF-bild.")
            return
        if image.name.startswith(("_", ".")):
            messagebox.showerror("Filnamn", "Filnamnet får inte börja med _ eller punkt.")
            return
        details = {key: value.get().strip() for key, value in self.values.items()}
        if any(not value for value in details.values()):
            messagebox.showerror("Saknade uppgifter", "Fyll i alla fält. Använd ”Ej angivet” om något är okänt.")
            return
        self.choose_button.state(["disabled"])
        self.upload_button.state(["disabled"])
        for control in self.controls:
            control.state(["disabled"])
        threading.Thread(target=self.worker, args=(image, details), daemon=True).start()

    def worker(self, image, details):
        try:
            upload(image, details, lambda text: self.events.put(("status", text)))
            self.events.put(("success", details["title"]))
        except Exception as exc:
            self.events.put(("error", str(exc)))

    def check_events(self):
        try:
            while True:
                kind, text = self.events.get_nowait()
                if kind == "status":
                    self.status.set(text)
                elif kind == "success":
                    self.status.set(f"Klart! {text} visas snart i Museum.")
                    messagebox.showinfo("Uppladdningen klar", f"{text} har laddats upp.\n\nhttps://segeljakt-art.github.io/#museum")
                    self.root.destroy()
                    return
                else:
                    self.status.set("Uppladdningen misslyckades.")
                    messagebox.showerror("Fel vid uppladdning", text + "\n\nOm en commit redan skapades finns den kvar lokalt. Kör git push origin main när felet är löst.")
                    self.choose_button.state(["!disabled"])
                    self.upload_button.state(["!disabled"])
                    for control in self.controls:
                        control.state(["!disabled"])
        except queue.Empty:
            pass
        self.root.after(100, self.check_events)


if __name__ == "__main__":
    try:
        window = tk.Tk()
        UploadWindow(window)
        window.mainloop()
    except Exception as exc:
        if "window" in locals():
            messagebox.showerror("Programmet kunde inte starta", str(exc))
        else:
            sys.stderr.write(str(exc) + "\n")
