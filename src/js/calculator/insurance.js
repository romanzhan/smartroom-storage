export function initInsurance({ onChange }) {
  const boxesRadios = document.querySelectorAll(
    'input[name="insurance_boxes"]',
  );
  const furnitureRadios = document.querySelectorAll(
    'input[name="insurance_furniture"]',
  );

  const boxesHint = document.getElementById("insuranceBoxesHint");
  const furnitureHint = document.getElementById("insuranceFurnitureHint");

  boxesRadios.forEach((r) => r.addEventListener("change", () => {
    if (boxesHint) boxesHint.style.display = "none";
    onChange();
  }));
  furnitureRadios.forEach((r) => r.addEventListener("change", () => {
    if (furnitureHint) furnitureHint.style.display = "none";
    onChange();
  }));

  function getSelected(tab) {
    const name =
      tab === "boxes" ? "insurance_boxes" : "insurance_furniture";
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return null;
    return {
      cover: Number(checked.value),
      price: parseFloat(checked.dataset.price),
    };
  }

  function clearSelection(tab) {
    const name =
      tab === "boxes" ? "insurance_boxes" : "insurance_furniture";
    document.querySelectorAll(`input[name="${name}"]`).forEach((r) => {
      r.checked = false;
    });
  }

  return { getSelected, clearSelection };
}
