function focusableElements(panel) {
  if (!panel) return [];
  const sel =
    'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(panel.querySelectorAll(sel)).filter(
    (n) => !n.disabled && n.offsetParent !== null,
  );
}

/**
 * Escape + focus trap for calculator modals; focus restore via notifyClosed from callers.
 */
export function createCalcModalA11y({
  exitModal,
  switchModal,
  dateModal,
  dismissExitOnly,
  closeSwitchModal,
  closeDateModalCancel,
}) {
  let returnFocus = null;

  function getOpenModal() {
    if (exitModal?.style.display === "flex") return exitModal;
    if (switchModal?.style.display === "flex") return switchModal;
    if (dateModal?.style.display === "flex") return dateModal;
    return null;
  }

  function onKeyDown(e) {
    const open = getOpenModal();
    if (!open) return;

    const panel = open.querySelector(".calc-modal");
    if (!panel) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (open === exitModal) dismissExitOnly();
      else if (open === switchModal) closeSwitchModal();
      else if (open === dateModal) closeDateModalCancel();
      return;
    }

    if (e.key !== "Tab") return;

    const list = focusableElements(panel);
    if (list.length < 2) return;

    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", onKeyDown, true);

  return {
    notifyOpened(overlay) {
      returnFocus = document.activeElement;
      // Set ARIA attributes
      if (overlay) {
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        const heading = overlay.querySelector("h2, h3, .calc-modal__title");
        if (heading) {
          if (!heading.id) heading.id = "modal-title-" + Date.now();
          overlay.setAttribute("aria-labelledby", heading.id);
        }
      }
      const panel = overlay?.querySelector?.(".calc-modal");
      const list = focusableElements(panel);
      const closeBtn = panel?.querySelector(".calc-modal__close");
      const pick =
        closeBtn && list.includes(closeBtn) ? closeBtn : list[0];
      requestAnimationFrame(() => pick?.focus?.());
    },

    notifyClosed() {
      const el = returnFocus;
      returnFocus = null;
      requestAnimationFrame(() => el?.focus?.());
    },

    destroy() {
      document.removeEventListener("keydown", onKeyDown, true);
    },
  };
}
