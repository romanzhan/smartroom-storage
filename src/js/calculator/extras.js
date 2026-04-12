/**
 * Extras module — add-on services shown only for collection + furniture.
 * Each extra is either per-item (with qty selector) or a flag (checkbox).
 */
export function initExtras({ container, onChange, extrasCatalog }) {
  const catalog = Array.isArray(extrasCatalog) ? extrasCatalog : [];
  const quantities = {};
  const flags = new Set();

  if (!container) {
    return {
      getData: () => ({ quantities: {}, flags: [] }),
      show: () => {},
      hide: () => {},
    };
  }

  function render() {
    container.innerHTML = "";
    if (catalog.length === 0) return;

    catalog.forEach((extra) => {
      quantities[extra.id] = 0;

      const row = document.createElement("div");
      row.className = "extras-row";

      if (extra.perItem && extra.price > 0) {
        row.innerHTML = `
          <div class="extras-info">
            <span class="extras-name">${extra.name}</span>
            <span class="extras-price">£${extra.price.toFixed(2)} per item</span>
          </div>
          <div class="qty-control">
            <button type="button" class="qty-btn extras-minus" data-id="${extra.id}">−</button>
            <input type="number" class="qty-input extras-qty" id="extrasQty_${extra.id}" value="0" readonly>
            <button type="button" class="qty-btn extras-plus" data-id="${extra.id}">+</button>
          </div>`;
      } else {
        row.innerHTML = `
          <label class="extras-flag">
            <input type="checkbox" class="extras-checkbox" data-id="${extra.id}">
            <span class="extras-name">${extra.name}</span>
            ${extra.price > 0 ? `<span class="extras-price">£${extra.price.toFixed(2)}</span>` : '<span class="extras-price">Quote on request</span>'}
          </label>`;
      }

      container.appendChild(row);
    });

    // Wire up qty buttons
    container.querySelectorAll(".extras-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        quantities[id] = Math.max(0, (quantities[id] || 0) - 1);
        const input = document.getElementById(`extrasQty_${id}`);
        if (input) input.value = quantities[id];
        if (onChange) onChange();
      });
    });
    container.querySelectorAll(".extras-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        quantities[id] = (quantities[id] || 0) + 1;
        const input = document.getElementById(`extrasQty_${id}`);
        if (input) input.value = quantities[id];
        if (onChange) onChange();
      });
    });

    // Wire up checkboxes
    container.querySelectorAll(".extras-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.id;
        if (cb.checked) {
          flags.add(id);
        } else {
          flags.delete(id);
        }
        if (onChange) onChange();
      });
    });
  }

  render();

  return {
    getData: () => ({
      quantities: { ...quantities },
      flags: [...flags],
    }),
    show: () => { container.style.display = ""; },
    hide: () => { container.style.display = "none"; },
  };
}
