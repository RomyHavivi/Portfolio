const dialog = document.createElement("dialog");
dialog.className = "confirm-dialog";
dialog.setAttribute("aria-labelledby", "confirm-title");
dialog.innerHTML =
  '<h2 id="confirm-title"></h2><p id="confirm-message"></p><div class="confirm-actions"><button type="button" data-answer="false" autofocus>להישאר כאן</button><button type="button" data-answer="true" class="solid-link">המשך ללא שמירה</button></div>';
document.body.append(dialog);
let pending = null,
  resolvePending = null;
export function lockPage() {
  document.body.classList.add("modal-open");
}
export function unlockPage() {
  if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
}
function answer(value) {
  const resolve = resolvePending;
  resolvePending = null;
  pending = null;
  dialog.close();
  unlockPage();
  resolve?.(value);
}
dialog.addEventListener("click", (event) => {
  const button = event.target.closest("[data-answer]");
  if (button) answer(button.dataset.answer === "true");
  else if (event.target === dialog) answer(false);
});
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  answer(false);
});
export function confirmDiscard(message = "יש שינויים שלא נשמרו. לצאת ולוותר עליהם?") {
  if (pending) return pending;
  dialog.querySelector("h2").textContent = "שינויים שלא נשמרו";
  dialog.querySelector("p").textContent = message;
  pending = new Promise((resolve) => {
    resolvePending = resolve;
  });
  lockPage();
  dialog.showModal();
  dialog.querySelector('[data-answer="false"]').focus();
  return pending;
}
