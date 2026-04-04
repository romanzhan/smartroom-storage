export function initDuration({
  minusBtn,
  plusBtn,
  input,
  toggleBtn,
  promoText,
  rollingText,
  qtyWrap,
  onChange,
}) {
  if (!minusBtn) return null;

  let isRolling = false;

  function emitChange() {
    if (onChange) onChange();
  }

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
    promoText.style.display = isRolling ? "none" : "";
    rollingText.style.display = isRolling ? "block" : "none";
    toggleBtn.textContent = isRolling
      ? "I know my duration"
      : "Not sure how long?";
    emitChange();
  });

  return {
    getDuration: () => parseInt(input.value),
    isRollingPlan: () => isRolling,
  };
}
