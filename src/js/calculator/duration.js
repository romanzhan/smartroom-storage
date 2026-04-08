/**
 * Discount tiers based on duration (months).
 * Returns discount percentage.
 */
function getDiscountPercent(months) {
  if (months >= 12) return 45;
  if (months >= 9) return 35;
  if (months >= 6) return 25;
  if (months >= 3) return 15;
  if (months >= 2) return 5;
  return 0;
}

function updatePromo(promoEl, months) {
  if (!promoEl) return;
  const pct = getDiscountPercent(months);
  if (pct > 0) {
    promoEl.innerHTML = `The longer you store, the more you save. Enjoy a <strong>${pct}% discount!</strong>`;
    promoEl.style.display = "";
  } else {
    promoEl.innerHTML = `Store for 2+ months to unlock a discount!`;
    promoEl.style.display = "";
  }
}

export function initDuration({
  minusBtn,
  plusBtn,
  input,
  toggleBtn,
  promoText,
  qtyWrap,
  rollingNote,
  onChange,
}) {
  if (!minusBtn) return null;

  let isRolling = false;

  function emitChange() {
    if (isRolling) {
      if (promoText) {
        promoText.innerHTML = `Discounts apply to fixed-term plans only. Choose a duration to unlock savings.`;
        promoText.style.display = "";
      }
    } else {
      updatePromo(promoText, parseInt(input.value));
    }
    if (onChange) onChange();
  }

  // Set initial promo text
  updatePromo(promoText, parseInt(input.value));

  minusBtn.addEventListener("click", () => {
    const val = parseInt(input.value);
    if (val > 1) {
      input.value = val - 1;
      emitChange();
    }
  });

  plusBtn.addEventListener("click", () => {
    const val = parseInt(input.value);
    if (val < 36) {
      input.value = val + 1;
      emitChange();
    }
  });

  toggleBtn.addEventListener("click", () => {
    isRolling = !isRolling;
    qtyWrap.classList.toggle("is-disabled", isRolling);
    toggleBtn.textContent = isRolling
      ? "I know my duration"
      : "Not sure how long?";
    if (rollingNote) rollingNote.style.display = isRolling ? "" : "none";
    emitChange();
  });

  return {
    getDuration: () => parseInt(input.value),
    isRollingPlan: () => isRolling,
    getDiscountPercent: () => getDiscountPercent(parseInt(input.value)),
  };
}
