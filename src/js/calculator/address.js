export function initAddress({ onChange }) {
  const state = {
    mode: "collection",
    address: "",
    propType: "ground",
    floor: 1,
    lift: "yes",
    movers: "1",
    instructions: "",
    facility: "bloomsbury",
  };

  const blockCollection = document.getElementById("collectionBlock");
  const blockDropoff = document.getElementById("dropoffBlock");
  const apartmentFields = document.getElementById("apartmentFields");

  function updateState(key, value) {
    state[key] = value;
    if (onChange) onChange();
  }

  document.querySelectorAll('input[name="delivery_mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      document
        .getElementById("cardModeCollection")
        .classList.toggle("is-selected", e.target.value === "collection");
      document
        .getElementById("cardModeDropoff")
        .classList.toggle("is-selected", e.target.value === "dropoff");

      if (e.target.value === "collection") {
        blockCollection.style.display = "block";
        blockDropoff.style.display = "none";
      } else {
        blockCollection.style.display = "none";
        blockDropoff.style.display = "block";
      }
      updateState("mode", e.target.value);
    });
  });

  document.querySelectorAll('input[name="prop_type"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "apartment") {
        apartmentFields.style.display = "grid";
        gsap.fromTo(
          apartmentFields,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.3 },
        );
      } else {
        apartmentFields.style.display = "none";
      }
      updateState("propType", e.target.value);
    });
  });

  document
    .getElementById("fullAddress")
    .addEventListener("input", (e) => updateState("address", e.target.value));
  document
    .getElementById("aptFloor")
    .addEventListener("input", (e) =>
      updateState("floor", parseInt(e.target.value) || 1),
    );
  document
    .getElementById("specialInstructions")
    .addEventListener("input", (e) =>
      updateState("instructions", e.target.value),
    );

  document
    .querySelectorAll('input[name="lift"]')
    .forEach((radio) =>
      radio.addEventListener("change", (e) =>
        updateState("lift", e.target.value),
      ),
    );
  document
    .querySelectorAll('input[name="movers"]')
    .forEach((radio) =>
      radio.addEventListener("change", (e) =>
        updateState("movers", e.target.value),
      ),
    );

  document.querySelectorAll('input[name="facility"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      document
        .getElementById("facBloomsbury")
        .classList.toggle("is-selected", e.target.value === "bloomsbury");
      document
        .getElementById("facHackney")
        .classList.toggle("is-selected", e.target.value === "hackney");
      updateState("facility", e.target.value);
    });
  });

  return {
    getData: () => state,
  };
}
