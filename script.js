const slides = [
  {
    image: "./assets/painting-01.svg",
    alt: "Sample abstract painting in terracotta, cream and dark blue; placeholder artwork",
    title: "Artwork placeholder 01"
  },
  {
    image: "./assets/painting-02.svg",
    alt: "Sample abstract painting with olive green botanical shapes; placeholder artwork",
    title: "Artwork placeholder 02"
  },
  {
    image: "./assets/painting-03.svg",
    alt: "Sample abstract painting with blue waves and a pale sun; placeholder artwork",
    title: "Artwork placeholder 03"
  },
  {
    image: "./assets/painting-04.svg",
    alt: "Sample geometric painting in plum, blush and ochre; placeholder artwork",
    title: "Artwork placeholder 04"
  }
];

const image = document.querySelector("#slide-image");
const title = document.querySelector("#slide-title");
const indexLabel = document.querySelector("#slide-index");
const dotsContainer = document.querySelector("#slide-dots");
const playToggle = document.querySelector("#play-toggle");
const playIcon = document.querySelector("#play-icon");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentSlide = 0;
let timer;
let paused = reducedMotion.matches;
let transitionTimer;

slides.forEach((slide, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slide-dot";
  button.setAttribute("aria-label", `Show painting ${index + 1} of ${slides.length}`);
  button.addEventListener("click", () => showSlide(index, true));
  dotsContainer.append(button);
});

function renderSlide(index) {
  const slide = slides[index];
  image.src = slide.image;
  image.alt = slide.alt;
  title.textContent = slide.title;
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  [...dotsContainer.children].forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === index);
    if (dotIndex === index) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
}

function showSlide(index, fromUser = false) {
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
  if (fromUser) startTimer();
}

function startTimer() {
  window.clearInterval(timer);
  if (!paused && !document.hidden) timer = window.setInterval(() => showSlide(currentSlide + 1), 6500);
}

function updatePlayButton() {
  playToggle.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
  playToggle.setAttribute("aria-pressed", String(paused));
  playIcon.textContent = paused ? "▶" : "Ⅱ";
}

document.querySelector("#previous").addEventListener("click", () => showSlide(currentSlide - 1, true));
document.querySelector("#next").addEventListener("click", () => showSlide(currentSlide + 1, true));
playToggle.addEventListener("click", () => { paused = !paused; updatePlayButton(); startTimer(); });
document.addEventListener("visibilitychange", startTimer);
document.querySelector(".slideshow").addEventListener("mouseenter", () => window.clearInterval(timer));
document.querySelector(".slideshow").addEventListener("mouseleave", startTimer);
document.querySelector(".slideshow").addEventListener("focusin", () => window.clearInterval(timer));
document.querySelector(".slideshow").addEventListener("focusout", event => {
  if (!event.currentTarget.contains(event.relatedTarget)) startTimer();
});
document.querySelector(".slideshow").addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") { event.preventDefault(); showSlide(currentSlide - 1, true); }
  if (event.key === "ArrowRight") { event.preventDefault(); showSlide(currentSlide + 1, true); }
});
const swipeArea = document.querySelector(".artwork-stage");
let swipeStart = null;
swipeArea.addEventListener("touchstart", event => {
  if (event.touches.length !== 1) return;
  swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
swipeArea.addEventListener("touchend", event => {
  if (!swipeStart || event.changedTouches.length !== 1) return;
  const deltaX = event.changedTouches[0].clientX - swipeStart.x;
  const deltaY = event.changedTouches[0].clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
  showSlide(currentSlide + (deltaX < 0 ? 1 : -1), true);
}, { passive: true });
swipeArea.addEventListener("touchcancel", () => { swipeStart = null; }, { passive: true });
reducedMotion.addEventListener("change", event => { paused = event.matches; updatePlayButton(); startTimer(); });

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
updatePlayButton();
startTimer();
