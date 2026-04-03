export function initDuration({
  minusBtn,
  plusBtn,
  input,
  toggleBtn,
  promoText,
  rollingText,
  qtyWrap,
}) {
  if (!minusBtn) return null; // Защита от ошибок

  let isRolling = false;

  minusBtn.addEventListener("click", () => {
    const val = parseInt(input.value);
    if (val > 1) input.value = val - 1;
  });

  plusBtn.addEventListener("click", () => {
    const val = parseInt(input.value);
    if (val < 36) input.value = val + 1;
  });

  toggleBtn.addEventListener("click", () => {
    isRolling = !isRolling;
    qtyWrap.classList.toggle("is-disabled", isRolling);
    promoText.style.display = isRolling ? "none" : "";
    rollingText.style.display = isRolling ? "block" : "none";
    toggleBtn.textContent = isRolling
      ? "I know my duration"
      : "Not sure how long?";
  });

  return {
    getDuration: () => parseInt(input.value),
    isRollingPlan: () => isRolling,
  };
}
