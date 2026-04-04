export function initAddress({ onChange }) {
  const state = {
    mode: "collection",
    address: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    placeId: "",
    lat: null,
    lng: null,
    formattedAddress: "",
    distanceMiles: null,
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
  const distanceHint = document.getElementById("collectionDistanceHint");

  const elLine1 = document.getElementById("addressLine1");
  const elLine2 = document.getElementById("addressLine2");
  const elTown = document.getElementById("addressTown");
  const elPostcode = document.getElementById("addressPostcode");

  function recomposeAddress() {
    const parts = [
      state.addressLine1,
      state.addressLine2,
      state.town,
      state.postcode,
    ].filter((p) => (p || "").trim());
    state.address = parts.join(", ");
  }

  function updateDistanceHint() {
    if (!distanceHint) return;
    const m = state.distanceMiles;
    if (m != null && typeof m === "number" && !Number.isNaN(m)) {
      distanceHint.hidden = false;
      distanceHint.textContent = `About ${m.toFixed(1)} mi driving from Bloomsbury warehouse (20 Emerald St, WC1N 3QA).`;
    } else {
      distanceHint.hidden = true;
      distanceHint.textContent = "";
    }
  }

  function updateState(key, value) {
    state[key] = value;
    if (
      key === "addressLine1" ||
      key === "addressLine2" ||
      key === "town" ||
      key === "postcode"
    ) {
      recomposeAddress();
    }
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

  if (elLine1) {
    elLine1.addEventListener("input", (e) =>
      updateState("addressLine1", e.target.value),
    );
  }
  if (elLine2) {
    elLine2.addEventListener("input", (e) =>
      updateState("addressLine2", e.target.value),
    );
  }
  if (elTown) {
    elTown.addEventListener("input", (e) =>
      updateState("town", e.target.value),
    );
  }

  document
    .getElementById("aptFloor")
    .addEventListener("input", (e) =>
      updateState("floor", parseInt(e.target.value, 10) || 1),
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

  function resetCollectionFields() {
    state.addressLine1 = "";
    state.addressLine2 = "";
    state.town = "";
    state.postcode = "";
    state.placeId = "";
    state.lat = null;
    state.lng = null;
    state.formattedAddress = "";
    state.distanceMiles = null;
    state.address = "";
    if (elLine1) elLine1.value = "";
    if (elLine2) elLine2.value = "";
    if (elTown) elTown.value = "";
    if (elPostcode) elPostcode.value = "";
    updateDistanceHint();
    if (onChange) onChange();
  }

  function applyFromPlace(data) {
    if (!data || typeof data !== "object") return;

    state.placeId = data.placeId || "";
    state.lat = typeof data.lat === "number" ? data.lat : null;
    state.lng = typeof data.lng === "number" ? data.lng : null;
    state.formattedAddress = data.formattedAddress || "";
    state.distanceMiles =
      data.distanceMiles != null && !Number.isNaN(Number(data.distanceMiles))
        ? Number(data.distanceMiles)
        : null;

    state.addressLine1 = data.addressLine1 || "";
    state.addressLine2 = data.addressLine2 || "";
    state.town = data.town || "";
    state.postcode = (data.postcode || "").trim().toUpperCase();

    if (elLine1) elLine1.value = state.addressLine1;
    if (elLine2) elLine2.value = state.addressLine2;
    if (elTown) elTown.value = state.town;
    if (elPostcode) elPostcode.value = state.postcode;

    recomposeAddress();
    updateDistanceHint();
    if (onChange) onChange();
  }

  return {
    getData: () => state,
    applyFromPlace,
    resetCollectionFields,
  };
}
