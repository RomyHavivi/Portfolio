import { labels, initialContent } from "./data.js";
import { escapeHTML as e, mediaURL, optimizeCloudinaryVideo, parseVideo } from "./media.js";
import { initializeStore, isPreview, isLocalHost } from "./store.js";
import { renderAdmin, hasUnsavedChanges, adminBusy, clearAdminDraft } from "./admin.js";
import { enhanceMotion, finishMotionReveals } from "./motion.js";
import { confirmDiscard, lockPage, unlockPage } from "./ui.js";
let content = structuredClone(initialContent),
  mode = "loading",
  gallery = [],
  galleryIndex = 0;
let currentRoute = null;
let navigationConfirmation = false,
  loadError = "";
let historyIndex = Number.isInteger(history.state?.portfolioIndex)
    ? history.state.portfolioIndex
    : 0,
  restoringHistory = false;
history.replaceState({ ...history.state, portfolioIndex: historyIndex }, "", location.href);
function restoreNavigation() {
  const targetIndex = history.state?.portfolioIndex;
  if (Number.isInteger(targetIndex) && targetIndex !== historyIndex) {
    restoringHistory = true;
    history.go(historyIndex - targetIndex);
  } else
    history.replaceState({ ...history.state, portfolioIndex: historyIndex }, "", currentRoute.hash);
}
const main = document.querySelector("main"),
  viewer = document.querySelector("#viewer"),
  viewerBody = document.querySelector("#viewer-body");
const siteStatus = document.createElement("div");
siteStatus.className = "site-status";
siteStatus.setAttribute("role", "status");
document.querySelector(".site-header").after(siteStatus);
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ behavior: "instant", block: "start" });
});
const safeImage = (url) => e(mediaURL(url) || "./assets/fallback.svg");
export function notify(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => el.classList.remove("visible"), 4500);
}
function thumbnail(p, index = 0) {
  return `<button class="project-card ${p.discipline === "photography" ? "photo-card" : ""}" data-project="${e(p.id)}" aria-label="פתיחת ${e(p.title)}"><div class="project-image"><img src="${safeImage(p.image)}" alt="${e(p.title)}" loading="lazy"><span class="project-number" dir="ltr">${String(index + 1).padStart(2, "0")}</span>${p.discipline === "photography" && p.photos?.length ? `<span class="gallery-count">${p.photos.length + 1} תמונות</span>` : ""}<span class="project-arrow" aria-hidden="true">${p.discipline === "photography" ? "↗" : "▶"}</span>${p.sample ? '<span class="sample-badge">עבודה לדוגמה</span>' : ""}</div><div class="project-caption"><div><h3>${e(p.title)}</h3><p>${e(p.description)}</p></div><span dir="ltr">${e(p.year)}</span></div></button>`;
}
function disciplineLinks() {
  return `<div class="disciplines">${Object.entries(labels)
    .map(
      ([key, label], i) =>
        `<a href="#projects/${key}"><span class="discipline-num" dir="ltr">0${i + 1} /</span><span>${label}</span><span class="discipline-en" dir="ltr">${{ directing: "DIRECTING", editing: "EDITING", photography: "PHOTOGRAPHY" }[key]}</span><span class="discipline-arrow" aria-hidden="true">↖</span></a>`,
    )
    .join("")}</div>`;
}
function renderHome() {
  const hero = optimizeCloudinaryVideo(content.heroVideo);
  main.innerHTML = `<section class="hero" aria-label="פתיחה"><img class="hero-poster" src="${safeImage(content.heroPoster)}" alt=""><video class="hero-video" ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : "autoplay"} loop muted playsinline preload="auto" poster="${safeImage(content.heroPoster)}" aria-hidden="true">${hero ? `<source src="${e(hero)}">` : ""}</video><div class="hero-shade"></div><div class="hero-text"><h1>לא רק<br>לראות<span class="orange-dot">.</span><br><em>להרגיש.</em></h1><p>${e(content.intro)}</p><a class="hero-cta" href="#projects">אל העבודות <span aria-hidden="true">↙</span></a></div><div class="hero-bottom"><button id="hero-toggle" aria-label="השהיית סרטון הפתיחה">Ⅱ</button></div></section>${disciplineLinks()}<section class="home-work section-pad"><div class="section-heading"><div><h2>שלושה עולמות.<br>אותה סקרנות<span class="orange-dot">.</span></h2></div><a class="text-link" href="#projects">כל העבודות ↖</a></div><div class="selected-grid">${Object.keys(
    labels,
  )
    .map((key) => {
      const p = content.projects.find((p) => p.discipline === key);
      return p
        ? `<div><span class="card-discipline">${labels[key]}</span>${thumbnail(p)}</div>`
        : `<a class="empty-card" href="#projects/${key}">${labels[key]} — בקרוב</a>`;
    })
    .join(
      "",
    )}</div></section><section class="intro-band"><div><p>בין תמונה לסיפור,<br>יש תמיד עוד דרך.</p><a class="text-link" href="#about">קצת עליי ↖</a></div></section><section class="home-contact section-pad"><span class="eyebrow">משהו מתחיל כאן</span><a href="#contact">יש לכם רעיון?<br><span>בואו ניתן לו צורה.</span> <i aria-hidden="true">↖</i></a></section>`;
  const video = main.querySelector("video"),
    toggle = main.querySelector("#hero-toggle");
  if (!hero) {
    toggle.hidden = true;
    video.hidden = true;
  }
  const showPoster = () => {
    video.hidden = true;
    toggle.hidden = true;
  };
  video.addEventListener("error", showPoster);
  video.querySelector("source")?.addEventListener("error", showPoster);
  const sync = () => {
    toggle.textContent = video.paused ? "▶" : "Ⅱ";
    toggle.setAttribute("aria-label", video.paused ? "הפעלת סרטון הפתיחה" : "השהיית סרטון הפתיחה");
  };
  video.addEventListener("pause", sync);
  video.addEventListener("play", sync);
  sync();
  toggle.onclick = async () => {
    if (video.paused) {
      try {
        await video.play();
      } catch {
        notify("הסרטון אינו זמין כרגע. מוצגת תמונת הפתיחה.");
      }
    } else video.pause();
    sync();
  };
  if (hero && !matchMedia("(prefers-reduced-motion: reduce)").matches) video.play().catch(sync);
}
function renderProjects(discipline = "directing", filter = "all") {
  if (!labels[discipline]) discipline = "directing";
  if (!["all", "cosplay", "fashion"].includes(filter)) filter = "all";
  const projects = content.projects.filter(
    (p) =>
      p.discipline === discipline &&
      (discipline !== "photography" || filter === "all" || p.category === filter),
  );
  main.innerHTML = `<section class="projects-page section-pad"><div class="page-heading"><h1>רעיונות.<br><span class="outline-text">בתנועה.</span></h1><p>בימוי, עריכה וצילום — כל אחד מהם הוא התחלה של סיפור.</p></div><nav class="work-tabs" aria-label="תחומי יצירה">${Object.entries(
    labels,
  )
    .map(
      ([key, label], i) =>
        `<a href="#projects/${key}" ${key === discipline ? 'aria-current="page" class="active"' : ""}><span dir="ltr">0${i + 1}</span>${label}<span aria-hidden="true">↙</span></a>`,
    )
    .join("")}</nav>${
    discipline === "photography"
      ? `<nav class="photo-filters" aria-label="סינון צילום">${[
          ["all", "הכול"],
          ["cosplay", "קוספליי"],
          ["fashion", "אופנה"],
        ]
          .map(
            ([key, label]) =>
              `<a href="#projects/photography/${key}" ${key === filter ? 'class="active" aria-current="true"' : ""}>${label}</a>`,
          )
          .join("")}</nav>`
      : ""
  }<div class="work-grid ${discipline === "photography" ? "gallery-grid" : ""}">${projects.map(thumbnail).join("") || '<p class="empty-state">העבודות הבאות יופיעו כאן. עוד רגע.</p>'}</div></section>`;
}
function updateProjectView(discipline = "directing", filter = "all") {
  if (!labels[discipline]) discipline = "directing";
  if (!["all", "cosplay", "fashion"].includes(filter)) filter = "all";
  const grid = main.querySelector(".work-grid");
  if (!grid) return;
  const scroll = window.scrollY,
    rect = grid.getBoundingClientRect(),
    top = rect.top + scroll;
  const oldHeight = rect.height;
  finishMotionReveals(main);
  grid.style.minHeight = `${oldHeight}px`;
  const projects = content.projects.filter(
    (p) =>
      p.discipline === discipline &&
      (discipline !== "photography" || filter === "all" || p.category === filter),
  );
  grid.classList.toggle("gallery-grid", discipline === "photography");
  grid.innerHTML =
    projects.map(thumbnail).join("") ||
    '<p class="empty-state">אין תמונות בקטגוריה הזאת עדיין.</p>';
  main.querySelectorAll(".work-tabs a").forEach((link) => {
    const active = link.hash === `#projects/${discipline}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  let filters = main.querySelector(".photo-filters");
  if (discipline === "photography" && !filters) {
    filters = document.createElement("nav");
    filters.className = "photo-filters";
    filters.setAttribute("aria-label", "סינון צילום");
    main.querySelector(".work-tabs").after(filters);
  }
  if (discipline !== "photography") filters?.remove();
  if (filters) {
    filters.innerHTML = [
      ["all", "הכול"],
      ["cosplay", "קוספליי"],
      ["fashion", "אופנה"],
    ]
      .map(
        ([key, label]) =>
          `<a href="#projects/photography/${key}" ${key === filter ? 'class="active" aria-current="true"' : ""}>${label}</a>`,
      )
      .join("");
  }
  let status = main.querySelector("#filter-status");
  if (discipline === "photography") {
    if (!status) {
      status = document.createElement("p");
      status.id = "filter-status";
      status.className = "visually-hidden";
      status.setAttribute("role", "status");
      filters.after(status);
    }
    status.textContent = `${projects.length} עבודות בקטגוריה ${{ all: "הכול", cosplay: "קוספליי", fashion: "אופנה" }[filter]}`;
  } else status?.remove();
  const tail = document.documentElement.scrollHeight - top - grid.getBoundingClientRect().height;
  grid.style.minHeight = `${Math.max(0, scroll + window.innerHeight - top - tail)}px`;
  window.scrollTo({ top: scroll, behavior: "instant" });
}
function renderAbout() {
  main.innerHTML = `<section class="about-page section-pad"><div class="about-copy"><h1>נעים להכיר.<br><span>${e(content.name)}</span><span class="orange-dot">.</span></h1><div class="about-body">${e(
    content.about,
  )
    .split("\n")
    .map((p) => `<p>${p}</p>`)
    .join(
      "",
    )}</div><div class="about-skills"><span>בימוי</span><span>עריכה</span><span>צילום</span></div><a class="solid-link" href="#contact">בואו ניצור משהו ↖</a></div><div class="about-visual"><img src="${safeImage(content.aboutImage)}" alt="תמונת אווירה לדוגמה — ניתן להחליף בפורטרט שלך"><span class="photo-index" dir="ltr">01 / THE PERSON BEHIND THE LENS</span></div></section>`;
  if (content.aboutImage !== initialContent.aboutImage) {
    main.querySelector(".about-visual img").alt = content.aboutImage
      ? "פורטרט של " + content.name
      : "מקום לתמונת פורטרט";
  }
}
function renderContact() {
  main.innerHTML = `<section class="contact-page section-pad"><div class="contact-copy"><h1>היי.<br>מה הסיפור<br><span class="outline-text">שלכם?</span><span class="orange-dot">.</span></h1><p>${e(content.contactIntro)}</p></div><form id="contact-form" name="portfolio-contact" method="POST" data-netlify="true" netlify-honeypot="website"><input type="hidden" name="form-name" value="portfolio-contact"><p class="honeypot"><label>לא למלא שדה זה <input name="website" tabindex="-1" autocomplete="off"></label></p><label>איך קוראים לכם?<input name="name" autocomplete="name" required maxlength="100" placeholder="השם שלכם"></label><label>לאן לחזור אליכם?<input name="email" type="email" dir="ltr" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label><label>מה תרצו ליצור?<textarea name="message" required rows="5" maxlength="5000" placeholder="כמה מילים על הפרויקט, הרעיון או שיתוף הפעולה…"></textarea></label><button class="solid-link" type="submit">שליחת הודעה <span aria-hidden="true">↖</span></button><p class="form-note">${isPreview || isLocalHost ? "זו תצוגה מקדימה. הודעות אינן נשלחות מכאן." : "פרטי ההודעה משמשים רק למענה לפנייה שלכם."}</p><p class="form-result" role="status"></p></form></section>`;
  const form = main.querySelector("form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const result = form.querySelector(".form-result");
    if (isPreview || isLocalHost) {
      result.textContent = "טופס ההדגמה תקין. לאחר פרסום ב-Netlify, הודעות יתקבלו באזור Forms.";
      return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "שולח…";
    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!response.ok) throw new Error("Submission failed");
      form.reset();
      result.textContent = "ההודעה נשלחה. תודה, נדבר בקרוב!";
    } catch (error) {
      console.error(error);
      result.textContent = "ההודעה לא נשלחה. נסו שוב מאוחר יותר.";
    } finally {
      button.disabled = false;
      button.textContent = "שליחת הודעה ↖";
    }
  };
}
function displayProject(id) {
  const p = content.projects.find((p) => p.id === id);
  if (!p) return;
  if (p.discipline === "photography") {
    gallery = [p.image, ...(p.photos || [])].map((image) => ({ project: p, image }));
    galleryIndex = 0;
    renderGallery();
  } else {
    viewerBody.innerHTML = `<div class="video-frame"></div><div class="viewer-caption"><h2>${e(p.title)}</h2><p>${e(p.description)}</p></div>`;
    const frame = viewerBody.querySelector(".video-frame");
    if (!p.video)
      frame.innerHTML = `<div class="video-placeholder"><img src="${safeImage(p.image)}" alt="${e(p.title)}"><div><span aria-hidden="true">▷</span><p>כאן יופיע הסרט שלכם</p><small>מוסיפים קישור לווידאו באזור הניהול.</small></div></div>`;
    else
      try {
        const media = parseVideo(p.video),
          el = document.createElement(media.type === "video" ? "video" : "iframe");
        if (media.type === "video") {
          el.src = optimizeCloudinaryVideo(media.src);
          el.controls = true;
          el.playsInline = true;
          el.preload = "auto";
        } else {
          el.src = media.src;
          el.title = p.title;
          el.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
          el.allowFullscreen = true;
          el.referrerPolicy = "strict-origin-when-cross-origin";
          if (!["iframely.net", "cdn.iframe.ly"].includes(new URL(media.src).hostname))
            el.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
        }
        frame.append(el);
        const link = document.createElement("a");
        link.href = mediaURL(p.video);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "video-source";
        link.textContent = "לא נטען? צפייה באתר המקור ↗";
        viewerBody.append(link);
      } catch (err) {
        frame.textContent = err.message;
      }
  }
  viewerBody.querySelector("h2").id = "viewer-title";
  lockPage();
  viewer.showModal();
}
function renderGallery(transition = false) {
  const focusedStep = document.activeElement?.dataset?.step,
    previousImage = transition ? viewerBody.querySelector(".lightbox-image img") : null,
    item = gallery[galleryIndex],
    p = item.project;
  viewer.classList.add("viewer-gallery");
  viewerBody.innerHTML = `<div class="lightbox-image"><img src="${safeImage(item.image)}" alt="${e(p.title)}"><div class="gallery-controls"><button data-step="-1" aria-label="התמונה הקודמת" ${gallery.length < 2 ? "hidden" : ""}>→</button><button data-step="1" aria-label="התמונה הבאה" ${gallery.length < 2 ? "hidden" : ""}>←</button></div></div><div class="viewer-caption"><div><h2 id="viewer-title">${e(p.title)}</h2><p>${e(p.description)}</p></div><span class="gallery-counter" dir="ltr" role="status" aria-live="polite" aria-label="תמונה ${galleryIndex + 1} מתוך ${gallery.length}">${galleryIndex + 1} / ${gallery.length}</span></div>`;
  const image = viewerBody.querySelector(".lightbox-image img");
  if (previousImage && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const outgoingImage = previousImage.cloneNode();
    outgoingImage.classList.add("gallery-image-outgoing");
    image.classList.add("gallery-image-entering");
    viewerBody.querySelector(".lightbox-image").append(outgoingImage);
    requestAnimationFrame(() => {
      image.classList.add("is-visible");
      outgoingImage.classList.add("is-fading");
    });
    outgoingImage.addEventListener("transitionend", () => outgoingImage.remove(), {
      once: true,
    });
  }
  viewerBody.querySelectorAll("[data-step]").forEach(
    (button) =>
      (button.onclick = () => {
        const step = Number(button.dataset.step);
        galleryIndex = (galleryIndex + step + gallery.length) % gallery.length;
        renderGallery(true);
        viewerBody.querySelector(`[data-step="${step}"]`).focus();
      }),
  );
  if (focusedStep) viewerBody.querySelector(`[data-step="${focusedStep}"]`)?.focus();
}
function cleanupViewer() {
  viewerBody.innerHTML = "";
  viewer.classList.remove("viewer-gallery");
  gallery = [];
  unlockPage();
}
function closeViewer() {
  viewer.close();
  cleanupViewer();
}
document.querySelector(".viewer-close").onclick = closeViewer;
viewer.addEventListener("close", () => {
  if (!viewer.open) cleanupViewer();
});
viewer.addEventListener("click", (event) => {
  if (event.target === viewer) closeViewer();
});
viewer.addEventListener("keydown", (event) => {
  if (gallery.length && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    galleryIndex =
      (galleryIndex + (event.key === "ArrowLeft" ? 1 : -1) + gallery.length) % gallery.length;
    renderGallery(true);
  }
});
main.addEventListener("click", (event) => {
  const filter = event.target.closest(".photo-filters a");
  if (
    filter &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  ) {
    event.preventDefault();
    if (location.hash !== filter.hash) {
      history.pushState(null, "", filter.hash);
      route();
    }
    return;
  }
  const card = event.target.closest("[data-project]");
  if (card) displayProject(card.dataset.project);
});
document.addEventListener(
  "error",
  (event) => {
    if (
      event.target instanceof HTMLImageElement &&
      !event.target.src.endsWith("/assets/fallback.svg")
    )
      event.target.src = "./assets/fallback.svg";
  },
  true,
);
async function route() {
  let targetIndex = history.state?.portfolioIndex;
  if (!Number.isInteger(targetIndex)) {
    targetIndex = historyIndex + 1;
    history.replaceState({ ...history.state, portfolioIndex: targetIndex }, "", location.href);
  }
  if (restoringHistory) {
    restoringHistory = false;
    return;
  }
  if (navigationConfirmation) return;
  const requestedHash = location.hash;
  const [rawPage, rawDiscipline, rawFilter] = requestedHash.slice(1).split("/");
  const page = ["home", "projects", "about", "contact", "admin"].includes(rawPage)
    ? rawPage
    : "home";
  const discipline = labels[rawDiscipline] ? rawDiscipline : "directing";
  const filter = ["all", "cosplay", "fashion"].includes(rawFilter) ? rawFilter : "all";
  if (currentRoute?.page === "admin" && page === "admin" && main.querySelector(".admin-page")) {
    currentRoute.hash = requestedHash;
    historyIndex = targetIndex;
    return;
  }
  if (currentRoute?.page === "admin" && page !== "admin") {
    if (adminBusy()) {
      restoreNavigation();
      notify("יש להמתין לסיום השמירה או ההעלאה לפני שיוצאים מהעריכה.");
      return;
    }
    if (hasUnsavedChanges()) {
      navigationConfirmation = true;
      const discard = await confirmDiscard();
      navigationConfirmation = false;
      if (!discard) {
        restoreNavigation();
        return;
      }
      clearAdminDraft();
      history.replaceState({ ...history.state, portfolioIndex: targetIndex }, "", requestedHash);
    }
  }
  if (mode === "loading") {
    main.innerHTML =
      '<section class="load-state section-pad" role="status"><p>טוען את תיק העבודות…</p></section>';
    return;
  }
  if (mode === "error") {
    main.innerHTML = `<section class="load-state section-pad"><h1>עוד רגע חוזרים<span class="orange-dot">.</span></h1><p role="alert">${e(loadError)}</p><button class="solid-link" id="retry-loading">ניסיון נוסף ↖</button></section>`;
    main.querySelector("button").onclick = () => {
      mode = "loading";
      route();
      bootstrap();
    };
    return;
  }
  if (
    page === "projects" &&
    currentRoute?.page === "projects" &&
    main.querySelector(".work-grid")
  ) {
    if (viewer.open) closeViewer();
    updateProjectView(discipline, filter);
    currentRoute = { page, discipline, filter, hash: requestedHash };
    historyIndex = targetIndex;
    main.querySelector(".work-tabs [aria-current]")?.focus({ preventScroll: true });
    return;
  }
  const withinProjects = page === "projects" && currentRoute?.page === "projects";
  const previousScroll = window.scrollY;
  if (viewer.open) closeViewer();
  main.querySelector("video")?.pause();
  document.querySelectorAll(".site-header nav a").forEach((link) => {
    if (link.hash === "#" + page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${{ home: "בימוי / עריכה / צילום", projects: "עבודות", about: "קצת עליי", contact: "בואו נדבר", admin: "ניהול האתר" }[page] || "תיק עבודות"} — ${content.name}`;
  if (page === "projects") renderProjects(discipline, filter);
  else if (page === "about") renderAbout();
  else if (page === "contact") renderContact();
  else if (page === "admin")
    renderAdmin(main, {
      content,
      mode,
      onSave: (next) => {
        content = next;
        updateIdentity();
      },
      notify,
    });
  else renderHome();
  currentRoute = { page, discipline, filter, hash: requestedHash };
  historyIndex = targetIndex;
  enhanceMotion(main);
  window.scrollTo({ top: withinProjects ? previousScroll : 0, behavior: "instant" });
  if (withinProjects)
    main.querySelector(".work-tabs [aria-current]")?.focus({ preventScroll: true });
  else main.focus({ preventScroll: true });
}
function updateIdentity() {
  document.querySelectorAll(".wordmark").forEach((el) => {
    el.textContent = "";
    const name = document.createElement("span");
    name.className = "brand-name";
    name.textContent = content.name;
    el.append(name);
  });
  document
    .querySelector(".site-header .wordmark")
    .setAttribute("aria-label", content.name + " — דף הבית");
  document.querySelector('meta[name="description"]').content =
    content.name + " — בימוי, עריכה וצילום. תיק עבודות יצירתי.";
}
document.querySelector("#copyright").textContent = `© ${new Date().getFullYear()}`;
window.addEventListener("hashchange", route);
route();
async function bootstrap() {
  try {
    const state = await initializeStore();
    content = state.content;
    mode = state.mode;
    siteStatus.textContent =
      mode === "local"
        ? "תצוגה מקומית — השינויים זמניים ונמחקים בטעינה מחדש. טופס יצירת הקשר אינו שולח הודעות."
        : mode === "unconfigured"
          ? "תצוגת דוגמה — האחסון עדיין לא מחובר. שמירה קבועה דורשת השלמת התקנה."
          : "";
    updateIdentity();
    route();
  } catch (error) {
    console.error(error);
    mode = "error";
    loadError = error.message || "לא ניתן לטעון את התוכן. נסו שוב מאוחר יותר.";
    route();
  }
}
bootstrap();
