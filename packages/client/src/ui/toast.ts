/**
 * Transient toast messages (command errors + SimEvents): absolutely
 * positioned DOM divs in #toasts, visible ~2.5 s, then fade out.
 */

const VISIBLE_MS = 2500;
const FADE_MS = 400;
const MAX_TOASTS = 6;

export function showToast(text: string): void {
  const host = document.getElementById("toasts")!;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  host.appendChild(el);
  while (host.children.length > MAX_TOASTS) host.firstChild?.remove();
  window.setTimeout(() => el.classList.add("toast-out"), VISIBLE_MS);
  window.setTimeout(() => el.remove(), VISIBLE_MS + FADE_MS);
}
