import { initialContent } from "./data.js";
import { validateContent } from "./schema.js";
let config = null,
  token = null,
  demoContent = structuredClone(initialContent),
  ownerId = null,
  revision = null,
  refreshPromise = null,
  sessionGeneration = 0;
export const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
export let isPreview = Boolean(window.tasklet);
const SESSION_KEY = "romi-admin-session";
function persistSession() {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, JSON.stringify(token));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    console.warn("Session storage unavailable; login is retained only in memory.");
  }
}
function clearSession() {
  token = null;
  sessionGeneration++;
  persistSession();
}
async function timedFetch(url, options = {}, timeout = 45000) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { cache: "no-store", ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("החיבור נמשך יותר מדי זמן. נסו שוב.");
    throw new Error("לא ניתן להתחבר כרגע. בדקו את החיבור ונסו שוב.");
  } finally {
    clearTimeout(timer);
  }
}
export async function initializeStore() {
  if (isPreview) return { content: demoContent, mode: "preview" };
  const response = await timedFetch("/.netlify/functions/public-config");
  // Live Server cannot run Functions. Only loopback hosts may fall back to a
  // temporary demo; a missing function on a public deployment stays an error.
  if (response.status === 404 && isLocalHost) {
    isPreview = true;
    return { content: demoContent, mode: "local" };
  }
  if (response.status === 503)
    return { content: structuredClone(initialContent), mode: "unconfigured" };
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "פונקציית Netlify חסרה. יש לפרסם את האתר מהמאגר עם תיקיית Functions."
        : "הגדרות האתר אינן תקינות. יש לבדוק את משתני הסביבה ב-Netlify.",
    );
  config = await response.json();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) || !config.anonKey)
    throw new Error("הגדרות האחסון אינן תקינות.");
  try {
    token = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    token = null;
  }
  const rows = await request(
    "/rest/v1/portfolio?select=content,owner_id,revision&id=eq.main",
    {},
    false,
  );
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error("רשומת main חסרה. יש להשלים את התקנת מסד הנתונים לפי המדריך.");
  ownerId = rows[0].owner_id;
  revision = rows[0].revision;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("גרסת מסד הנתונים ישנה. יש להריץ את קובץ ההתקנה המעודכן.");
  if (token && (!token.access_token || !token.refresh_token || token.user?.id !== ownerId))
    clearSession();
  const content = validateContent(rows[0].content, { allowSeed: true });
  return { content, mode: "live" };
}
async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  const generation = sessionGeneration,
    refreshToken = token?.refresh_token;
  refreshPromise = (async () => {
    if (!refreshToken) {
      clearSession();
      throw new Error("יש להתחבר מחדש.");
    }
    const response = await timedFetch(config.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) {
      if (generation === sessionGeneration) clearSession();
      throw new Error("תוקף ההתחברות הסתיים. יש לצאת ולהתחבר מחדש.");
    }
    const next = await response.json();
    if (generation !== sessionGeneration) throw new Error("ההתחברות בוטלה.");
    if (!next.access_token || next.user?.id !== ownerId) {
      clearSession();
      throw new Error("המשתמש אינו בעל האתר.");
    }
    token = next;
    persistSession();
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
async function request(path, options = {}, privileged = true) {
  if (!config) throw new Error("האחסון עדיין לא מחובר. יש להשלים את ההתקנה לפי README.");
  if (privileged && token?.expires_at * 1000 < Date.now() + 60000) await refreshSession();
  const authorization =
    privileged && token?.access_token
      ? { Authorization: `Bearer ${token.access_token}` }
      : config.anonKey.startsWith("eyJ")
        ? { Authorization: `Bearer ${config.anonKey}` }
        : {};
  const response = await timedFetch(
    config.url + path,
    { ...options, headers: { apikey: config.anonKey, ...authorization, ...options.headers } },
    path.startsWith("/storage/") ? 180000 : 45000,
  );
  if (!response.ok) {
    if (privileged && response.status === 401) clearSession();
    throw new Error(
      response.status === 401 || response.status === 403
        ? "הפעולה לא אושרה. יש להתחבר שוב או לבדוק את הרשאות המשתמש."
        : "לא ניתן להשלים את הפעולה. בדקו את החיבור ואת הגדרות האחסון.",
    );
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export function signedIn() {
  return Boolean(token?.access_token && token.user?.id === ownerId);
}
export async function login(email, password) {
  clearSession();
  const next = await request(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    },
    false,
  );
  if (!next.access_token || next.user?.id !== ownerId)
    throw new Error("המשתמש אינו בעל האתר. יש להתחבר באמצעות חשבון הניהול שהוגדר.");
  token = next;
  persistSession();
}
export async function logout() {
  const previous = token;
  clearSession();
  if (previous?.access_token)
    await timedFetch(config.url + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${previous.access_token}` },
    });
}
export async function saveContent(content) {
  content = validateContent(content);
  if (isPreview) {
    demoContent = structuredClone(content);
    return;
  }
  if (!signedIn()) throw new Error("יש להתחבר כדי לשמור.");
  const rows = await request(`/rest/v1/portfolio?id=eq.main&revision=eq.${revision}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ content }),
  });
  if (!rows?.length)
    throw new Error(
      "התוכן השתנה בלשונית אחרת, או שההרשאות אינן תקינות. השינויים שלך לא נדרסו. שמרו עותק של הטקסט שלכם וטענו את האתר מחדש לפני שמירה נוספת.",
    );
  if (!Number.isSafeInteger(rows[0].revision) || rows[0].revision <= revision)
    throw new Error("לא התקבלה גרסת תוכן מעודכנת. יש לבדוק את התקנת מסד הנתונים.");
  revision = rows[0].revision;
}
export async function uploadMedia(file) {
  if (!config || !signedIn())
    throw new Error("העלאה זמינה לאחר חיבור אחסון והתחברות. בהדגמה ניתן להשתמש בקישור HTTPS.");
  const allowed = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  const ext = allowed[file.type];
  if (!ext) throw new Error("פורמט נתמך: JPG, PNG, WEBP, AVIF, GIF, MP4 או WEBM.");
  if (!file.size) throw new Error("לא ניתן להעלות קובץ ריק.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("גודל הקובץ המרבי הוא 50MB. לסרטים גדולים מומלץ להשתמש ב-YouTube או Vimeo.");
  const path = `${crypto.randomUUID()}.${ext}`;
  await request(`/storage/v1/object/portfolio-media/${path}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: file,
  });
  return `${config.url}/storage/v1/object/public/portfolio-media/${path}`;
}
