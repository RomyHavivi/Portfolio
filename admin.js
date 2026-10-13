import { escapeHTML as e, mediaURL, parseVideo } from "./media.js";
import { copyFields, labels } from "./data.js";
import { isPreview, signedIn, login, logout, saveContent, uploadMedia } from "./store.js";
import { isHeroVideo, isInstagramURL } from "./schema.js";
import { confirmDiscard } from "./ui.js";
let dirtySettings = false,
  dirtyProject = false,
  busy = false;
export const hasUnsavedChanges = () => dirtySettings || dirtyProject;
export const adminBusy = () => busy;
export function clearAdminDraft() {
  dirtySettings = false;
  dirtyProject = false;
}
window.addEventListener("beforeunload", (event) => {
  if (hasUnsavedChanges() || busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
export function renderAdmin(main, ctx) {
  clearAdminDraft();
  if (!isPreview && !signedIn()) {
    main.innerHTML = `<section class="admin-page section-pad"><span class="eyebrow" dir="ltr">PRIVATE STUDIO</span><h1>מאחורי הקלעים<span class="orange-dot">.</span></h1>${ctx.mode === "live" ? `<form id="login-form" class="login-form"><p>גישה פרטית לבעל האתר בלבד.</p><label>דוא״ל<input type="email" name="email" autocomplete="username" required dir="ltr"></label><label>סיסמה<input type="password" name="password" autocomplete="current-password" required minlength="8"></label><button class="solid-link">כניסה</button><p id="login-error" role="alert"></p></form>` : '<div class="admin-notice">אזור הניהול עדיין אינו מחובר לאחסון. יש להשלים את חיבור Supabase לפי מדריך ההתקנה המצורף. אין אפשרות לשמור תוכן לפני החיבור.</div>'}</section>`;
    const form = main.querySelector("form");
    if (form)
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (busy) return;
        const button = form.querySelector("button");
        button.disabled = true;
        busy = true;
        try {
          await login(form.email.value, form.password.value);
          renderAdmin(main, ctx);
        } catch (error) {
          form.querySelector("#login-error").textContent = error.message;
        } finally {
          busy = false;
          button.disabled = false;
        }
      };
    return;
  }
  let draft = structuredClone(ctx.content),
    editingId = null,
    pendingDelete = null;
  main.innerHTML = `<section class="admin-page section-pad"><div class="admin-header"><div><span class="eyebrow" dir="ltr">PRIVATE STUDIO</span><h1>מאחורי הקלעים<span class="orange-dot">.</span></h1></div><div><a href="#home" class="text-link">חזרה לאתר ↖</a>${!isPreview ? '<button id="logout" class="subtle-button">יציאה</button>' : ""}</div></div>${isPreview ? '<div class="admin-notice">מצב הדגמה: אפשר לערוך ולשמור לתצוגה הנוכחית בלבד. שינויים ייעלמו בטעינה מחדש. העלאת קבצים ושמירה קבועה דורשות חיבור Supabase לאחר הפרסום.</div>' : ""}<div class="admin-layout"><section class="admin-panel"><h2>האתר שלך</h2><form id="settings-form"><label>שם האתר<input name="name" required maxlength="100" value="${e(draft.name)}"></label><label>טקסט הפתיחה<textarea name="intro" rows="3" required maxlength="1000">${e(draft.intro)}</textarea></label><label>סרטון הפתיחה — קישור MP4 / WEBM<input name="heroVideo" type="url" dir="ltr" value="${e(draft.heroVideo)}"></label><p class="form-note">סרטון ישיר בלבד, ללא סאונד ובחזרה. YouTube ו-Vimeo נתמכים בפרויקטים.</p>${assetField("heroPoster", "תמונת הפתיחה", draft.heroPoster)}${assetField("aboutImage", "תמונה לעמוד אודות", draft.aboutImage)}<label>קישור לפרופיל Instagram<input name="instagramUrl" type="url" dir="ltr" maxlength="500" placeholder="https://www.instagram.com/username/" value="${e(draft.instagramUrl || "")}"></label><p class="form-note">הזן את כתובת הפרופיל שלך. כשהקישור שמור, סמל Instagram יופיע בסרגל הניווט.</p><label>קצת עליי<textarea name="about" rows="7" required maxlength="10000">${e(draft.about)}</textarea></label><label>טקסט עמוד יצירת הקשר<textarea name="contactIntro" rows="3" required maxlength="2000">${e(draft.contactIntro)}</textarea></label><details class="copy-editor"><summary>עריכת שאר הטקסטים באתר</summary>${copyFields.map((group) => `<fieldset><legend>${e(group.title)}</legend>${group.fields.map(([key, label, rows = 2]) => `<label>${e(label)}<textarea name="copy.${key}" rows="${rows}" maxlength="2000">${e(draft.copy[key])}</textarea></label>`).join("")}</fieldset>`).join("")}</details><button class="solid-link" type="submit">שמירת פרטי האתר ↖</button><p class="inline-result" role="status"></p></form></section><section class="admin-panel"><div class="panel-title"><h2>העבודות שלך</h2><button id="new-project" class="subtle-button">＋ חדש</button></div><div id="admin-projects"></div><form id="project-form"><h3 id="editor-title">פרויקט חדש</h3><label>שם הפרויקט<input name="title" required maxlength="150"></label><div class="form-row"><label>תחום<select name="discipline"><option value="directing">בימוי</option><option value="editing">עריכה</option><option value="photography">צילום</option></select></label><label>שנה<input name="year" maxlength="20" value="${new Date().getFullYear()}"></label></div><label id="category-label" hidden>קטגוריית צילום<select name="category"><option value="cosplay">קוספליי</option><option value="fashion">אופנה</option></select></label><label>תיאור קצר<textarea name="description" rows="2" maxlength="2000"></textarea></label>${assetField("image", "תמונת הפרויקט", "")}<label id="gallery-photos-label" hidden>קישורים לתמונות נוספות בגלריה (קישור בכל שורה)<textarea name="photos" rows="4" dir="ltr" placeholder="https://…"></textarea></label><label class="upload-label" id="gallery-photos-upload" hidden>או העלאת סט תמונות (אפשר לבחור כמה קבצים יחד)<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" data-upload="photos" multiple ${isPreview ? "disabled" : ""}></label><p class="form-note" id="gallery-photos-help" hidden>אם אין עדיין תמונת כיסוי, הקובץ הראשון יהיה תמונת הכיסוי והקבצים הנוספים יצטרפו לגלריה. אפשר גם להוסיף קישורים, אחד בכל שורה.</p><label id="video-label">קישור לווידאו<input name="video" type="url" dir="ltr" placeholder="https://www.youtube.com/watch?v=…"></label><p id="video-help" class="form-note">YouTube / Vimeo / Dailymotion: לקבלת קישור Dailymotion, פתחו את הסרטון ב-Dailymotion Studio, בחרו Embed/הטמעה והעתיקו רק את כתובת ה-URL מתוך קוד ה-iframe. כתובת הסרטון הרגילה אינה מספיקה. באתרים אחרים: כתובת הטמעה, לא קוד HTML. אפשר גם קישור MP4 / WEBM.</p><label class="check-label"><input name="sample" type="checkbox"> סימון כעבודה לדוגמה</label><button class="solid-link" type="submit">שמירת הפרויקט ↖</button><p class="inline-result" role="status"></p></form></section></div></section>`;
  const settings = main.querySelector("#settings-form"),
    form = main.querySelector("#project-form");
  settings.addEventListener("input", () => {
    dirtySettings = true;
  });
  form.addEventListener("input", () => {
    dirtyProject = true;
  });
  settings.addEventListener("change", () => {
    dirtySettings = true;
  });
  form.addEventListener("change", () => {
    dirtyProject = true;
  });
  let disabledControls = [];
  function lock() {
    if (busy) return false;
    busy = true;
    disabledControls = [...main.querySelectorAll("button,input,textarea,select")].map((el) => [
      el,
      el.disabled,
    ]);
    disabledControls.forEach(([el]) => {
      el.disabled = true;
    });
    main.setAttribute("aria-busy", "true");
    return true;
  }
  function unlock() {
    disabledControls.forEach(([el, wasDisabled]) => {
      el.disabled = wasDisabled;
    });
    disabledControls = [];
    busy = false;
    main.removeAttribute("aria-busy");
  }
  function focusRow(id, action) {
    const button = [...main.querySelectorAll(`#admin-projects [data-${action}]`)].find(
      (el) => el.dataset[action] === id && !el.disabled,
    );
    (button || main.querySelector("#new-project")).focus({ preventScroll: true });
  }
  function describeButtons() {
    main.querySelectorAll(".admin-project-row").forEach((row) => {
      const name = row.querySelector("strong").textContent;
      row.querySelector("[data-edit]").setAttribute("aria-label", "עריכת " + name);
      const del = row.querySelector("[data-delete]");
      del.setAttribute(
        "aria-label",
        (pendingDelete === del.dataset.delete ? "אישור מחיקת " : "מחיקת ") + name,
      );
    });
  }
  for (const [parent, name] of [
    [settings, "heroVideo"],
    [form, "video"],
  ]) {
    parent.elements[name]
      .closest("label")
      .insertAdjacentHTML(
        "afterend",
        `<label class="upload-label" data-video-upload="${name}">או העלאת סרטון MP4 / WEBM<input type="file" accept="video/mp4,video/webm" data-upload="${name}" ${isPreview ? "disabled" : ""}></label>`,
      );
  }
  const paintList = () => {
    main.querySelector("#admin-projects").innerHTML =
      draft.projects
        .map(
          (p, i) =>
            `<div class="admin-project-row"><span><strong>${e(p.title)}</strong><small>${labels[p.discipline]} · ${e(p.year)}</small></span><div><button type="button" data-move="${e(p.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="העברת ${e(p.title)} למעלה">↑</button><button type="button" data-move="${e(p.id)}" data-dir="1" ${i === draft.projects.length - 1 ? "disabled" : ""} aria-label="העברת ${e(p.title)} למטה">↓</button><button type="button" data-edit="${e(p.id)}">עריכה</button><button type="button" data-delete="${e(p.id)}">${pendingDelete === p.id ? "אישור מחיקה" : "מחיקה"}</button></div></div>`,
        )
        .join("") || "<p>אין עבודות עדיין. נתחיל בפרויקט הראשון?</p>";
  };
  const syncDiscipline = () => {
    const photo = form.discipline.value === "photography";
    main.querySelector("#category-label").hidden = !photo;
    form.category.disabled = !photo;
    form.category.required = photo;
    if (photo && !["cosplay", "fashion"].includes(form.category.value))
      form.category.value = "cosplay";
    form.image.required = photo;
    main.querySelector("#gallery-photos-label").hidden = !photo;
    main.querySelector("#gallery-photos-upload").hidden = !photo;
    main.querySelector("#gallery-photos-help").hidden = !photo;
    form.elements.namedItem("photos").disabled = !photo;
    main.querySelector('[data-upload="photos"]').disabled = !photo || isPreview;
    main.querySelector("#video-label").hidden = photo;
    form.video.disabled = photo;
    main.querySelector("#video-help").hidden = photo;
    main.querySelector('[data-video-upload="video"]').hidden = photo;
    main.querySelector('[data-upload="video"]').disabled = photo || isPreview;
  };
  const reset = () => {
    editingId = null;
    form.reset();
    dirtyProject = false;
    main.querySelector("#editor-title").textContent = "פרויקט חדש";
    syncDiscipline();
  };
  form.discipline.onchange = syncDiscipline;
  main.querySelector("#new-project").onclick = async () => {
    if (
      busy ||
      (dirtyProject &&
        !(await confirmDiscard("יש שינויים בפרויקט שלא נשמרו. לפתוח פרויקט חדש ולוותר עליהם?")))
    )
      return;
    pendingDelete = null;
    reset();
    form.title.focus();
  };
  main.querySelector("#logout")?.addEventListener("click", async () => {
    if (busy || (hasUnsavedChanges() && !(await confirmDiscard()))) return;
    if (!lock()) return;
    try {
      await logout();
    } catch (error) {
      ctx.notify(error.message);
    } finally {
      unlock();
      renderAdmin(main, ctx);
    }
  });
  async function persist(next, button, result) {
    if (!lock()) return false;
    result.textContent = "שומר…";
    try {
      await saveContent(next);
      draft = next;
      ctx.content = structuredClone(next);
      ctx.onSave(structuredClone(next));
      result.textContent = isPreview ? "נשמר להדגמה הנוכחית בלבד." : "נשמר! השינויים מופיעים באתר.";
      return true;
    } catch (error) {
      result.textContent = error.message;
      if (!isPreview && !signedIn()) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "subtle-button";
        retry.textContent = "כניסה מחדש";
        retry.onclick = async () => {
          if (
            hasUnsavedChanges() &&
            !(await confirmDiscard(
              "כדי להתחבר שוב יש לצאת מהעריכה. העתיקו את השינויים שלכם לפני שממשיכים.",
            ))
          )
            return;
          renderAdmin(main, ctx);
        };
        result.append(document.createElement("br"), retry);
      }
      return false;
    } finally {
      unlock();
    }
  }
  settings.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(settings));
    const next = { ...draft };
    for (const key of [
      "name",
      "intro",
      "heroVideo",
      "heroPoster",
      "instagramUrl",
      "aboutImage",
      "about",
      "contactIntro",
    ])
      next[key] = String(values[key] || "").trim();
    next.copy = Object.fromEntries(
      copyFields.flatMap((group) =>
        group.fields.map(([key]) => [
          key,
          String(values[`copy.${key}`] || "").trim(),
        ]),
      ),
    );
    const result = settings.querySelector(".inline-result");
    if ([next.heroPoster, next.aboutImage].some((url) => url && !mediaURL(url))) {
      result.textContent = "לתמונות יש להזין קישור HTTPS תקין.";
      return;
    }
    if (next.heroVideo && !isHeroVideo(next.heroVideo)) {
      result.textContent = "סרטון הפתיחה צריך להיות קישור HTTPS ישיר לקובץ MP4 או WEBM.";
      return;
    }
    if (!isInstagramURL(next.instagramUrl)) {
      result.textContent = "יש להזין כתובת HTTPS תקינה לפרופיל Instagram, למשל https://www.instagram.com/username/.";
      return;
    }
    if (await persist(next, settings.querySelector('button[type="submit"]'), result))
      dirtySettings = false;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(form)),
      result = form.querySelector(".inline-result");
    const p = {
      id: editingId || crypto.randomUUID(),
      title: String(values.title).trim(),
      discipline: values.discipline,
      category: values.discipline === "photography" ? values.category : "",
      year: String(values.year).trim(),
      description: String(values.description).trim(),
      image: String(values.image).trim(),
      photos:
        values.discipline === "photography"
          ? String(values.photos || "")
              .split(/\r?\n/)
              .map((photo) => photo.trim())
              .filter(Boolean)
          : [],
      video: values.discipline === "photography" ? "" : String(values.video).trim(),
      sample: values.sample === "on",
    };
    if (!p.title) {
      result.textContent = "יש להזין שם לפרויקט.";
      return;
    }
    if (p.image && !mediaURL(p.image)) {
      result.textContent = "יש להזין קישור HTTPS לתמונה.";
      return;
    }
    if (p.photos.length > 100 || p.photos.some((photo) => !mediaURL(photo))) {
      result.textContent = "יש להזין עד 100 קישורי HTTPS תקינים לתמונות הגלריה.";
      return;
    }
    if (p.video)
      try {
        parseVideo(p.video);
      } catch (error) {
        result.textContent = error.message;
        return;
      }
    const projects = editingId
      ? draft.projects.map((old) => (old.id === editingId ? p : old))
      : [...draft.projects, p];
    if (
      await persist({ ...draft, projects }, form.querySelector('button[type="submit"]'), result)
    ) {
      paintList();
      describeButtons();
      reset();
      form.title.focus({ preventScroll: true });
    }
  };
  main.querySelector("#admin-projects").onclick = async (event) => {
    const button = event.target.closest("button");
    if (!button || busy) return;
    if (button.dataset.edit) {
      if (
        dirtyProject &&
        !(await confirmDiscard("יש שינויים בפרויקט הנוכחי שלא נשמרו. לעבור לפרויקט אחר?"))
      )
        return;
      const p = draft.projects.find((p) => p.id === button.dataset.edit);
      editingId = p.id;
      pendingDelete = null;
      for (const key of [
        "title",
        "discipline",
        "category",
        "year",
        "description",
        "image",
        "video",
      ])
        form.elements[key].value = p[key] || "";
      form.elements.namedItem("photos").value = (p.photos || []).join("\n");
      form.sample.checked = Boolean(p.sample);
      dirtyProject = false;
      main.querySelector("#editor-title").textContent = "עריכת פרויקט";
      syncDiscipline();
      form.title.focus();
    } else if (button.dataset.delete) {
      const id = button.dataset.delete;
      if (pendingDelete !== id) {
        pendingDelete = id;
        paintList();
        describeButtons();
        focusRow(id, "delete");
        form.querySelector(".inline-result").textContent =
          "לאישור המחיקה לחצו שוב על כפתור המחיקה של הפרויקט.";
        return;
      }
      if (
        editingId === id &&
        dirtyProject &&
        !(await confirmDiscard("יש שינויים בפרויקט הזה שלא נשמרו. למחוק אותו בכל זאת?"))
      )
        return;
      const index = draft.projects.findIndex((p) => p.id === id),
        next = { ...draft, projects: draft.projects.filter((p) => p.id !== id) };
      if (await persist(next, button, form.querySelector(".inline-result"))) {
        pendingDelete = null;
        paintList();
        describeButtons();
        if (editingId === id) reset();
        focusRow(draft.projects[Math.min(index, draft.projects.length - 1)]?.id, "edit");
      }
    } else if (button.dataset.move) {
      const projects = [...draft.projects],
        i = projects.findIndex((p) => p.id === button.dataset.move),
        j = i + Number(button.dataset.dir);
      if (j < 0 || j >= projects.length) return;
      [projects[i], projects[j]] = [projects[j], projects[i]];
      if (await persist({ ...draft, projects }, button, form.querySelector(".inline-result"))) {
        paintList();
        describeButtons();
        focusRow(button.dataset.move, "move");
      }
    }
  };
  main.querySelectorAll("[data-upload]").forEach(
    (input) =>
      (input.onchange = async () => {
        if (!input.files?.[0] || busy) return;
        const parent = input.closest("form"),
          field = parent.elements[input.dataset.upload],
          files = [...input.files],
          result = parent.querySelector(".inline-result");
        if (!lock()) return;
        let uploaded = 0;
        try {
          for (const [index, file] of files.entries()) {
            result.textContent =
              files.length > 1
                ? `מעבד ומעלה תמונה ${index + 1} מתוך ${files.length}…`
                : "מעבד ומעלה קובץ…";
            const url = await uploadMedia(file);
            const useAsCover =
              input.dataset.upload === "photos" &&
              index === 0 &&
              !parent.elements.image.value.trim();
            if (useAsCover) parent.elements.image.value = url;
            else
              field.value = input.multiple
                ? [field.value.trim(), url].filter(Boolean).join("\n")
                : url;
            uploaded++;
            if (parent === settings) dirtySettings = true;
            else dirtyProject = true;
          }
          result.textContent =
            files.length > 1
              ? `${uploaded} תמונות הועלו. לחצו על שמירת הפרויקט כדי לפרסם אותן.`
              : "הקובץ הועלה. לחצו על שמירה כדי לפרסם אותו באתר.";
        } catch (error) {
          result.textContent =
            files.length > 1 && uploaded
              ? `${error.message} הועלו ${uploaded} מתוך ${files.length}; הקישורים שהועלו נשארו בטופס.`
              : error.message;
        } finally {
          input.value = "";
          unlock();
        }
      }),
  );
  paintList();
  describeButtons();
  syncDiscipline();
}
function assetField(name, label, value) {
  return `<label>${label}<input name="${name}" type="url" dir="ltr" value="${e(value)}" placeholder="https://…"></label><label class="upload-label">או העלאת קובץ תמונה<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" data-upload="${name}" ${isPreview ? "disabled" : ""}></label>`;
}
