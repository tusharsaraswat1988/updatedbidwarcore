/** Lazy-load LED/broadcast display fonts (Bebas Neue, Barlow Condensed). */
let displayFontsRequested = false;

export function loadDisplayFonts(): void {
  if (displayFontsRequested || typeof document === "undefined") return;
  displayFontsRequested = true;

  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${base}fonts/fonts-display.css`;
  document.head.appendChild(link);
}
