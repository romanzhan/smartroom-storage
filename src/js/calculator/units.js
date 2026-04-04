import { unitsData } from "./data.js";

const UNIT_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/></svg>`;

export function initUnits({ container, onChange }) {
  let selectedUnitId = null;

  function render() {
    container.innerHTML = "";

    unitsData.forEach((unit) => {
      const label = document.createElement("label");
      label.className = "unit-card";

      label.innerHTML = `
        <input type="radio" name="storage_unit" value="${unit.id}" class="unit-card__radio">
        <div class="unit-card__icon">${UNIT_SVG}</div>
        <div class="unit-card__info">
          <div class="unit-card__title">${unit.name}</div>
          <div class="unit-card__size">${unit.size}</div>
        </div>
        <div class="unit-card__price">£${unit.price.toFixed(2)} <span class="unit-card__per">/wk</span></div>
      `;

      label.querySelector("input").addEventListener("change", (e) => {
        container
          .querySelectorAll(".unit-card")
          .forEach((card) => card.classList.remove("is-selected"));
        if (e.target.checked) {
          label.classList.add("is-selected");
          selectedUnitId = e.target.value;

          if (onChange) onChange();
        }
      });

      container.appendChild(label);
    });
  }

  render();

  return {
    getSelectedUnit: () =>
      unitsData.find((u) => u.id === selectedUnitId) || null,
  };
}
