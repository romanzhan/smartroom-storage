import { mockPostcodes } from "./data.js";

/**
 * Управление постиндексом: автокомплит, валидация, пилюля/режим редактирования.
 * A11y: ARIA listbox pattern + стрелки ↑↓ + Enter + Escape.
 */
export function initPostcode({
  form,
  errorText,
  currentPostcodeInput,
  mainAutocomplete,
  postcodePill,
  postcodeSearchMode,
  postcodeText,
  editInput,
  editAutocomplete,
}) {
  let savedPostcode = "";

  async function validate(value) {
    const clean = value.replace(/\s+/g, "").toUpperCase();
    return mockPostcodes.some((p) => p.replace(/\s+/g, "").toUpperCase() === clean);
  }

  function revertToPill() {
    postcodeSearchMode.style.display = "none";
    postcodePill.style.display = "flex";
    editAutocomplete.style.display = "none";
  }

  // --- ARIA helpers ---
  function setActiveDescendant(inputEl, itemEl) {
    if (itemEl) {
      inputEl.setAttribute("aria-activedescendant", itemEl.id);
    } else {
      inputEl.removeAttribute("aria-activedescendant");
    }
  }

  function renderDropdown(inputEl, listEl, matches, onSelect) {
    listEl.innerHTML = "";
    setActiveDescendant(inputEl, null);

    if (matches.length === 0) {
      listEl.style.display = "none";
      inputEl.setAttribute("aria-expanded", "false");
      return;
    }

    listEl.style.display = "block";
    inputEl.setAttribute("aria-expanded", "true");

    matches.forEach((match, i) => {
      const li = document.createElement("li");
      li.className = "autocomplete-item";
      li.id = `autocomplete-item-${inputEl.id}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:bottom;margin-right:8px" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${match}`;
      li.addEventListener("click", () => {
        inputEl.value = match;
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        setActiveDescendant(inputEl, null);
        if (onSelect) onSelect(match);
      });
      listEl.appendChild(li);
    });
  }

  function setupAutocomplete(inputEl, listEl, onSelectCallback) {
    // ARIA roles
    inputEl.setAttribute("role", "combobox");
    inputEl.setAttribute("aria-autocomplete", "list");
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.setAttribute("aria-haspopup", "listbox");
    listEl.setAttribute("role", "listbox");

    inputEl.addEventListener("input", () => {
      const val = inputEl.value.trim().toLowerCase();

      if (inputEl === currentPostcodeInput && form.classList.contains("is-invalid")) {
        form.classList.remove("is-invalid");
        gsap.to(errorText, { opacity: 0, duration: 0.2 });
        gsap.to(form.querySelector(".storage-form__helper"), { opacity: 1, duration: 0.2 });
      }
      if (inputEl === editInput && postcodeSearchMode.classList.contains("is-error")) {
        postcodeSearchMode.classList.remove("is-error");
      }

      if (!val) {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        return;
      }

      const matches = mockPostcodes.filter((p) =>
        p.toLowerCase().includes(val.replace(/\s+/g, ""))
      );
      renderDropdown(inputEl, listEl, matches, onSelectCallback);
    });

    // Keyboard navigation: ↑ ↓ Enter Escape
    inputEl.addEventListener("keydown", (e) => {
      const items = [...listEl.querySelectorAll(".autocomplete-item")];
      if (!items.length) return;

      const active = listEl.querySelector(".autocomplete-item.is-highlighted");
      let idx = items.indexOf(active);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[idx + 1] ?? items[0];
        highlightItem(items, next, inputEl);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[idx - 1] ?? items[items.length - 1];
        highlightItem(items, prev, inputEl);
      } else if (e.key === "Enter") {
        if (active) {
          e.preventDefault();
          active.click();
        }
        // если нет выделенного — стандартная обработка (submit/saveEdited)
      } else if (e.key === "Escape") {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        setActiveDescendant(inputEl, null);
        items.forEach((i) => i.classList.remove("is-highlighted"));
      }
    });

    document.addEventListener("click", (e) => {
      if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        if (inputEl === editInput && postcodeSearchMode.style.display !== "none") {
          revertToPill();
        }
      }
    });
  }

  function highlightItem(items, target, inputEl) {
    items.forEach((i) => {
      i.classList.remove("is-highlighted");
      i.setAttribute("aria-selected", "false");
    });
    target.classList.add("is-highlighted");
    target.setAttribute("aria-selected", "true");
    target.scrollIntoView({ block: "nearest" });
    setActiveDescendant(inputEl, target);
  }

  async function saveEdited(val) {
    if (!(await validate(val))) {
      postcodeSearchMode.classList.add("is-error");
      gsap.fromTo(postcodeSearchMode, { x: -5 }, { x: 5, duration: 0.1, yoyo: true, repeat: 3 });
      return;
    }
    postcodeSearchMode.classList.remove("is-error");
    savedPostcode = val.toUpperCase();
    postcodeText.textContent = savedPostcode;
    currentPostcodeInput.value = savedPostcode;
    revertToPill();
  }

  setupAutocomplete(currentPostcodeInput, mainAutocomplete);
  setupAutocomplete(editInput, editAutocomplete, (selected) => saveEdited(selected));

  // Edit pill button — доступен с клавиатуры (это уже <button>, ок)
  postcodePill.addEventListener("click", (e) => {
    e.stopPropagation();
    postcodePill.style.display = "none";
    postcodeSearchMode.style.display = "flex";
    editInput.value = "";
    editInput.focus();
  });

  editInput.addEventListener("keydown", (e) => {
    // Enter и Escape обрабатываются в setupAutocomplete выше,
    // но если дропдаун закрыт — обрабатываем здесь
    const items = [...editAutocomplete.querySelectorAll(".autocomplete-item")];
    const dropdownOpen = editAutocomplete.style.display === "block" && items.length > 0;
    const hasHighlighted = editAutocomplete.querySelector(".is-highlighted");

    if (e.key === "Enter" && !hasHighlighted) {
      e.preventDefault();
      saveEdited(editInput.value);
    } else if (e.key === "Escape" && !dropdownOpen) {
      revertToPill();
    }
  });

  return {
    validate,
    getSaved: () => savedPostcode,
    setSaved: (v) => { savedPostcode = v; },
    revertToPill,
  };
}
