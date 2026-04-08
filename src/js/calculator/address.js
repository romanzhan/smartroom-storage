function normPostcodeCompact(pc) {
  return (pc || "").toUpperCase().replace(/\s+/g, "");
}

/** Drop line 1 when it only duplicates Town / Postcode fields (e.g. postcode-only place). */
export function dedupeAddressLine1(line1, town, postcode) {
  const l1 = (line1 || "").trim().replace(/\s+/g, " ");
  if (!l1) return "";

  const t = (town || "").trim();
  const pc = (postcode || "").trim();

  if (pc && normPostcodeCompact(l1) === normPostcodeCompact(pc)) return "";

  if (t && l1.toLowerCase() === t.toLowerCase()) return "";

  if (!pc) return l1;

  const pcEsc = pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  let rest = l1.replace(new RegExp(pcEsc, "i"), "").replace(/,/g, " ").trim();
  rest = rest.replace(/\s+/g, " ");

  if (!rest) return "";
  if (t && rest.toLowerCase() === t.toLowerCase()) return "";

  const restNoCountry = rest
    .replace(/\b(UK|United Kingdom)\b/gi, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!restNoCountry) return "";
  if (t && restNoCountry.toLowerCase() === t.toLowerCase()) return "";

  return l1;
}

export function initAddress({ onChange, onPostcodeFieldInput }) {
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
    facility: "",
  };

  const blockCollection = document.getElementById("collectionBlock");
  const blockDropoff = document.getElementById("dropoffBlock");
  const apartmentFields = document.getElementById("apartmentFields");
  const floorField = document.getElementById("floorField");
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

  function showFloorField() {
    const liftVal = document.querySelector('input[name="lift"]:checked')?.value;
    if (liftVal === "no") {
      floorField.style.display = "";
      gsap.fromTo(floorField, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
    } else {
      floorField.style.display = "none";
    }
  }

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
        floorField.style.display = "none";
      }
      updateState("propType", e.target.value);
    });
  });

  document.querySelectorAll('input[name="lift"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      updateState("lift", e.target.value);
      showFloorField();
    });
  });

  function clearFieldError(el) {
    if (!el) return;
    el.classList.remove("is-invalid");
    const err = el.parentElement?.querySelector(".step2-field-error");
    if (err) err.remove();
  }

  if (elLine1) {
    elLine1.addEventListener("input", (e) => {
      clearFieldError(elLine1);
      updateState("addressLine1", e.target.value);
    });
  }
  if (elLine2) {
    elLine2.addEventListener("input", (e) =>
      updateState("addressLine2", e.target.value),
    );
  }
  if (elTown) {
    elTown.addEventListener("input", (e) => {
      clearFieldError(elTown);
      updateState("town", e.target.value);
    });
  }
  if (elPostcode) {
    elPostcode.addEventListener("input", (e) => {
      clearFieldError(elPostcode);
      updateState("postcode", e.target.value);
      if (onPostcodeFieldInput) onPostcodeFieldInput(e.target.value);
    });
  }

  document
    .getElementById("aptFloor")
    .addEventListener("change", (e) =>
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
      // Clear facility validation error
      const errEl = document.querySelector("#dropoffBlock .step2-field-error");
      if (errEl) errEl.remove();
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

    state.town = data.town || "";
    state.postcode = (data.postcode || "").trim().toUpperCase();
    state.addressLine1 = dedupeAddressLine1(
      data.addressLine1 || "",
      state.town,
      state.postcode,
    );
    state.addressLine2 = data.addressLine2 || "";

    if (elLine1) elLine1.value = state.addressLine1;
    if (elLine2) elLine2.value = state.addressLine2;
    if (elTown) elTown.value = state.town;
    if (elPostcode) elPostcode.value = state.postcode;

    recomposeAddress();
    updateDistanceHint();
    if (onChange) onChange();
  }

  /** Same postcode shown in header pill / step 1; does not clear street or town. */
  function syncPostcodeOnly(pc) {
    const v = (pc || "").trim().toUpperCase();
    state.postcode = v;
    if (elPostcode) elPostcode.value = v;
    recomposeAddress();
    if (onChange) onChange();
  }

  return {
    getData: () => state,
    applyFromPlace,
    resetCollectionFields,
    syncPostcodeOnly,
  };
}
