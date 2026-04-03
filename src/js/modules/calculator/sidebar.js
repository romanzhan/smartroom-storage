/**
 * UI-модуль Сайдбара.
 * Подписывается на Store и отрисовывает данные в DOM.
 * Не знает о бизнес-логике — только рендерит то, что получает из снимка стора.
 */
export function initSidebar({
  store,
  summaryItems,
  summarySubtotal,
  summaryTotal,
  continueBtn,
  mobileSummaryTotal,
  mobileContinueBtn,
  summaryCard,
  summaryMobileToggle,
}) {
  /** Рендер строк списка */
  function renderLines(lines, hasItems, currentTab) {
    summaryItems.innerHTML = "";

    if (!hasItems) {
      const empty = currentTab === "boxes"
        ? "Please select items to store."
        : "Please select a storage unit.";
      summaryItems.innerHTML = `<div class="summary-empty">${empty}</div>`;
      return;
    }

    lines.forEach(({ label, price, suffix }) => {
      const line = document.createElement("div");
      line.className = "summary-item-line";
      line.innerHTML = `<span>${label}</span><span>£${price.toFixed(2)}${suffix}</span>`;
      summaryItems.appendChild(line);
    });
  }

  /** Основной рендер — вызывается при каждом событии от Store */
  function render(_event, snapshot) {
    if (!snapshot) return;
    const { currentTab, hasItems, subtotal, lines } = snapshot;

    renderLines(lines, hasItems, currentTab);

    const priceText = `£${subtotal.toFixed(2)}`;
    if (summarySubtotal) summarySubtotal.textContent = priceText;
    if (summaryTotal) summaryTotal.textContent = priceText;
    if (mobileSummaryTotal) mobileSummaryTotal.textContent = priceText;

    const disabled = !hasItems;
    if (continueBtn) continueBtn.disabled = disabled;
    if (mobileContinueBtn) mobileContinueBtn.disabled = disabled;
  }

  // Мобильный аккордеон корзины
  if (summaryMobileToggle && summaryCard) {
    summaryMobileToggle.addEventListener("click", () =>
      summaryCard.classList.toggle("is-expanded")
    );
  }

  // Подписываемся на Store
  store.subscribe(render);

  // Первичный рендер
  render(null, store.getSnapshot());
}
