/**
 * Default discount tiers (used when no config provided).
 * Sorted descending by minMonths — first match wins.
 */
const DEFAULT_TIERS = [
  { minMonths: 12, discount: 45 },
  { minMonths: 9, discount: 35 },
  { minMonths: 6, discount: 25 },
  { minMonths: 3, discount: 15 },
  { minMonths: 2, discount: 5 },
];

function makeGetDiscount(tiers) {
  const sorted = [...tiers].sort((a, b) => b.minMonths - a.minMonths);
  return function getDiscountPercent(months) {
    for (const tier of sorted) {
      if (months >= tier.minMonths) return tier.discount;
    }
    return 0;
  };
}

function updatePromo(promoEl, months, getDiscountPercent) {
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
  discountTiers,
}) {
  if (!minusBtn) return null;

  const tiers = Array.isArray(discountTiers) && discountTiers.length
    ? discountTiers
    : DEFAULT_TIERS;
  const getDiscountPercent = makeGetDiscount(tiers);

  let isRolling = false;

  function emitChange() {
    if (isRolling) {
      if (promoText) {
        promoText.innerHTML = `Discounts apply to fixed-term plans only. Choose a duration to unlock savings.`;
        promoText.style.display = "";
      }
    } else {
      updatePromo(promoText, parseInt(input.value), getDiscountPercent);
    }
    if (onChange) onChange();
  }

  // Set initial promo text
  updatePromo(promoText, parseInt(input.value), getDiscountPercent);

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
