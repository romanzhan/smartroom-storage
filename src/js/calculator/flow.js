import {
  LS_CALC_KEY,
  POSTCODE_SUBMIT_DELAY_MS,
  FAKE_PAYMENT_DELAY_MS,
  DEFAULT_DURATION_MONTHS,
} from "./constants.js";
import {
  getPaymentSuccessPageUrl,
  PAYMENT_SUCCESS_SESSION_KEY,
} from "./success-redirect.js";
import { createCalcModalA11y } from "./modal-a11y.js";
import { listMissingFlowDom } from "./flow-guard.js";
import {
  CHECKOUT_EMAIL_RE,
  CHECKOUT_MSG,
  checkoutPhoneOk,
  evaluateCheckoutFields,
} from "./checkout-validation.js";
import {
  gsapFromTo,
  gsapScrollWindow,
  gsapTo,
  isValidDate,
} from "../lib/runtime-utils.js";

const g =
  typeof globalThis !== "undefined" && globalThis.gsap
    ? globalThis.gsap
    : null;

export function attachCalculatorFlow({
  dom,
  store,
  postcode,
  animateExpand,
  animateCollapse,
}) {
  let pendingSwitchValue = null;
  let pendingSwitchButton = null;
  let fakeStripeCheckoutInFlight = false;

  const {
    form,
    toggleButtons,
    hiddenInput,
    errorText,
    panel,
    messages,
    initialView,
    expandedView,
    sharedToggle,
    toggleExpandedSlot,
    backBtn,
    currentPostcodeInput,
    postcodeSearchMode,
    postcodeText,
    calcBoxesView,
    calcFurnitureView,
    desktopStepBackBtn,
    mobileStepBackBtn,
    continueBtn,
    mobileContinueBtn,
    continueBtnText,
    continueBtnSpinner,
    contactName,
    contactPhone,
    contactEmail,
    contactNameError,
    contactPhoneError,
    contactEmailError,
    termsError,
    termsCheckbox,
    sidebarTermsBox,
    checkoutSummaryBox,
    dateModal,
    exitModal,
    switchModal,
    btnCancelSwitch,
    btnConfirmSwitch,
    modalBtnChange,
    modalBtnConfirm,
    btnOpenCalendar,
    btnExitSave,
    btnExitDiscard,
    btnExitCancel,
    step1Container,
    step2Container,
    step3Container,
    step4Container,
    calcSidebar,
    panelTopBar,
    calcStepsHeader,
    calcLayoutArea,
  } = dom;

  const missingDom = listMissingFlowDom(dom);
  if (missingDom.length > 0) {
    console.error(
      "[SmartRoom] Calculator flow disabled — missing DOM:",
      missingDom.join(", "),
    );
    return;
  }

  let modalA11y = {
    notifyOpened() {},
    notifyClosed() {},
  };

  function dismissExitModalOnly() {
    gsapTo(g, exitModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        exitModal.style.display = "none";
        modalA11y.notifyClosed();
      },
    });
  }

  function clearCheckoutFieldError(field) {
    if (field === "name") {
      if (contactNameError) {
        contactNameError.textContent = "";
        contactNameError.hidden = true;
      }
      contactName?.classList.remove("is-invalid");
    } else if (field === "phone") {
      if (contactPhoneError) {
        contactPhoneError.textContent = "";
        contactPhoneError.hidden = true;
      }
      contactPhone?.classList.remove("is-invalid");
    } else if (field === "email") {
      if (contactEmailError) {
        contactEmailError.textContent = "";
        contactEmailError.hidden = true;
      }
      contactEmail?.classList.remove("is-invalid");
    } else if (field === "terms") {
      if (termsError) {
        termsError.textContent = "";
        termsError.hidden = true;
      }
      sidebarTermsBox?.classList.remove("is-invalid-terms");
    }
  }

  function clearAllCheckoutFieldErrors() {
    ["name", "phone", "email", "terms"].forEach(clearCheckoutFieldError);
  }

  function setCheckoutFieldError(field, message) {
    if (field === "name" && contactNameError) {
      contactNameError.textContent = message;
      contactNameError.hidden = false;
      contactName?.classList.add("is-invalid");
    } else if (field === "phone" && contactPhoneError) {
      contactPhoneError.textContent = message;
      contactPhoneError.hidden = false;
      contactPhone?.classList.add("is-invalid");
    } else if (field === "email" && contactEmailError) {
      contactEmailError.textContent = message;
      contactEmailError.hidden = false;
      contactEmail?.classList.add("is-invalid");
    } else if (field === "terms" && termsError) {
      termsError.textContent = message;
      termsError.hidden = false;
      sidebarTermsBox?.classList.add("is-invalid-terms");
    }
  }

  function shakeCheckoutField(field) {
    const el =
      field === "terms"
        ? sidebarTermsBox
        : form.querySelector(`[data-checkout-field="${field}"]`);
    if (!el) return;
    el.classList.remove("checkout-field--shake");
    el.offsetWidth;
    el.classList.add("checkout-field--shake");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("checkout-field--shake"),
      { once: true },
    );
  }

  function showCheckoutValidationErrors() {
    if (store.currentStep !== 4) return false;
    const v = evaluateCheckoutFields({
      contactName,
      contactPhone,
      contactEmail,
      termsCheckbox,
    });
    if (!v.nameOk) setCheckoutFieldError("name", CHECKOUT_MSG.name);
    else clearCheckoutFieldError("name");
    if (!v.phoneOk) setCheckoutFieldError("phone", CHECKOUT_MSG.phone);
    else clearCheckoutFieldError("phone");
    if (!v.emailOk) setCheckoutFieldError("email", CHECKOUT_MSG.email);
    else clearCheckoutFieldError("email");
    if (!v.termsOk) setCheckoutFieldError("terms", CHECKOUT_MSG.terms);
    else clearCheckoutFieldError("terms");

    if (!v.ok && v.firstInvalid) {
      shakeCheckoutField(v.firstInvalid);
      const scrollEl =
        v.firstInvalid === "terms"
          ? sidebarTermsBox
          : form.querySelector(`[data-checkout-field="${v.firstInvalid}"]`);
      scrollEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function switchCalculator(targetValue) {
    const viewToHide =
      targetValue === "boxes" ? calcFurnitureView : calcBoxesView;
    const viewToShow =
      targetValue === "boxes" ? calcBoxesView : calcFurnitureView;
    if (!viewToHide || !viewToShow || !panel) return;

    store.currentTab = targetValue;
    store.notify();

    if (panel.classList.contains("is-expanded")) {
      gsapTo(g, viewToHide, {
        opacity: 0,
        duration: 0.2,
        onComplete: () => {
          viewToHide.style.display = "none";
          viewToShow.style.display = "block";
          gsapTo(g, viewToShow, {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          });
        },
      });
    } else {
      viewToHide.style.display = "none";
      viewToHide.style.opacity = "0";
      viewToShow.style.display = "block";
      viewToShow.style.opacity = "1";
    }
  }

  function executeSwitch(buttonEl, targetValue) {
    toggleButtons.forEach((btn) => btn.classList.remove("is-active"));
    buttonEl.classList.add("is-active");
    hiddenInput.value = targetValue;
    switchCalculator(targetValue);
  }

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (this.classList.contains("is-active")) return;
      const targetValue = this.getAttribute("data-value");

      if (store.currentStep > 1) {
        pendingSwitchValue = targetValue;
        pendingSwitchButton = this;
        switchModal.style.display = "flex";
        gsapTo(g, switchModal, { opacity: 1, duration: 0.2 });
        gsapFromTo(
          g,
          switchModal.querySelector(".calc-modal"),
          { y: 20 },
          { y: 0, duration: 0.3, ease: "power2.out" },
        );
        modalA11y.notifyOpened(switchModal);
      } else {
        executeSwitch(this, targetValue);
      }
    });
  });

  btnCancelSwitch.addEventListener("click", () => {
    gsapTo(g, switchModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        switchModal.style.display = "none";
        modalA11y.notifyClosed();
      },
    });
    pendingSwitchValue = null;
    pendingSwitchButton = null;
  });

  btnConfirmSwitch.addEventListener("click", () => {
    gsapTo(g, switchModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        switchModal.style.display = "none";
        modalA11y.notifyClosed();
      },
    });
    // Keep the resolved postcode when switching between Boxes/Furniture tabs
    // so users don't need to re-enter their address.
    triggerFullReset({ keepPostcode: true });
    if (pendingSwitchButton && pendingSwitchValue) {
      executeSwitch(pendingSwitchButton, pendingSwitchValue);
    }
  });

  function updateBackButtonsVisibility() {
    const displayStyle =
      store.currentStep > 1 && store.currentStep < 5 ? "flex" : "none";
    if (desktopStepBackBtn) desktopStepBackBtn.style.display = displayStyle;
    if (mobileStepBackBtn) mobileStepBackBtn.style.display = displayStyle;

    if (store.currentStep === 4) {
      if (sidebarTermsBox) sidebarTermsBox.style.display = "block";
      if (continueBtnText) continueBtnText.textContent = "Book Now";
      if (mobileContinueBtn) mobileContinueBtn.textContent = "Book Now";
      validateCheckoutForm();
    } else {
      if (sidebarTermsBox) sidebarTermsBox.style.display = "none";
      if (continueBtnText) continueBtnText.textContent = "Continue";
      if (mobileContinueBtn) mobileContinueBtn.textContent = "Continue";
      const snap = store.getSnapshot();
      if (continueBtn) continueBtn.disabled = !snap.hasItems;
      if (mobileContinueBtn) mobileContinueBtn.disabled = !snap.hasItems;
    }
  }

  function validateCheckoutForm() {
    if (store.currentStep !== 4) return;
    if (continueBtn) continueBtn.disabled = false;
    if (mobileContinueBtn) mobileContinueBtn.disabled = false;
  }

  if (contactName) {
    contactName.addEventListener("input", () => {
      clearCheckoutFieldError("name");
      validateCheckoutForm();
    });
    contactName.addEventListener("blur", () => {
      if (store.currentStep !== 4) return;
      if (contactName.value.trim().length < 2)
        setCheckoutFieldError("name", CHECKOUT_MSG.name);
    });
  }
  if (contactPhone) {
    contactPhone.addEventListener("input", () => {
      clearCheckoutFieldError("phone");
      validateCheckoutForm();
    });
    contactPhone.addEventListener("blur", () => {
      if (store.currentStep !== 4) return;
      if (!checkoutPhoneOk(contactPhone.value))
        setCheckoutFieldError("phone", CHECKOUT_MSG.phone);
    });
  }
  if (contactEmail) {
    contactEmail.addEventListener("input", () => {
      clearCheckoutFieldError("email");
      validateCheckoutForm();
    });
    contactEmail.addEventListener("blur", () => {
      if (store.currentStep !== 4) return;
      if (!CHECKOUT_EMAIL_RE.test(contactEmail.value.trim()))
        setCheckoutFieldError("email", CHECKOUT_MSG.email);
    });
  }
  if (termsCheckbox) {
    termsCheckbox.addEventListener("change", () => {
      clearCheckoutFieldError("terms");
      validateCheckoutForm();
    });
  }

  function populateCheckoutSummary() {
    if (!checkoutSummaryBox) return;
    const addr = store.modules.address?.getData();
    const date = store.modules.date?.getData();

    let html = "";
    if (addr?.mode === "collection") {
      html += `<p><strong>Service:</strong> Home Collection</p>`;
      html += `<p><strong>Address:</strong> ${addr.address || "Not provided"}, Postcode: ${postcode.getSaved()}</p>`;
      if (date && isValidDate(date.date)) {
        const dateStr = date.date.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const tw =
          typeof date.timeWindow === "string" ? date.timeWindow : "";
        html += `<p><strong>Date & Time:</strong> ${dateStr}${tw ? ` between ${tw}` : ""}</p>`;
      }
    } else {
      const facName =
        addr?.facility === "bloomsbury"
          ? "Bloomsbury (WC1N 3QA)"
          : "Hackney (N16 8DR)";
      html += `<p><strong>Service:</strong> Drop-off</p>`;
      html += `<p><strong>Location:</strong> ${facName}</p>`;
      if (date && isValidDate(date.date)) {
        const dateStr = date.date.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        html += `<p><strong>Drop-off Date:</strong> ${dateStr}</p>`;
      }
    }
    checkoutSummaryBox.innerHTML = html;
  }

  function transitionSteps(hideId, showId, newStepNumber) {
    const hideEl = document.getElementById(hideId);
    const showEl = document.getElementById(showId);
    if (!hideEl || !showEl) {
      console.error(
        "[SmartRoom] transitionSteps: missing container",
        hideId,
        showId,
      );
      return;
    }
    gsapTo(g, hideEl, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        hideEl.style.display = "none";
        showEl.style.display = "block";
        gsapTo(g, showEl, { opacity: 1, duration: 0.3 });

        document.querySelectorAll(".step").forEach((el, idx) => {
          el.classList.toggle("is-active", idx === newStepNumber - 1);
        });

        const headerHeight =
          document.querySelector(".site-header")?.offsetHeight || 80;
        if (toggleExpandedSlot) {
          gsapScrollWindow(g, {
            scrollTo: { y: toggleExpandedSlot, offsetY: headerHeight },
            duration: 0.5,
          });
        }
      },
    });
  }

  function moveToStep4() {
    clearAllCheckoutFieldErrors();
    store.currentStep = 4;
    populateCheckoutSummary();
    store.notify();
    transitionSteps("step3Container", "step4Container", 4);
    updateBackButtonsVisibility();
  }

  function validateStep2() {
    const addr = store.modules.address?.getData();
    if (!addr) return null;

    // Clear previous errors
    document.querySelectorAll(".step2-field-error").forEach((el) => el.remove());
    document.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));

    function showError(fieldEl, msg) {
      fieldEl.classList.add("is-invalid");
      const err = document.createElement("p");
      err.className = "step2-field-error insurance-hint";
      err.textContent = msg;
      err.style.display = "block";
      fieldEl.parentElement.appendChild(err);
    }

    if (!addr.mode) {
      const modeGrid = document.querySelector("#step2Container .units-grid");
      if (modeGrid) {
        const err = document.createElement("p");
        err.className = "step2-field-error insurance-hint";
        err.textContent = "Please select Collection or Drop-off";
        err.style.display = "block";
        modeGrid.parentElement.appendChild(err);
        modeGrid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return true;
    }

    if (addr.mode === "collection") {
      const postEl = document.getElementById("addressPostcode");
      const line1El = document.getElementById("addressLine1");
      const townEl = document.getElementById("addressTown");

      if (!addr.postcode?.trim()) {
        showError(postEl, "Postcode is required");
        postEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      if (!addr.addressLine1?.trim()) {
        showError(line1El, "Address is required");
        line1El.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      if (!addr.town?.trim()) {
        showError(townEl, "Town is required");
        townEl.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
    } else {
      // dropoff — facility must be selected
      if (!addr.facility) {
        const facilityGrid = document.querySelector("#dropoffBlock .units-grid");
        if (facilityGrid) {
          const err = document.createElement("p");
          err.className = "step2-field-error insurance-hint";
          err.textContent = "Please select a facility";
          err.style.display = "block";
          facilityGrid.parentElement.appendChild(err);
          facilityGrid.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return true;
      }
    }
    return null;
  }

  function handleNextStep() {
    if (store.currentStep === 1) {
      const snap = store.getSnapshot();
      if (!snap.hasItems) {
        const listId = snap.currentTab === "boxes" ? "boxesItemsList" : "unitsListContainer";
        const el = document.getElementById(listId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!snap.hasInsurance) {
        const hintId = snap.currentTab === "boxes" ? "insuranceBoxesHint" : "insuranceFurnitureHint";
        const hint = document.getElementById(hintId);
        if (hint) {
          hint.style.display = "block";
          hint.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      store.currentStep = 2;
      store.notify();
      transitionSteps("step1Container", "step2Container", 2);
    } else if (store.currentStep === 2) {
      const addrErr = validateStep2();
      if (addrErr) return;
      store.currentStep = 3;
      store.notify();
      if (store.modules.date) store.modules.date.reRenderCalendar();
      transitionSteps("step2Container", "step3Container", 3);
    } else if (store.currentStep === 3) {
      const dateData = store.modules.date?.getData?.();
      if (!dateData?.timeWindow) {
        const hint = document.getElementById("timeSlotHint");
        if (hint) {
          hint.style.display = "block";
          hint.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      if (!dateData || dateData.hasInteracted) {
        moveToStep4();
      } else {
        dateModal.style.display = "flex";
        gsapTo(g, dateModal, { opacity: 1, duration: 0.2 });
        gsapFromTo(
          g,
          dateModal.querySelector(".calc-modal"),
          { y: 20 },
          { y: 0, duration: 0.3, ease: "power2.out" },
        );
        modalA11y.notifyOpened(dateModal);
      }
    } else if (store.currentStep === 4) {
      if (!showCheckoutValidationErrors()) return;
      processFakePayment();
      return;
    }
    updateBackButtonsVisibility();
  }

  function handlePrevStep() {
    if (store.currentStep === 4) {
      clearAllCheckoutFieldErrors();
      store.currentStep = 3;
      store.notify();
      transitionSteps("step4Container", "step3Container", 3);
    } else if (store.currentStep === 3) {
      store.currentStep = 2;
      store.notify();
      transitionSteps("step3Container", "step2Container", 2);
    } else if (store.currentStep === 2) {
      store.currentStep = 1;
      store.notify();
      transitionSteps("step2Container", "step1Container", 1);
    }
    updateBackButtonsVisibility();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (store.currentStep > 1) {
      if (store.currentStep === 4 && continueBtn && !continueBtn.disabled) {
        handleNextStep();
      }
      return;
    }
    const value = currentPostcodeInput ? currentPostcodeInput.value.trim() : "";
    const reason = postcode.validationReason(value);
    if (reason) {
      const helper = form.querySelector(".storage-form__helper");
      gsapTo(g, helper, {
        opacity: 0,
        duration: 0.2,
      });
      if (errorText) {
        gsapTo(g, errorText, { opacity: 1, duration: 0.2 });
        errorText.textContent =
          reason === "no_api_key"
            ? "Нужен ключ Google Maps: .env (VITE_GOOGLE_MAPS_API_KEY) или inline-maps-api-key.js, затем пересборка."
            : reason === "missing"
              ? "Please enter your postcode to continue"
              : reason === "pick_required"
                ? "Please choose an address from the suggestions."
                : "We currently do not serve this area.";
      }
      form.classList.add("is-invalid");
      if (currentPostcodeInput) currentPostcodeInput.focus();
      return;
    }
    postcode.commitSavedFromValidSubmit(value);
    postcodeText.textContent = postcode.getSaved();
    form.classList.remove("is-invalid");

    if (currentPostcodeInput) currentPostcodeInput.disabled = true;
    if (messages) messages.style.display = "none";
    animateExpand({
      panel,
      initialView,
      expandedView,
      sharedToggle,
      toggleExpandedSlot,
      messages,
    });
  });

  desktopStepBackBtn.addEventListener("click", handlePrevStep);
  mobileStepBackBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlePrevStep();
  });

  continueBtn.addEventListener("click", handleNextStep);
  mobileContinueBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleNextStep();
  });

  modalBtnChange.addEventListener("click", () => {
    gsapTo(g, dateModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        dateModal.style.display = "none";
        modalA11y.notifyClosed();
      },
    });
    if (btnOpenCalendar) btnOpenCalendar.click();
  });

  modalBtnConfirm.addEventListener("click", () => {
    gsapTo(g, dateModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        dateModal.style.display = "none";
        modalA11y.notifyClosed();
      },
    });
    moveToStep4();
  });

  modalA11y = createCalcModalA11y({
    exitModal,
    switchModal,
    dateModal,
    dismissExitOnly: dismissExitModalOnly,
    closeSwitchModal: () => btnCancelSwitch.click(),
    closeDateModalCancel: () => modalBtnChange.click(),
  });

  function resetBookNowLoadingUi() {
    fakeStripeCheckoutInFlight = false;
    continueBtn.removeAttribute("aria-busy");
    continueBtn.removeAttribute("title");
    mobileContinueBtn.removeAttribute("aria-busy");
    if (continueBtnText) continueBtnText.style.display = "block";
    if (continueBtnSpinner) continueBtnSpinner.style.display = "none";
    if (store.currentStep === 4) {
      if (continueBtnText) continueBtnText.textContent = "Book Now";
      mobileContinueBtn.textContent = "Book Now";
      continueBtn.disabled = false;
      mobileContinueBtn.disabled = false;
    } else {
      validateCheckoutForm();
    }
  }

  function processFakePayment() {
    if (fakeStripeCheckoutInFlight || store.currentStep !== 4) return;

    fakeStripeCheckoutInFlight = true;
    continueBtn.setAttribute("aria-busy", "true");
    mobileContinueBtn.setAttribute("aria-busy", "true");
    if (continueBtnText) continueBtnText.style.display = "none";
    if (continueBtnSpinner) continueBtnSpinner.style.display = "block";
    continueBtn.disabled = true;
    mobileContinueBtn.textContent = "Processing…";
    mobileContinueBtn.disabled = true;

    const endpoint = store.siteConfig?.checkoutEndpoint;

    if (endpoint) {
      // ── Real checkout via WP / Stripe ──
      continueBtn.setAttribute("title", "Redirecting to Stripe…");
      const snap = store.getSnapshot();
      const addr = store.modules.address?.getData() ?? null;
      const dateData = store.modules.date?.getData() ?? null;
      const extrasData = store.modules.extras?.getData() ?? null;
      const itemsData = store.modules.items?.getData() ?? [];
      const unitData = store.modules.units?.getSelectedUnit() ?? null;
      const insuranceData = store.modules.insurance?.getSelected(snap.currentTab) ?? null;

      const payload = {
        tab: snap.currentTab,
        customer: {
          name: (contactName?.value ?? "").trim(),
          phone: (contactPhone?.value ?? "").trim(),
          email: (contactEmail?.value ?? "").trim(),
        },
        items: snap.currentTab === "boxes"
          ? itemsData.filter((i) => i.qty > 0).map((i) => ({
              id: i.id, name: i.name, qty: i.qty, price: i.price,
            }))
          : (unitData ? [{ id: unitData.id, name: unitData.name, qty: 1, price: unitData.price }] : []),
        insurance: insuranceData,
        address: addr,
        date: dateData && dateData.date instanceof Date && !isNaN(dateData.date)
          ? {
              iso: dateData.date.toISOString(),
              timeWindow: dateData.timeWindow || "",
              windowType: dateData.windowType || "",
            }
          : null,
        extras: extrasData,
        duration: snap.duration,
        isRolling: snap.isRolling,
        totals: {
          storagePrice: snap.storagePrice,
          insurancePrice: snap.insurancePrice,
          collectionFee: snap.collectionFee,
          vatAmount: snap.vatAmount,
          subtotal: snap.subtotal,
          monthlyPayment: snap.monthlyPayment,
        },
        bookingDetails: snap.bookingDetails,
      };

      const headers = { "Content-Type": "application/json" };
      const nonce = store.siteConfig?.wpNonce;
      if (nonce) headers["X-WP-Nonce"] = nonce;

      fetch(endpoint, {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify(payload),
      })
        .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
        .then(({ ok, body }) => {
          if (!ok || !body || !body.checkout_url) {
            throw new Error(body?.message || "Checkout failed");
          }
          localStorage.removeItem(LS_CALC_KEY);
          // When the calculator is embedded in an iframe (shortcode),
          // redirect the TOP window so Stripe loads full-page instead of
          // trying (and failing) to render inside the iframe.
          const target = (() => {
            try {
              return window.top && window.top !== window ? window.top : window;
            } catch {
              return window;
            }
          })();
          target.location.assign(body.checkout_url);
        })
        .catch((err) => {
          console.error("[SmartRoom] Checkout failed", err);
          fakeStripeCheckoutInFlight = false;
          store.currentStep = 4;
          resetBookNowLoadingUi();
          alert("Payment error: " + (err?.message || "please try again."));
        });
      return;
    }

    // ── Fallback: fake checkout for local dev ──
    continueBtn.setAttribute(
      "title",
      "Simulated Stripe checkout for testing — no charge",
    );
    mobileContinueBtn.textContent = "Processing with Stripe (demo)…";

    setTimeout(() => {
      try {
        fakeStripeCheckoutInFlight = false;
        store.currentStep = 5;
        showSuccessScreen();
      } catch (err) {
        console.error(err);
        store.currentStep = 4;
        resetBookNowLoadingUi();
      }
    }, FAKE_PAYMENT_DELAY_MS);
  }

  function showSuccessScreen() {
    continueBtn.removeAttribute("aria-busy");
    continueBtn.removeAttribute("title");
    mobileContinueBtn.removeAttribute("aria-busy");

    const snap = store.getSnapshot();
    const isFurniture = snap.currentTab === "furniture";
    const isCollection =
      store.modules.address?.getData()?.mode === "collection";

    try {
      sessionStorage.setItem(
        PAYMENT_SUCCESS_SESSION_KEY,
        JSON.stringify({
          isFurniture,
          isCollection,
          completedAt: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }

    localStorage.removeItem(LS_CALC_KEY);
    const target = (() => {
      try {
        return window.top && window.top !== window ? window.top : window;
      } catch {
        return window;
      }
    })();
    target.location.assign(getPaymentSuccessPageUrl());
  }

  backBtn.addEventListener("click", () => {
    exitModal.style.display = "flex";
    gsapTo(g, exitModal, { opacity: 1, duration: 0.2 });
    gsapFromTo(
      g,
      exitModal.querySelector(".calc-modal"),
      { y: 20 },
      { y: 0, duration: 0.3, ease: "power2.out" },
    );
    modalA11y.notifyOpened(exitModal);
  });

  function closeCalculatorCompletely() {
    dismissExitModalOnly();
    animateCollapse({
      panel,
      initialView,
      expandedView,
      sharedToggle,
      messages,
      currentPostcodeInput,
      revertToPill: postcode.revertToPill,
      postcodeSearchMode,
    });
  }

  if (btnExitCancel) {
    btnExitCancel.addEventListener("click", (e) => {
      e.preventDefault();
      dismissExitModalOnly();
    });
  }

  btnExitSave.addEventListener("click", () => {
    const snapshot = store.getSnapshot();
    localStorage.setItem(LS_CALC_KEY, JSON.stringify(snapshot));
    closeCalculatorCompletely();
  });

  function triggerFullReset(options = {}) {
    const { keepPostcode = false } = options;
    localStorage.removeItem(LS_CALC_KEY);
    clearAllCheckoutFieldErrors();

    // Snapshot the resolved place so we can re-apply it after reset
    const savedPayloadBeforeReset = keepPostcode
      ? postcode.getSavedPayload?.() ?? null
      : null;

    const itemInputs = document.querySelectorAll("#boxesItemsList .qty-input");
    itemInputs.forEach((input) => {
      const control = input.parentElement;
      const minusBtn = control.querySelector(".qty-btn:first-child");
      if (minusBtn) {
        let val = parseInt(input.value) || 0;
        for (let i = 0; i < val; i++) {
          minusBtn.click();
        }
      }
    });

    ["durationInput", "durationInputFurn"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        const control = input.parentElement;
        const minusBtn = control?.querySelector?.(".qty-btn:first-child");
        const plusBtn = control?.querySelector?.(".qty-btn:last-child");
        let val = parseInt(input.value, 10) || 0;
        while (val > DEFAULT_DURATION_MONTHS && minusBtn) {
          minusBtn.click();
          val--;
        }
        while (val < DEFAULT_DURATION_MONTHS && plusBtn) {
          plusBtn.click();
          val++;
        }
      }
    });

    form.reset();
    if (postcode.resetForNewSession) postcode.resetForNewSession({ keepPostcode });
    if (store.modules.address?.resetCollectionFields) {
      store.modules.address.resetCollectionFields();
    }

    // Re-apply resolved place (postcode + lat/lng + distance) after a hard reset
    // so that users who switch tab mid-flow don't have to re-enter everything.
    if (keepPostcode && savedPayloadBeforeReset) {
      if (postcode.restoreSavedPlace) postcode.restoreSavedPlace();
    }

    const defaultMode = document.querySelector(
      'input[name="delivery_mode"][value="collection"]',
    );
    if (defaultMode) {
      defaultMode.checked = true;
      defaultMode.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const unitRadios = document.querySelectorAll(
      '#unitsListContainer input[type="radio"]',
    );
    if (unitRadios.length > 0) {
      unitRadios[0].checked = true;
      unitRadios[0].dispatchEvent(new Event("change", { bubbles: true }));
    }

    toggleButtons.forEach((btn) => btn.classList.remove("is-active"));
    const firstToggle = document.querySelector(
      '.storage-toggle-btn[data-value="boxes"]',
    );
    if (firstToggle) firstToggle.classList.add("is-active");
    hiddenInput.value = "boxes";
    store.currentTab = "boxes";

    if (store.modules.date && store.modules.date.reset)
      store.modules.date.reset();

    step2Container.style.display = "none";
    step3Container.style.display = "none";
    step4Container.style.display = "none";

    calcSidebar.style.display = "block";
    panelTopBar.style.display = "grid";
    calcStepsHeader.style.display = "flex";
    calcLayoutArea.classList.remove("is-success-mode");

    fakeStripeCheckoutInFlight = false;
    continueBtn.removeAttribute("aria-busy");
    continueBtn.removeAttribute("title");
    mobileContinueBtn.removeAttribute("aria-busy");
    if (continueBtnText) continueBtnText.style.display = "block";
    if (continueBtnSpinner) continueBtnSpinner.style.display = "none";
    if (continueBtnText) continueBtnText.textContent = "Continue";

    step1Container.style.display = "block";
    step1Container.style.opacity = "1";

    document.querySelectorAll(".step").forEach((el, idx) => {
      el.classList.toggle("is-active", idx === 0);
    });

    store.currentStep = 1;
    store.notify();
    updateBackButtonsVisibility();
  }

  btnExitDiscard.addEventListener("click", () => {
    triggerFullReset();
    closeCalculatorCompletely();
  });
}
