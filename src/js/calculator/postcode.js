import {
  newSessionToken,
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  placeDetailsToResolved,
  fetchDrivingMilesImperial,
} from "./google-places.js";
import { createMapsApiGuard } from "./maps-api-guard.js";
import {
  getAutocompleteMemory,
  setAutocompleteMemory,
  getCachedResolvedPlace,
  setCachedResolvedPlace,
  warehouseKeyFromCoords,
} from "./places-cache.js";

function normPostcode(p) {
  return (p || "").replace(/\s+/g, "").toUpperCase();
}

function matchesAllowedList(list, postcode) {
  const n = normPostcode(postcode);
  return list.some((p) => normPostcode(p) === n);
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
}

export function initPostcode({
  googleMapsApiKey = "",
  restrictToAllowedPostcodes = false,
  allowedPostcodes,
  warehouseLatitude,
  warehouseLongitude,
  onPlaceResolved,
  form,
  errorText,
  currentPostcodeInput,
  mainAutocomplete,
  postcodePill,
  postcodeSearchMode,
  postcodeText,
  editInput,
  editAutocomplete,
}) {
  let savedPostcode = "";
  const list = Array.isArray(allowedPostcodes) ? allowedPostcodes : [];
  const apiKey = (googleMapsApiKey || "").trim();
  const mapsEnabled = Boolean(apiKey);
  const mapsGuard = createMapsApiGuard();

  const destLat =
    typeof warehouseLatitude === "number" && !Number.isNaN(warehouseLatitude)
      ? warehouseLatitude
      : 51.5229;
  const destLng =
    typeof warehouseLongitude === "number" && !Number.isNaN(warehouseLongitude)
      ? warehouseLongitude
      : -0.1195;
  const warehouseKey = warehouseKeyFromCoords(destLat, destLng);

  /** @type {{ placeId: string, postcode: string } | null} */
  let resolvedSelection = null;
  let mainSessionToken = newSessionToken();
  let editSessionToken = newSessionToken();

  function showMapsHelper(message) {
    const helper = form.querySelector(".storage-form__helper");
    if (!helper || !message) return;
    helper.textContent = message;
    helper.style.opacity = "1";
    gsap.fromTo(helper, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  }

  if (!mapsEnabled) {
    if (currentPostcodeInput) {
      currentPostcodeInput.disabled = true;
      currentPostcodeInput.setAttribute("aria-disabled", "true");
    }
    if (editInput) {
      editInput.disabled = true;
    }
    const submitBtn = form.querySelector(".storage-form__submit");
    if (submitBtn) submitBtn.disabled = true;
  }

  function validate(value) {
    const trimmed = (value || "").trim();
    if (!trimmed || !mapsEnabled) return false;

    if (!resolvedSelection?.placeId || !resolvedSelection.postcode) {
      return false;
    }
    if (normPostcode(trimmed) !== normPostcode(resolvedSelection.postcode)) {
      return false;
    }
    if (
      restrictToAllowedPostcodes &&
      !matchesAllowedList(list, resolvedSelection.postcode)
    ) {
      return false;
    }
    return true;
  }

  function clearResolved() {
    resolvedSelection = null;
  }

  function revertToPill() {
    postcodeSearchMode.style.display = "none";
    postcodePill.style.display = "flex";
    editAutocomplete.style.display = "none";
  }

  function setActiveDescendant(inputEl, itemEl) {
    if (itemEl) {
      inputEl.setAttribute("aria-activedescendant", itemEl.id);
    } else {
      inputEl.removeAttribute("aria-activedescendant");
    }
  }

  function renderDropdown(inputEl, listEl, items, onSelect) {
    listEl.innerHTML = "";
    setActiveDescendant(inputEl, null);

    if (items.length === 0) {
      listEl.style.display = "none";
      inputEl.setAttribute("aria-expanded", "false");
      return;
    }

    listEl.style.display = "block";
    inputEl.setAttribute("aria-expanded", "true");

    items.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "autocomplete-item";
      li.id = `autocomplete-item-${inputEl.id || "inp"}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.placeId = item.placeId || "";
      const label =
        typeof item === "string" ? item : item.text || item.label || "";
      li.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:bottom;margin-right:8px" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${label}`;
      li.addEventListener("click", () => {
        inputEl.value = label;
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        setActiveDescendant(inputEl, null);
        if (onSelect) onSelect(item);
      });
      listEl.appendChild(li);
    });
  }

  async function resolvePlaceSelection(placeId, sessionRef, inputEl) {
    if (!mapsEnabled || !placeId) return;

    const cached = getCachedResolvedPlace(warehouseKey, placeId);
    if (cached) {
      if (sessionRef === "edit") {
        editSessionToken = newSessionToken();
      } else {
        mainSessionToken = newSessionToken();
      }
      resolvedSelection = {
        placeId: cached.placeId || placeId,
        postcode: cached.postcode,
      };
      inputEl.value = (cached.postcode || "").toUpperCase();
      if (typeof onPlaceResolved === "function") {
        onPlaceResolved({ ...cached });
      }
      return;
    }

    if (!mapsGuard.tryPlaceDetails()) {
      showMapsHelper(mapsGuard.getLastMessage());
      clearResolved();
      return;
    }

    const sessionTokenForDetails =
      sessionRef === "edit" ? editSessionToken : mainSessionToken;
    let detailsRes;
    try {
      detailsRes = await fetchPlaceDetails(
        placeId,
        sessionTokenForDetails,
        apiKey,
      );
    } catch {
      mapsGuard.recordFailure(0);
      showMapsHelper("Could not load address details. Check your connection and try again.");
      clearResolved();
      return;
    }

    if (!detailsRes.ok) {
      mapsGuard.recordFailure(detailsRes.status);
      showMapsHelper(
        detailsRes.status === 403
          ? "Google denied this request. Check API key restrictions and enabled APIs."
          : "Could not load address details. Try again in a moment.",
      );
      clearResolved();
      return;
    }

    mapsGuard.recordSuccess();

    const resolved = placeDetailsToResolved(detailsRes.body);
    if (!resolved?.postcode) {
      clearResolved();
      return;
    }

    if (sessionRef === "edit") {
      editSessionToken = newSessionToken();
    } else {
      mainSessionToken = newSessionToken();
    }

    resolvedSelection = {
      placeId: resolved.placeId || placeId,
      postcode: resolved.postcode,
    };

    inputEl.value = resolved.postcode.toUpperCase();

    let distanceMiles = null;
    if (mapsGuard.tryDistanceMatrix()) {
      let dmRes;
      try {
        dmRes = await fetchDrivingMilesImperial(
          resolved.lat,
          resolved.lng,
          destLat,
          destLng,
          apiKey,
        );
      } catch {
        mapsGuard.recordFailure(0);
      }
      if (dmRes) {
        if (dmRes.ok) {
          mapsGuard.recordSuccess();
          distanceMiles = dmRes.miles;
        } else {
          mapsGuard.recordFailure(dmRes.status);
        }
      }
    }

    const payload = {
      ...resolved,
      distanceMiles,
    };

    if (typeof onPlaceResolved === "function") {
      onPlaceResolved(payload);
    }

    setCachedResolvedPlace(warehouseKey, resolved.placeId || placeId, payload);
  }

  function setupGoogleAutocomplete(inputEl, listEl, sessionRef) {
    const runFetch = debounce(async () => {
      if (!mapsEnabled) return;

      const val = inputEl.value.trim();
      if (!val) {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        return;
      }

      if (val.length < mapsGuard.minCharsAutocomplete) {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        return;
      }

      const mem = getAutocompleteMemory(val);
      if (mem) {
        renderDropdown(inputEl, listEl, mem, (item) => {
          void resolvePlaceSelection(item.placeId, sessionRef, inputEl);
        });
        return;
      }

      if (!mapsGuard.tryAutocomplete()) {
        showMapsHelper(mapsGuard.getLastMessage());
        listEl.style.display = "none";
        return;
      }

      const token = sessionRef === "edit" ? editSessionToken : mainSessionToken;
      let result;
      try {
        result = await fetchPlaceAutocomplete(val, token, apiKey);
      } catch {
        mapsGuard.recordFailure(0);
        showMapsHelper("Address search failed. Check your connection.");
        return;
      }

      if (!result.ok) {
        mapsGuard.recordFailure(result.status);
        showMapsHelper(
          result.status === 403
            ? "Google denied autocomplete. Check API key and Places API (New)."
            : "Address search unavailable. Try again shortly.",
        );
        renderDropdown(inputEl, listEl, [], () => {});
        return;
      }

      mapsGuard.recordSuccess();
      setAutocompleteMemory(val, result.predictions);
      renderDropdown(inputEl, listEl, result.predictions, (item) => {
        void resolvePlaceSelection(item.placeId, sessionRef, inputEl);
      });
    }, 350);

    inputEl.addEventListener("input", () => {
      clearResolved();

      if (inputEl === currentPostcodeInput && form.classList.contains("is-invalid")) {
        form.classList.remove("is-invalid");
        gsap.to(errorText, { opacity: 0, duration: 0.2 });
        gsap.to(form.querySelector(".storage-form__helper"), {
          opacity: 1,
          duration: 0.2,
        });
      }
      if (inputEl === editInput && postcodeSearchMode.classList.contains("is-error")) {
        postcodeSearchMode.classList.remove("is-error");
      }

      runFetch();
    });
  }

  function setupAutocomplete(inputEl, listEl, sessionRef) {
    inputEl.setAttribute("role", "combobox");
    inputEl.setAttribute("aria-autocomplete", "list");
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.setAttribute("aria-haspopup", "listbox");
    listEl.setAttribute("role", "listbox");

    if (mapsEnabled) {
      setupGoogleAutocomplete(inputEl, listEl, sessionRef);
    }

    inputEl.addEventListener("keydown", (e) => {
      const items = [...listEl.querySelectorAll(".autocomplete-item")];
      if (!items.length) return;

      const active = listEl.querySelector(".autocomplete-item.is-highlighted");
      let idx = items.indexOf(active);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[idx + 1] ?? items[0];
        highlightItem(items, next, inputEl);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[idx - 1] ?? items[items.length - 1];
        highlightItem(items, prev, inputEl);
      } else if (e.key === "Enter") {
        if (active) {
          e.preventDefault();
          active.click();
        }
      } else if (e.key === "Escape") {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        setActiveDescendant(inputEl, null);
        items.forEach((i) => i.classList.remove("is-highlighted"));
      }
    });

    document.addEventListener("click", (e) => {
      if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
        listEl.style.display = "none";
        inputEl.setAttribute("aria-expanded", "false");
        if (inputEl === editInput && postcodeSearchMode.style.display !== "none") {
          revertToPill();
        }
      }
    });
  }

  function highlightItem(items, target, inputEl) {
    items.forEach((i) => {
      i.classList.remove("is-highlighted");
      i.setAttribute("aria-selected", "false");
    });
    target.classList.add("is-highlighted");
    target.setAttribute("aria-selected", "true");
    target.scrollIntoView({ block: "nearest" });
    setActiveDescendant(inputEl, target);
  }

  function saveEdited(val) {
    if (!validate(val)) {
      postcodeSearchMode.classList.add("is-error");
      gsap.fromTo(postcodeSearchMode, { x: -5 }, { x: 5, duration: 0.1, yoyo: true, repeat: 3 });
      return;
    }
    postcodeSearchMode.classList.remove("is-error");
    const pc = (resolvedSelection?.postcode || val).trim().toUpperCase();
    savedPostcode = pc;
    postcodeText.textContent = savedPostcode;
    currentPostcodeInput.value = savedPostcode;
    revertToPill();
  }

  setupAutocomplete(currentPostcodeInput, mainAutocomplete, "main");
  setupAutocomplete(editInput, editAutocomplete, "edit");

  editInput.addEventListener("keydown", (e) => {
    const items = [...editAutocomplete.querySelectorAll(".autocomplete-item")];
    const dropdownOpen = editAutocomplete.style.display === "block" && items.length > 0;
    const hasHighlighted = editAutocomplete.querySelector(".is-highlighted");

    if (e.key === "Enter" && !hasHighlighted) {
      e.preventDefault();
      saveEdited(editInput.value);
    } else if (e.key === "Escape" && !dropdownOpen) {
      revertToPill();
    }
  });

  postcodePill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!mapsEnabled) return;
    postcodePill.style.display = "none";
    postcodeSearchMode.style.display = "flex";
    editInput.value = "";
    editSessionToken = newSessionToken();
    clearResolved();
    editInput.focus();
  });

  function resetForNewSession() {
    savedPostcode = "";
    clearResolved();
    mainSessionToken = newSessionToken();
    editSessionToken = newSessionToken();
    postcodeText.textContent = "";
    if (currentPostcodeInput) currentPostcodeInput.value = "";
    mainAutocomplete.innerHTML = "";
    mainAutocomplete.style.display = "none";
    editInput.value = "";
    editAutocomplete.innerHTML = "";
    editAutocomplete.style.display = "none";
    revertToPill();
  }

  return {
    mapsEnabled,
    validate,
    getSaved: () => savedPostcode,
    setSaved: (v) => {
      savedPostcode = (v || "").trim();
    },
    resetForNewSession,
    commitSavedFromValidSubmit: (rawInput) => {
      if (resolvedSelection?.postcode) {
        savedPostcode = resolvedSelection.postcode.trim().toUpperCase();
      } else {
        savedPostcode = (rawInput || "").trim().toUpperCase();
      }
      postcodeText.textContent = savedPostcode || "";
    },
    revertToPill,
    /** @returns {"missing"|"not_served"|"pick_required"|"no_api_key"|false} */
    validationReason: (rawInput) => {
      if (!mapsEnabled) return "no_api_key";
      const trimmed = (rawInput || "").trim();
      if (!trimmed) return "missing";
      if (!resolvedSelection?.placeId || !resolvedSelection.postcode) {
        return "pick_required";
      }
      if (normPostcode(trimmed) !== normPostcode(resolvedSelection.postcode)) {
        return "pick_required";
      }
      if (
        restrictToAllowedPostcodes &&
        !matchesAllowedList(list, resolvedSelection.postcode)
      ) {
        return "not_served";
      }
      return false;
    },
  };
}
