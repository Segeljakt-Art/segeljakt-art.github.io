const token = document.querySelector('meta[name="gallery-token"]').content;
const grid = document.querySelector("#gallery-grid");
const inspector = document.querySelector("#inspector");
const notice = document.querySelector("#notice");
const publishButton = document.querySelector("#publish");
const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
let state = { artworks: [], deleted: [], dirty: false };
let selected = null;
let formDirty = false;
let busy = false;
let closing = false;
const labels = { title: "Titel", year: "År", copyright: "Upphovsrätt", painting_number: "Målningsnummer", price: "Pris", medium: "Medium", dimensions: "Dimensioner" };

async function request(path, payload, fileName) {
  const options = { method: "POST", headers: { "X-Gallery-Token": token } };
  if (fileName) {
    options.headers["X-Filename"] = encodeURIComponent(fileName);
    options.body = payload;
  } else {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload || {});
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Något gick fel.");
  return result;
}
function message(text, error = false) {
  notice.textContent = text;
  notice.classList.toggle("error", error);
}
async function action(path, payload, fileName) {
  if (busy) return;
  busy = true;
  publishButton.disabled = true;
  try {
    const next = await request(path, payload, fileName);
    state = next;
    formDirty = false;
    render();
    return true;
  } catch (error) {
    message(error.message, true);
    return false;
  } finally {
    busy = false;
    publishButton.disabled = !state.dirty || Boolean(state.error);
  }
}
function imageUrl(name) { return "/art/" + encodeURIComponent(name); }
function artwork(name) { return state.artworks.find(item => item.name === name); }
function confirmDiscard() {
  return !formDirty || window.confirm("Uppgifterna är inte sparade. Lämna dem utan att spara?");
}
function select(name) {
  if (selected !== name && !confirmDiscard()) return;
  selected = name;
  formDirty = false;
  render();
}
function createButton(text, callback, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (className) button.className = className;
  button.addEventListener("click", callback);
  return button;
}
document.querySelector("#apply-sort").addEventListener("click", async () => {
  if (formDirty && !confirmDiscard()) return;
  const mode = document.querySelector("#manager-sort").value;
  const names = window.artworkSort.sort(state.artworks, item => item.details, mode).map(item => item.name);
  if (names.every((name, index) => name === state.artworks[index].name)) {
    message("Målningarna har redan den ordningen.");
    return;
  }
  if (await action("/api/reorder", { order: names })) message("Ordningen är ändrad. Klicka Publicera när du är klar.");
});

function renderCards() {
  grid.replaceChildren();
  state.artworks.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "art-card" + (selected === item.name ? " selected" : "");
    card.draggable = true;
    card.dataset.name = item.name;
    const main = createButton("", () => select(item.name), "art-card-main");
    const img = document.createElement("img");
    img.src = imageUrl(item.name);
    img.alt = item.details.title || "Ny målning";
    img.draggable = false;
    const title = document.createElement("span");
    title.className = "art-card-title";
    title.textContent = item.details.title || "Ny målning";
    const sub = document.createElement("span");
    sub.className = "art-card-sub";
    sub.textContent = item.details.painting_number || "Ej angivet";
    main.append(img, title, sub);
    const actions = document.createElement("div");
    actions.className = "art-card-actions";
    const badge = document.createElement("span");
    badge.textContent = item.new ? "NY" : `${index + 1} / ${state.artworks.length}`;
    const left = createButton("↑", () => move(index, -1));
    const right = createButton("↓", () => move(index, 1));
    left.setAttribute("aria-label", "Flytta upp " + (item.details.title || item.name));
    right.setAttribute("aria-label", "Flytta ner " + (item.details.title || item.name));
    left.disabled = index === 0;
    right.disabled = index === state.artworks.length - 1;
    actions.append(badge, left, right);
    card.append(main, actions);
    card.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", item.name);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", event => {
      if (event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", event => {
      if (event.dataTransfer.files.length) return;
      event.preventDefault();
      card.classList.remove("drag-over");
      const from = event.dataTransfer.getData("text/plain");
      reorder(from, item.name);
    });
    grid.append(card);
  });
  document.querySelector("#count").textContent = `${state.artworks.length} målningar`;
}
async function move(index, delta) {
  if (formDirty && !confirmDiscard()) return;
  const names = state.artworks.map(item => item.name);
  [names[index], names[index + delta]] = [names[index + delta], names[index]];
  if (await action("/api/reorder", { order: names })) message("Ordningen är ändrad. Klicka Publicera när du är klar.");
}
async function reorder(from, to) {
  if (!from || from === to || (formDirty && !confirmDiscard())) return;
  const names = state.artworks.map(item => item.name);
  const fromIndex = names.indexOf(from);
  const toIndex = names.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return;
  names.splice(fromIndex, 1);
  names.splice(toIndex, 0, from);
  if (await action("/api/reorder", { order: names })) message("Ordningen är ändrad. Klicka Publicera när du är klar.");
}
function renderInspector() {
  inspector.replaceChildren();
  const item = artwork(selected);
  if (!item) {
    inspector.innerHTML = '<div class="inspector-empty"><span>✳</span><h2>Välj en målning</h2><p>Här visas uppgifterna för målningen du väljer.</p></div>';
    inspector.classList.remove("open");
    return;
  }
  inspector.classList.add("open");
  const close = createButton("Stäng ×", () => { if (confirmDiscard()) { selected = null; formDirty = false; render(); } }, "close-inspector text-button");
  const heading = document.createElement("h2");
  heading.textContent = item.details.title || "Ny målning";
  const filename = document.createElement("p");
  filename.className = "filename";
  filename.textContent = item.name;
  const img = document.createElement("img");
  img.src = imageUrl(item.name);
  img.alt = item.details.title || "Ny målning";
  const form = document.createElement("form");
  form.id = "details-form";
  Object.entries(labels).forEach(([key, label]) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.name = key;
    input.value = item.details[key] || "";
    input.maxLength = 500;
    input.required = true;
    if (key === "painting_number") input.readOnly = true;
    else input.addEventListener("input", () => { formDirty = true; message("Uppgifterna är ändrade. Spara dem innan du publicerar."); });
    wrapper.append(input);
    if (key === "painting_number") {
      const hint = document.createElement("small");
      hint.textContent = "Tilldelas automatiskt och kan inte ändras.";
      wrapper.append(hint);
    }
    form.append(wrapper);
  });
  const actions = document.createElement("div");
  actions.className = "inspector-actions";
  const remove = createButton("Ta bort målning", async () => {
    if (!window.confirm(`Ta bort ”${item.details.title || item.name}”? Bilden tas bort från webbplatsen när du publicerar.`)) return;
    if (await action("/api/delete", { name: item.name })) {
      selected = null;
      render();
      message("Målningen har markerats för borttagning. Du kan ångra innan du publicerar.");
    }
  }, "danger");
  const save = createButton("Spara uppgifter", () => form.requestSubmit(), "primary");
  actions.append(remove, save);
  form.append(actions);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const details = Object.fromEntries(new FormData(form));
    if (await action("/api/update", { name: item.name, details })) message("Uppgifterna är sparade lokalt. Klicka Publicera när du är klar.");
  });
  inspector.append(close, heading, filename, img, form);
}
function renderRemoved() {
  const section = document.querySelector("#removed");
  const list = document.querySelector("#removed-list");
  section.hidden = !state.deleted.length;
  list.replaceChildren();
  state.deleted.forEach(name => {
    const row = document.createElement("div");
    row.className = "removed-row";
    const label = document.createElement("span");
    label.textContent = name;
    const restore = createButton("Ångra borttagning", async () => {
      if (await action("/api/restore", { name })) message("Målningen är tillbaka. Publicera när du är klar.");
    });
    row.append(label, restore);
    list.append(row);
  });
}
function render() {
  renderCards();
  renderInspector();
  renderRemoved();
  publishButton.disabled = !state.dirty || Boolean(state.error) || busy;
  if (state.error) message(state.error, true);
  else if (state.pending_push) message("En commit väntar på uppladdning. Klicka Publicera igen.", true);
}
async function addFile(file) {
  if (!file) return;
  if (formDirty && !confirmDiscard()) return;
  if (file.size > 30 * 1024 * 1024) { message("Bilden är för stor (max 30 MB).", true); return; }
  message("Lägger till bilden...");
  if (await action("/api/add", file, file.name)) {
    selected = file.name;
    render();
    message("Bilden är tillagd. Klicka på den och fyll i uppgifterna innan du publicerar.");
  }
}
document.querySelector("#choose").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { addFile(fileInput.files[0]); fileInput.value = ""; });
dropzone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.click(); } });
document.addEventListener("dragover", event => {
  if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); dropzone.classList.add("is-over"); }
});
document.addEventListener("dragleave", event => {
  if (!event.relatedTarget) dropzone.classList.remove("is-over");
});
document.addEventListener("drop", event => {
  if (event.dataTransfer.files.length) {
    event.preventDefault();
    dropzone.classList.remove("is-over");
    addFile(event.dataTransfer.files[0]);
  }
});
publishButton.addEventListener("click", async () => {
  if (formDirty) { message("Spara uppgifterna för den valda målningen först.", true); return; }
  if (!window.confirm("Publicera alla ändringar på webbplatsen?")) return;
  message("Publicerar ändringarna...");
  if (await action("/api/publish", {})) message("Klart! Webbplatsen uppdateras snart på segeljakt-art.github.io.");
});
document.querySelector("#quit").addEventListener("click", async () => {
  if (state.dirty && !window.confirm("Avsluta utan att publicera ändringarna?")) return;
  closing = true;
  await request("/api/quit", {});
  document.body.innerHTML = '<main style="padding:40px;font-family:Arial">Gallerihanteraren är stängd. Du kan stänga fliken.</main>';
});
window.addEventListener("beforeunload", event => { if (state.dirty && !closing) { event.preventDefault(); event.returnValue = ""; } });
fetch("/api/state").then(response => response.json()).then(data => { state = data; render(); }).catch(error => message(error.message, true));
