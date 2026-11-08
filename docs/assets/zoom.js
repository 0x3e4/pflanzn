// Screenshots open larger on a click (or Enter / Space when focused).
// Escape, a click anywhere or the close button closes them again.
// Served from the site itself, so the Content-Security-Policy stays 'self'.
(() => {
  const SELECTOR = ".md-typeset img:not(.twemoji):not(a img)";
  let dialog = null;

  const close = () => dialog?.close();

  const ensureDialog = () => {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "zoom";
    dialog.setAttribute("aria-label", "Enlarged image");
    dialog.innerHTML =
      '<button type="button" class="zoom__close" aria-label="Close">&times;</button><img alt="">';
    // Any click closes: on the backdrop, the image or the button.
    dialog.addEventListener("click", close);
    document.body.appendChild(dialog);
    return dialog;
  };

  const open = (img) => {
    const d = ensureDialog();
    const big = d.querySelector("img");
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    d.showModal();
    d.querySelector(".zoom__close").focus();
  };

  // Mark the images on each page; navigation.instant swaps the page content
  // without a reload, so this runs again on every page Material shows.
  const mark = () => {
    for (const img of document.querySelectorAll(SELECTOR)) {
      if (img.dataset.zoom) continue;
      img.dataset.zoom = "1";
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", `${img.alt || "Image"}: open larger`);
    }
  };

  // One delegated listener survives instant navigation.
  document.addEventListener("click", (event) => {
    const img = event.target.closest?.(SELECTOR);
    if (img) open(img);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const img = event.target.closest?.(SELECTOR);
    if (!img) return;
    event.preventDefault();
    open(img);
  });

  if (typeof document$ !== "undefined") {
    document$.subscribe(mark);
  } else {
    document.addEventListener("DOMContentLoaded", mark);
  }
})();
