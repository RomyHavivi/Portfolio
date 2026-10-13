import { initialContent } from "./data.js";
import { mediaURL, parseVideo } from "./media.js";
const limits = {
  name: 100,
  intro: 1000,
  about: 10000,
  contactIntro: 2000,
  heroVideo: 4000,
  heroPoster: 4000,
  aboutImage: 4000,
};
const projectLimits = {
  id: 100,
  title: 150,
  description: 2000,
  year: 20,
  image: 4000,
  video: 4000,
};
function text(value, key, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    throw new Error(`התוכן בשדה ${key} אינו תקין. יש לבדוק את הנתונים השמורים.`);
  return value;
}
export function isHeroVideo(value) {
  try {
    return Boolean(mediaURL(value) && /\.(mp4|webm)$/i.test(new URL(value).pathname));
  } catch {
    return false;
  }
}
export function isInstagramURL(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["instagram.com", "www.instagram.com"].includes(url.hostname) &&
      /^\/[A-Za-z0-9._]+\/?$/.test(url.pathname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function validateContent(input, { allowSeed = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("התוכן השמור צריך להיות אובייקט תקין.");
  if (allowSeed && Object.keys(input).length === 0) return structuredClone(initialContent);
  const output = {};
  for (const [key, max] of Object.entries(limits))
    output[key] = text(
      input[key],
      key,
      max,
      ["name", "intro", "about", "contactIntro"].includes(key),
    );
  output.instagramUrl =
    input.instagramUrl === undefined ? initialContent.instagramUrl : text(input.instagramUrl, "instagramUrl", 500);
  if (!isInstagramURL(output.instagramUrl))
    throw new Error("קישור אינסטגרם שמור אינו תקין. יש להזין כתובת HTTPS לפרופיל Instagram.");
  if (
    input.copy !== undefined &&
    (!input.copy || typeof input.copy !== "object" || Array.isArray(input.copy))
  )
    throw new Error("הטקסטים המותאמים באתר אינם תקינים.");
  output.copy = Object.fromEntries(
    Object.entries(initialContent.copy).map(([key, fallback]) => [
      key,
      input.copy?.[key] === undefined ? fallback : text(input.copy[key], key, 2000),
    ]),
  );
  for (const key of ["heroPoster", "aboutImage"])
    if (output[key] && !mediaURL(output[key])) throw new Error("קישור תמונה שמור אינו תקין.");
  if (output.heroVideo && !isHeroVideo(output.heroVideo))
    throw new Error("סרטון הפתיחה צריך להיות קישור HTTPS ישיר לקובץ MP4 או WEBM.");
  if (!Array.isArray(input.projects) || input.projects.length > 10000)
    throw new Error("רשימת הפרויקטים השמורה אינה תקינה.");
  const ids = new Set();
  output.projects = input.projects.map((project) => {
    if (!project || typeof project !== "object" || Array.isArray(project))
      throw new Error("אחד הפרויקטים השמורים אינו תקין.");
    const p = {};
    for (const [key, max] of Object.entries(projectLimits))
      p[key] = text(project[key], key, max, ["id", "title"].includes(key));
    p.photos = project.photos === undefined ? [] : project.photos;
    if (!Array.isArray(p.photos) || p.photos.length > 100)
      throw new Error("רשימת תמונות הגלריה אינה תקינה.");
    p.photos = p.photos.map((photo) => {
      const url = text(photo, "photos", 4000, true);
      if (!mediaURL(url)) throw new Error("קישור תמונה בגלריה אינו תקין.");
      return url;
    });
    if (ids.has(p.id)) throw new Error("מזהי הפרויקטים צריכים להיות ייחודיים.");
    ids.add(p.id);
    if (!["directing", "editing", "photography"].includes(project.discipline))
      throw new Error("תחום היצירה בפרויקט אינו תקין.");
    p.discipline = project.discipline;
    if (
      typeof project.category !== "string" ||
      (p.discipline === "photography"
        ? !["cosplay", "fashion"].includes(project.category)
        : project.category !== "")
    )
      throw new Error("קטגוריית הפרויקט אינה תקינה.");
    p.category = project.category;
    if (typeof project.sample !== "boolean") throw new Error("סימון פרויקט לדוגמה אינו תקין.");
    p.sample = project.sample;
    if (p.image && !mediaURL(p.image)) throw new Error("קישור תמונת פרויקט אינו תקין.");
    if (p.discipline === "photography" && !p.image)
      throw new Error("יש להוסיף תמונה לפרויקט צילום.");
    if (p.discipline !== "photography" && p.photos.length)
      throw new Error("גלריית תמונות זמינה רק בפרויקט צילום.");
    if (p.video) parseVideo(p.video);
    if (p.discipline === "photography" && p.video)
      throw new Error("פרויקט צילום לא יכול לכלול קישור לווידאו.");
    return p;
  });
  return output;
}
