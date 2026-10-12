import { initialContent } from "./data.js";
import { escapeHTML as e } from "./media.js";
const preference = matchMedia("(prefers-reduced-motion: reduce)");
let enabled = !preference.matches,
  observer = null,
  hovered = null,
  raf = 0,
  copy = initialContent.copy;
const control = document.createElement("button");
control.className = "motion-control";
control.type = "button";
document.body.append(control);
function sync() {
  document.documentElement.classList.toggle("motion-paused", !enabled);
  control.textContent = preference.matches
    ? copy.motionReduced
    : enabled
      ? copy.motionOn
      : copy.motionOff;
  control.disabled = preference.matches;
  control.setAttribute(
    "aria-label",
    enabled ? copy.motionDisable : copy.motionEnable,
  );
  control.setAttribute("aria-pressed", String(enabled));
  if (!enabled) {
    observer?.disconnect();
    document
      .querySelectorAll("main .motion-reveal")
      .forEach((element) => element.classList.add("motion-seen"));
    document.getAnimations?.().forEach((animation) => {
      if (animation.effect?.target?.closest?.("main")) animation.cancel();
    });
    resetTilt();
  }
}
control.onclick = () => {
  if (preference.matches) return;
  enabled = !enabled;
  sync();
};
export function setMotionCopy(nextCopy) {
  copy = nextCopy;
  sync();
}
preference.addEventListener("change", () => {
  enabled = !preference.matches;
  sync();
  if (preference.matches) document.querySelector(".hero-video")?.pause();
});
sync();
function resetTilt() {
  if (hovered) {
    hovered.style.removeProperty("--tilt-x");
    hovered.style.removeProperty("--tilt-y");
    hovered = null;
  }
}
document.addEventListener("pointermove", (event) => {
  if (
    !enabled ||
    event.pointerType === "touch" ||
    !matchMedia("(hover:hover) and (pointer:fine)").matches
  )
    return;
  const image = event.target.closest(".project-image");
  if (image !== hovered) resetTilt();
  if (!image) return;
  hovered = image;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!enabled || hovered !== image) return;
    const r = image.getBoundingClientRect();
    image.style.setProperty(
      "--tilt-x",
      `${((event.clientY - r.top - r.height / 2) / r.height) * -4}deg`,
    );
    image.style.setProperty(
      "--tilt-y",
      `${((event.clientX - r.left - r.width / 2) / r.width) * 4}deg`,
    );
  });
});
document.addEventListener("pointerout", (event) => {
  if (hovered && !hovered.contains(event.relatedTarget)) resetTilt();
});
export function enhanceMotion(root, nextCopy = copy) {
  copy = nextCopy;
  observer?.disconnect();
  resetTilt();
  const hero = root.querySelector(".hero");
  if (hero && !hero.querySelector(".hero-sticker")) {
    hero.insertAdjacentHTML(
      "beforeend",
      `<div class="hero-sticker" aria-hidden="true"><span dir="ltr">${e(copy.motionStickerCaption)}</span><strong>${copy.motionStickerLines.split("\n").map(e).join("<br>")}</strong><i>↗</i></div>`,
    );
    root
      .querySelector(".disciplines")
      .insertAdjacentHTML(
        "afterend",
      `<div class="creative-ticker" aria-hidden="true"><div class="ticker-track">${Array.from({ length: 2 }, () => `<span class="ticker-group"><span>${e(copy.disciplinePhotography)}</span><i>↗</i><span class="ticker-outline">${e(copy.disciplineEditing)}</span><i>↗</i><span>${e(copy.disciplineDirecting)}</span><i>↗</i></span>`).join("")}</div></div>`,
      );
  }
  if (!enabled) return;
  const targets = root.querySelectorAll(
    ".section-heading,.project-card,.intro-band>div,.home-contact>a,.page-heading,.about-copy,.about-visual,.contact-copy,#contact-form",
  );
  if (!("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        entry.target.classList.add("motion-seen");
      });
    },
    { threshold: 0.08 },
  );
  targets.forEach((el, i) => {
    if (el.classList.contains("motion-seen")) return;
    el.style.setProperty("--motion-delay", `${(i % 3) * 55}ms`);
    el.classList.add("motion-reveal");
    observer.observe(el);
  });
}
export function finishMotionReveals(root) {
  observer?.disconnect();
  root.querySelectorAll(".motion-reveal").forEach((element) => {
    element.style.transition = "none";
    element.classList.add("motion-seen");
  });
}
