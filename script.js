const slides = [
  {
    image: "./assets/painting-01.svg",
    alt: "Tillfällig abstrakt bild i terrakotta, gräddvitt och mörkblått",
    title: "Exempelbild 01"
  },
  {
    image: "./assets/painting-02.svg",
    alt: "Tillfällig abstrakt bild med olivgröna växtformer",
    title: "Exempelbild 02"
  },
  {
    image: "./assets/painting-03.svg",
    alt: "Tillfällig abstrakt bild med blå vågor och en blek sol",
    title: "Exempelbild 03"
  },
  {
    image: "./assets/painting-04.svg",
    alt: "Tillfällig geometrisk bild i plommonlila, rosa och ockra",
    title: "Exempelbild 04"
  }
];

const image = document.querySelector("#slide-image");
const title = document.querySelector("#slide-title");
const indexLabel = document.querySelector("#slide-index");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentSlide = 0;
let transitionTimer;

function renderSlide(index) {
  const slide = slides[index];
  image.src = slide.image;
  image.alt = slide.alt;
  title.textContent = slide.title;
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
}

function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;
  window.clearTimeout(transitionTimer);
  if (reducedMotion.matches) {
    renderSlide(currentSlide);
  } else {
    image.classList.add("is-changing");
    transitionTimer = window.setTimeout(() => {
      renderSlide(currentSlide);
      image.classList.remove("is-changing");
    }, 180);
  }
}

document.querySelector(".slideshow").addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") { event.preventDefault(); showSlide(currentSlide - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); showSlide(currentSlide + 1); }
});
const swipeArea = document.querySelector(".artwork-stage");
let swipeStart = null;
let pointerStart = null;

function finishGesture(start, endX, endY) {
  const deltaX = endX - start.x;
  const deltaY = endY - start.y;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  showSlide(currentSlide + (deltaX < 0 ? 1 : -1));
}

swipeArea.addEventListener("touchstart", event => {
  if (event.touches.length !== 1) { swipeStart = null; return; }
  swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
swipeArea.addEventListener("touchend", event => {
  if (!swipeStart || event.changedTouches.length !== 1) return;
  finishGesture(swipeStart, event.changedTouches[0].clientX, event.changedTouches[0].clientY);
  swipeStart = null;
}, { passive: true });
swipeArea.addEventListener("touchcancel", () => { swipeStart = null; }, { passive: true });
swipeArea.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || event.button !== 0) return;
  pointerStart = { x: event.clientX, y: event.clientY };
  swipeArea.setPointerCapture(event.pointerId);
});
swipeArea.addEventListener("pointerup", event => {
  if (!pointerStart) return;
  finishGesture(pointerStart, event.clientX, event.clientY);
  pointerStart = null;
});
swipeArea.addEventListener("pointercancel", () => { pointerStart = null; });

const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = navLinks.map(link => document.querySelector(link.getAttribute("href")));
const mobileLayout = window.matchMedia("(max-width: 540px), (max-width: 900px) and (max-height: 500px)");

function activateMobileSection(id) {
  const target = sections.find(section => section.id === id) || sections[0];
  sections.forEach(section => section.classList.toggle("is-mobile-active", section === target));
  navLinks.forEach(link => {
    const active = link.getAttribute("href") === `#${target.id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

navLinks.forEach(link => link.addEventListener("click", event => {
  if (!mobileLayout.matches) return;
  event.preventDefault();
  const id = link.getAttribute("href").slice(1);
  window.history.pushState(null, "", `#${id}`);
  activateMobileSection(id);
}));

window.addEventListener("popstate", () => {
  if (mobileLayout.matches) activateMobileSection(window.location.hash.slice(1));
});
window.addEventListener("hashchange", () => {
  if (mobileLayout.matches) activateMobileSection(window.location.hash.slice(1));
});
mobileLayout.addEventListener("change", event => {
  if (event.matches) activateMobileSection(window.location.hash.slice(1));
  else sections.forEach(section => section.classList.remove("is-mobile-active"));
});

const observer = new IntersectionObserver(entries => {
  if (mobileLayout.matches) return;
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach(link => {
    const active = link.getAttribute("href") === `#${visible.target.id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}, { rootMargin: "-20% 0px -45% 0px", threshold: [0, .2, .5, 1] });
sections.forEach(section => observer.observe(section));
if (mobileLayout.matches) activateMobileSection(window.location.hash.slice(1));

document.querySelector("#year").textContent = new Date().getFullYear();
document.querySelector("#footer-year").textContent = new Date().getFullYear();
renderSlide(currentSlide);
