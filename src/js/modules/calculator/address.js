export function initAddress({ onChange }) {
  const state = {
    mode: "collection", // 'collection' | 'dropoff'
    address: "",
    propType: "ground", // 'ground' | 'apartment'
    floor: 1,
    lift: "yes", // 'yes' | 'no'
    movers: "1", // '1' | '2'
    instructions: "",
    facility: "bloomsbury", // 'bloomsbury' | 'hackney'
  };

  // DOM Elements
  const blockCollection = document.getElementById("collectionBlock");
  const blockDropoff = document.getElementById("dropoffBlock");
  const apartmentFields = document.getElementById("apartmentFields");

  // Sync inputs to State
  function updateState(key, value) {
    state[key] = value;
    if (onChange) onChange();
  }

  // Handle Mode Toggle (Collection vs Drop-off)
  document.querySelectorAll('input[name="delivery_mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      // Toggle card styles
      document
        .getElementById("cardModeCollection")
        .classList.toggle("is-selected", e.target.value === "collection");
      document
        .getElementById("cardModeDropoff")
        .classList.toggle("is-selected", e.target.value === "dropoff");

      // Toggle blocks
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

  // Handle Property Type Toggle (Ground vs Apartment)
  document.querySelectorAll('input[name="prop_type"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "apartment") {
        apartmentFields.style.display = "grid";
        // Small GSAP pop for smooth UI
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

  // Simple inputs
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

  // Radios
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

  // Facilities
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
