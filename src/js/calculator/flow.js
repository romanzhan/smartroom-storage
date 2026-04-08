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
    triggerFullReset();
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

  function handleNextStep() {
    if (store.currentStep === 1) {
      const snap = store.getSnapshot();
      if (!snap.hasInsurance) {
        const hintId = snap.currentTab === "boxes" ? "insuranceBoxesHint" : "insuranceFurnitureHint";
        const hint = document.getElementById(hintId);
        if (hint) hint.style.display = "block";
        return;
      }
      store.currentStep = 2;
      store.notify();
      transitionSteps("step1Container", "step2Container", 2);
    } else if (store.currentStep === 2) {
      store.currentStep = 3;
      store.notify();
      if (store.modules.date) store.modules.date.reRenderCalendar();
      transitionSteps("step2Container", "step3Container", 3);
    } else if (store.currentStep === 3) {
      const dateData = store.modules.date?.getData?.();
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
    continueBtn.setAttribute(
      "title",
      "Simulated Stripe checkout for testing — no charge",
    );
    mobileContinueBtn.setAttribute("aria-busy", "true");
    if (continueBtnText) continueBtnText.style.display = "none";
    if (continueBtnSpinner) continueBtnSpinner.style.display = "block";
    continueBtn.disabled = true;
    mobileContinueBtn.textContent = "Processing with Stripe (demo)…";
    mobileContinueBtn.disabled = true;

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
    window.location.assign(getPaymentSuccessPageUrl());
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

  function triggerFullReset() {
    localStorage.removeItem(LS_CALC_KEY);
    clearAllCheckoutFieldErrors();

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
    if (postcode.resetForNewSession) postcode.resetForNewSession();
    if (store.modules.address?.resetCollectionFields) {
      store.modules.address.resetCollectionFields();
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
