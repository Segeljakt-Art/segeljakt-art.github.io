const slides = [...document.querySelectorAll("#museum-scroll figure")].map(figure => {
  const image = figure.querySelector("img");
  return {
    image: image.getAttribute("src"),
    alt: image.alt,
    title: figure.querySelector(".artwork-title").textContent.trim()
  };
});

const track = document.querySelector("#painting-track");
const images = [...track.querySelectorAll(".painting")];
const paintingWrap = document.querySelector(".painting-wrap");
const slideshow = document.querySelector(".slideshow");
const swipeArea = document.querySelector(".artwork-stage");
const gallery = document.querySelector("#gallery");
const title = document.querySelector("#slide-title");
const indexLabel = document.querySelector("#slide-index");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const autoDelay = 7000;
const slideDuration = 500;
let currentSlide = 0;
let autoTimer;
let transitioning = false;
let drag = null;

function wrappedIndex(index) {
  return (index + slides.length) % slides.length;
}

function renderSlide() {
  if (!slides.length) {
    images.forEach(image => { image.removeAttribute("src"); image.alt = ""; });
    title.textContent = "Inga målningar ännu";
    indexLabel.textContent = "00 / 00";
    return;
  }
  [currentSlide - 1, currentSlide, currentSlide + 1].forEach((index, position) => {
    const slide = slides[wrappedIndex(index)];
    images[position].src = slide.image;
    images[position].alt = position === 1 ? slide.alt : "";
  });
  const slide = slides[currentSlide];
  title.textContent = slide.title;
  indexLabel.textContent = `${String(currentSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
}

function setTrackOffset(offset, animate) {
  track.style.transitionDuration = animate && !reducedMotion.matches ? "" : "0s";
  track.style.transform = `translate3d(-100%, 0, 0) translate3d(${offset}px, 0, 0)`;
}

function scheduleAuto() {
  window.clearTimeout(autoTimer);
  if (!slides.length || document.hidden || !gallery.classList.contains("is-current") || drag) return;
  autoTimer = window.setTimeout(() => moveSlide(1), autoDelay);
}

function moveSlide(direction) {
  if (!slides.length || transitioning) return;
  window.clearTimeout(autoTimer);
  if (reducedMotion.matches) {
    currentSlide = wrappedIndex(currentSlide + direction);
    renderSlide();
    setTrackOffset(0, false);
    scheduleAuto();
    return;
  }

  transitioning = true;
  const destination = direction > 0 ? -paintingWrap.clientWidth : paintingWrap.clientWidth;
  window.requestAnimationFrame(() => {
    setTrackOffset(destination, true);
    window.setTimeout(() => {
      currentSlide = wrappedIndex(currentSlide + direction);
      renderSlide();
      setTrackOffset(0, false);
      transitioning = false;
      scheduleAuto();
    }, slideDuration + 30);
  });
}

function endDrag(cancelled) {
  if (!drag) return;
  const offset = drag.offset;
  const horizontal = drag.axis === "horizontal";
  drag = null;
  swipeArea.classList.remove("is-dragging");
  const threshold = Math.min(90, Math.max(32, paintingWrap.clientWidth * .14));
  if (!cancelled && horizontal && Math.abs(offset) >= threshold) {
    moveSlide(offset < 0 ? 1 : -1);
  } else {
    setTrackOffset(0, true);
    scheduleAuto();
  }
}

slideshow.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") { event.preventDefault(); moveSlide(-1); }
  if (event.key === "ArrowRight") { event.preventDefault(); moveSlide(1); }
});
swipeArea.addEventListener("pointerdown", event => {
  if (!slides.length || transitioning || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
  window.clearTimeout(autoTimer);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: 0, axis: null };
  swipeArea.setPointerCapture(event.pointerId);
});
swipeArea.addEventListener("pointermove", event => {
  if (!drag || event.pointerId !== drag.id) return;
  const deltaX = event.clientX - drag.x;
  const deltaY = event.clientY - drag.y;
  if (!drag.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 5) {
    drag.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.1 ? "horizontal" : "vertical";
  }
  if (drag.axis !== "horizontal") return;
  swipeArea.classList.add("is-dragging");
  drag.offset = Math.max(-paintingWrap.clientWidth, Math.min(paintingWrap.clientWidth, deltaX));
  setTrackOffset(drag.offset, false);
});
swipeArea.addEventListener("pointerup", event => {
  if (drag && event.pointerId === drag.id) endDrag(false);
});
swipeArea.addEventListener("pointercancel", event => {
  if (drag && event.pointerId === drag.id) endDrag(true);
});
document.addEventListener("visibilitychange", scheduleAuto);
reducedMotion.addEventListener("change", scheduleAuto);

const museumScroll = document.querySelector("#museum-scroll");
const museumOriginalOrder = [...museumScroll.querySelectorAll("figure")];
document.querySelector("#museum-sort").addEventListener("change", event => {
  const figures = window.artworkSort.sort(museumOriginalOrder, figure => figure.dataset, event.target.value);
  museumScroll.replaceChildren(...figures);
  museumScroll.scrollTop = 0;
});
const artworkDialog = document.querySelector("#artwork-dialog");
const artworkDialogImage = document.querySelector("#artwork-dialog-image");
const artworkDialogTitle = document.querySelector("#artwork-dialog-title");
const artworkDialogMeta = document.querySelector("#artwork-dialog-meta");
const dialogClose = document.querySelector("#dialog-close");
let lastMuseumTrigger;

museumScroll.addEventListener("click", event => {
  const trigger = event.target.closest(".museum-image-button");
  if (!trigger) return;
  const artwork = trigger.querySelector("img");
  const caption = trigger.parentElement.querySelector("figcaption");
  artworkDialogImage.src = artwork.getAttribute("src");
  artworkDialogImage.alt = artwork.alt;
  artworkDialogTitle.textContent = caption.querySelector(".artwork-title").textContent;
  artworkDialogMeta.replaceChildren(...[...caption.querySelectorAll(".artwork-meta")].map(line => line.cloneNode(true)));
  lastMuseumTrigger = trigger;
  artworkDialog.showModal();
});

dialogClose.addEventListener("click", () => artworkDialog.close());
artworkDialog.addEventListener("click", event => {
  const bounds = artworkDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    artworkDialog.close();
  }
});
artworkDialog.addEventListener("close", () => lastMuseumTrigger?.focus());

const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = navLinks.map(link => document.querySelector(link.getAttribute("href")));

function activateSection(id) {
  const target = sections.find(section => section.id === id) || sections[0];
  sections.forEach(section => section.classList.toggle("is-current", section === target));
  navLinks.forEach(link => {
    const active = link.getAttribute("href") === `#${target.id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  scheduleAuto();
}

navLinks.forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  const id = link.getAttribute("href").slice(1);
  window.history.pushState(null, "", `#${id}`);
  activateSection(id);
}));

window.addEventListener("popstate", () => activateSection(window.location.hash.slice(1)));
window.addEventListener("hashchange", () => activateSection(window.location.hash.slice(1)));
renderSlide();
setTrackOffset(0, false);
activateSection(window.location.hash.slice(1));

document.querySelector("#year").textContent = new Date().getFullYear();
document.querySelector("#footer-year").textContent = new Date().getFullYear();

const browserThemeColor = document.querySelector('meta[name="theme-color"]');
if (browserThemeColor) {
  browserThemeColor.content = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
}
