import { initPostcode } from "./postcode.js";
import { initItems } from "./items.js";
import { initUnits } from "./units.js";
import { initDuration } from "./duration.js";
import { initAddress } from "./address.js";
import { initDate } from "./date.js";
import { animateExpand, animateCollapse } from "./animations.js";
import { store } from "./state.js";
import { initSidebar } from "./sidebar.js";

export function initCalculator() {
  gsap.registerPlugin(ScrollToPlugin);

  const toggleButtons = document.querySelectorAll(".storage-toggle-btn");
  const hiddenInput = document.getElementById("storageType");
  const form = document.getElementById("storageForm");
  const errorText = form.querySelector(".storage-form__error-text");
  const panel = document.getElementById("formPanel");
  const messages = document.querySelector(".storage-form__messages");

  const initialView = document.getElementById("initialView");
  const expandedView = document.getElementById("expandedView");
  const sharedToggle = document.getElementById("sharedToggle");
  const toggleExpandedSlot = document.getElementById("toggleExpandedSlot");
  const backBtn = document.querySelector(".calc-back-btn");

  const currentPostcodeInput = document.getElementById("postcode");
  const mainAutocomplete = document.querySelector(".main-autocomplete");
  const postcodePill = document.getElementById("postcodePill");
  const postcodeSearchMode = document.getElementById("postcodeSearchMode");
  const postcodeText = document.querySelector(".calc-postcode-text");
  const editInput = document.querySelector(".calc-edit-input");
  const editAutocomplete = document.querySelector(".edit-autocomplete");

  const calcBoxesView = document.getElementById("calcBoxesView");
  const calcFurnitureView = document.getElementById("calcFurnitureView");

  // Кнопки навигации и элементы сайдбара
  const desktopStepBackBtn = document.getElementById("desktopStepBackBtn");
  const mobileStepBackBtn = document.getElementById("mobileStepBackBtn");
  const continueBtn = document.getElementById("continueBtn");
  const mobileContinueBtn = document.getElementById("mobileContinueBtn");
  const continueBtnText = continueBtn.querySelector(".btn-text-content");
  const continueBtnSpinner = continueBtn.querySelector(".btn-spinner");

  // Элементы 4-го шага (Checkout)
  const contactName = document.getElementById("contactName");
  const contactPhone = document.getElementById("contactPhone");
  const contactEmail = document.getElementById("contactEmail");
  const termsCheckbox = document.getElementById("termsCheckbox");
  const sidebarTermsBox = document.getElementById("sidebarTermsBox");
  const checkoutSummaryBox = document.getElementById("checkoutSummaryBox");

  const dateModal = document.getElementById("confirmDateModal");
  const exitModal = document.getElementById("exitWarningModal");
  const switchModal = document.getElementById("switchTypeModal");

  let pendingSwitchValue = null;
  let pendingSwitchButton = null;

  const postcode = initPostcode({
    form,
    errorText,
    currentPostcodeInput,
    mainAutocomplete,
    postcodePill,
    postcodeSearchMode,
    postcodeText,
    editInput,
    editAutocomplete,
  });

  store.modules.items = initItems({
    container: document.getElementById("boxesItemsList"),
    onChange: () => store.notify(),
  });

  store.modules.units = initUnits({
    container: document.getElementById("unitsListContainer"),
    onChange: () => store.notify(),
  });

  store.modules.durationBoxes = initDuration({
    minusBtn: document.getElementById("durationMinus"),
    plusBtn: document.getElementById("durationPlus"),
    input: document.getElementById("durationInput"),
    toggleBtn: document.getElementById("rollingPlanToggle"),
    promoText: document.getElementById("durationPromo"),
    rollingText: document.getElementById("rollingText"),
    qtyWrap: document.querySelector("#calcBoxesView .duration-qty"),
  });

  store.modules.durationFurn = initDuration({
    minusBtn: document.getElementById("durationMinusFurn"),
    plusBtn: document.getElementById("durationPlusFurn"),
    input: document.getElementById("durationInputFurn"),
    toggleBtn: document.getElementById("rollingPlanToggleFurn"),
    promoText: document.getElementById("durationPromoFurn"),
    rollingText: document.getElementById("rollingTextFurn"),
    qtyWrap: document.getElementById("qtyWrapFurn"),
  });

  store.modules.address = initAddress({
    onChange: () => {
      store.notify();
      if (store.modules.date) store.modules.date.reRenderCalendar();
    },
  });

  store.modules.date = initDate({
    store,
    onChange: () => store.notify(),
  });

  initSidebar({
    store,
    summaryItems: document.getElementById("summaryItems"),
    summarySubtotal: document.getElementById("summarySubtotal"),
    summaryTotal: document.getElementById("summaryTotal"),
    continueBtn: document.getElementById("continueBtn"),
    mobileSummaryTotal: document.getElementById("mobileSummaryTotal"),
    mobileContinueBtn: document.getElementById("mobileContinueBtn"),
    summaryCard: document.getElementById("summaryCard"),
    summaryMobileToggle: document.getElementById("summaryMobileToggle"),
  });

  function switchCalculator(targetValue) {
    const viewToHide =
      targetValue === "boxes" ? calcFurnitureView : calcBoxesView;
    const viewToShow =
      targetValue === "boxes" ? calcBoxesView : calcFurnitureView;

    store.currentTab = targetValue;
    store.notify();

    if (panel.classList.contains("is-expanded")) {
      gsap.to(viewToHide, {
        opacity: 0,
        duration: 0.2,
        onComplete: () => {
          viewToHide.style.display = "none";
          viewToShow.style.display = "block";
          gsap.to(viewToShow, {
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
        gsap.to(switchModal, { opacity: 1, duration: 0.2 });
        gsap.fromTo(
          switchModal.querySelector(".calc-modal"),
          { y: 20 },
          { y: 0, duration: 0.3, ease: "power2.out" },
        );
      } else {
        executeSwitch(this, targetValue);
      }
    });
  });

  document.getElementById("btnCancelSwitch").addEventListener("click", () => {
    gsap.to(switchModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        switchModal.style.display = "none";
      },
    });
    pendingSwitchValue = null;
    pendingSwitchButton = null;
  });

  document.getElementById("btnConfirmSwitch").addEventListener("click", () => {
    gsap.to(switchModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        switchModal.style.display = "none";
      },
    });
    triggerFullReset();
    if (pendingSwitchButton && pendingSwitchValue) {
      executeSwitch(pendingSwitchButton, pendingSwitchValue);
    }
  });

  form.addEventListener("submit", async (e) => {
    // --- ДОБАВИТЬ ЭТОТ БЛОК ---
    // Блокируем логику проверки индекса на шагах 2, 3 и 4
    if (store.currentStep > 1) {
      // Если мы на шаге 4 и кнопка активна, сабмитим форму
      if (store.currentStep === 4 && !continueBtn.disabled) {
        handleNextStep();
      }
      return;
    }
    // -------------------------
    const value = currentPostcodeInput ? currentPostcodeInput.value.trim() : "";
    if (!value || !(await postcode.validate(value))) {
      gsap.to(form.querySelector(".storage-form__helper"), {
        opacity: 0,
        duration: 0.2,
      });
      gsap.to(errorText, { opacity: 1, duration: 0.2 });
      errorText.textContent = !value
        ? "Please enter your Postcode to continue"
        : "We currently do not serve this area.";
      form.classList.add("is-invalid");
      if (currentPostcodeInput) currentPostcodeInput.focus();
      return;
    }
    postcode.setSaved(value.toUpperCase());
    postcodeText.textContent = postcode.getSaved();
    form.classList.remove("is-invalid");

    const submitBtn = form.querySelector(".storage-form__submit");
    if (submitBtn) submitBtn.classList.add("is-loading");
    if (currentPostcodeInput) currentPostcodeInput.disabled = true;

    setTimeout(() => {
      if (submitBtn) submitBtn.classList.remove("is-loading");
      messages.style.display = "none";
      animateExpand({
        panel,
        initialView,
        expandedView,
        sharedToggle,
        toggleExpandedSlot,
        messages,
      });
    }, 800);
  });

  function updateBackButtonsVisibility() {
    const displayStyle =
      store.currentStep > 1 && store.currentStep < 5 ? "flex" : "none";
    desktopStepBackBtn.style.display = displayStyle;
    mobileStepBackBtn.style.display = displayStyle;

    if (store.currentStep === 4) {
      sidebarTermsBox.style.display = "block";
      continueBtnText.textContent = "Book Now";
      mobileContinueBtn.textContent = "Book Now";
      validateCheckoutForm();
    } else {
      sidebarTermsBox.style.display = "none";
      continueBtnText.textContent = "Continue";
      mobileContinueBtn.textContent = "Continue";
      continueBtn.disabled = !store.getSnapshot().hasItems;
      mobileContinueBtn.disabled = !store.getSnapshot().hasItems;
    }
  }

  function validateCheckoutForm() {
    if (store.currentStep !== 4) return;
    const isName = contactName.value.trim().length > 1;
    const isPhone = contactPhone.value.trim().length > 5;
    const isEmail =
      contactEmail.value.includes("@") && contactEmail.value.includes(".");
    const isTerms = termsCheckbox.checked;

    const isValid = isName && isPhone && isEmail && isTerms;
    continueBtn.disabled = !isValid;
    mobileContinueBtn.disabled = !isValid;
  }

  [contactName, contactPhone, contactEmail, termsCheckbox].forEach((el) => {
    el.addEventListener("input", validateCheckoutForm);
    el.addEventListener("change", validateCheckoutForm);
  });

  function populateCheckoutSummary() {
    const snap = store.getSnapshot();
    // ИСПРАВЛЕНИЕ 1: Читаем данные напрямую из store.modules, а не из snapshot'а
    const addr = store.modules.address?.getData();
    const date = store.modules.date?.getData();

    let html = "";
    if (addr?.mode === "collection") {
      html += `<p><strong>Service:</strong> Home Collection</p>`;
      // ИСПРАВЛЕНИЕ 2: Меняем addr.addressText на addr.address (согласно стейту в address.js)
      html += `<p><strong>Address:</strong> ${addr.address || "Not provided"}, Postcode: ${postcode.getSaved()}</p>`;
      if (date) {
        const dateStr = date.date.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        html += `<p><strong>Date & Time:</strong> ${dateStr} between ${date.timeWindow}</p>`;
      }
    } else {
      const facName =
        addr?.facility === "bloomsbury"
          ? "Bloomsbury (WC1N 3QA)"
          : "Hackney (N16 8DR)";
      html += `<p><strong>Service:</strong> Drop-off</p>`;
      html += `<p><strong>Location:</strong> ${facName}</p>`;
      if (date) {
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
    gsap.to(`#${hideId}`, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        document.getElementById(hideId).style.display = "none";
        const elToShow = document.getElementById(showId);
        elToShow.style.display = "block";
        gsap.to(elToShow, { opacity: 1, duration: 0.3 });

        document.querySelectorAll(".step").forEach((el, idx) => {
          el.classList.toggle("is-active", idx === newStepNumber - 1);
        });

        const headerHeight =
          document.querySelector(".site-header")?.offsetHeight || 80;
        gsap.to(window, {
          scrollTo: { y: toggleExpandedSlot, offsetY: headerHeight },
          duration: 0.5,
        });
      },
    });
  }

  function handleNextStep() {
    if (store.currentStep === 1) {
      store.currentStep = 2;
      store.notify();
      transitionSteps("step1Container", "step2Container", 2);
    } else if (store.currentStep === 2) {
      store.currentStep = 3;
      store.notify();
      if (store.modules.date) store.modules.date.reRenderCalendar();
      transitionSteps("step2Container", "step3Container", 3);
    } else if (store.currentStep === 3) {
      const dateData = store.modules.date.getData();
      if (!dateData.hasInteracted) {
        dateModal.style.display = "flex";
        gsap.to(dateModal, { opacity: 1, duration: 0.2 });
        gsap.fromTo(
          dateModal.querySelector(".calc-modal"),
          { y: 20 },
          { y: 0, duration: 0.3, ease: "power2.out" },
        );
      } else {
        moveToStep4();
      }
    } else if (store.currentStep === 4) {
      processFakePayment();
      return;
    }
    updateBackButtonsVisibility();
  }

  function handlePrevStep() {
    if (store.currentStep === 4) {
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

  // --- ИСПРАВЛЕНИЕ ТУТ: ДОБАВЛЕНО e.stopPropagation() ДЛЯ МОБИЛЬНЫХ КНОПОК ---
  desktopStepBackBtn.addEventListener("click", handlePrevStep);
  mobileStepBackBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Блокируем всплытие клика к родительскому summaryMobileToggle
    handlePrevStep();
  });

  continueBtn.addEventListener("click", handleNextStep);
  mobileContinueBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Блокируем всплытие клика к родительскому summaryMobileToggle
    handleNextStep();
  });
  // -----------------------------------------------------------------------------

  document.getElementById("modalBtnChange").addEventListener("click", () => {
    gsap.to(dateModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        dateModal.style.display = "none";
      },
    });
    const btnOpenCal = document.getElementById("btnOpenCalendar");
    if (btnOpenCal) btnOpenCal.click();
  });

  document.getElementById("modalBtnConfirm").addEventListener("click", () => {
    gsap.to(dateModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        dateModal.style.display = "none";
      },
    });
    moveToStep4();
  });

  function moveToStep4() {
    store.currentStep = 4;
    populateCheckoutSummary();
    store.notify();
    transitionSteps("step3Container", "step4Container", 4);
    updateBackButtonsVisibility();
  }

  function processFakePayment() {
    continueBtnText.style.display = "none";
    continueBtnSpinner.style.display = "block";
    continueBtn.disabled = true;
    mobileContinueBtn.textContent = "Processing...";
    mobileContinueBtn.disabled = true;

    setTimeout(() => {
      store.currentStep = 5;
      showSuccessScreen();
    }, 2000);
  }

  function showSuccessScreen() {
    const snap = store.getSnapshot();
    const isFurniture = snap.currentTab === "furniture";
    const isCollection = snap.modules.address?.getData()?.mode === "collection";

    gsap.to("#step4Container", {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        document.getElementById("step4Container").style.display = "none";

        document.getElementById("calcSidebar").style.display = "none";
        document.getElementById("panelTopBar").style.display = "none";
        document.getElementById("calcStepsHeader").style.display = "none";

        document
          .getElementById("calcLayoutArea")
          .classList.add("is-success-mode");

        if (isFurniture && isCollection) {
          document.getElementById("inventoryBlock").style.display = "block";
        }

        const successEl = document.getElementById("successContainer");
        successEl.style.display = "block";
        gsap.to(successEl, {
          opacity: 1,
          duration: 0.4,
          y: -10,
          ease: "power2.out",
        });
      },
    });

    localStorage.removeItem("smartroom_saved_calc");
  }

  const btnSubmitInventory = document.getElementById("btnSubmitInventory");
  if (btnSubmitInventory) {
    btnSubmitInventory.addEventListener("click", () => {
      const listVal = document.getElementById("inventoryList").value.trim();
      if (listVal) {
        btnSubmitInventory.style.display = "none";
        document.getElementById("inventoryList").disabled = true;
        document.getElementById("inventorySuccessMsg").style.display = "block";
      }
    });
  }

  backBtn.addEventListener("click", () => {
    exitModal.style.display = "flex";
    gsap.to(exitModal, { opacity: 1, duration: 0.2 });
    gsap.fromTo(
      exitModal.querySelector(".calc-modal"),
      { y: 20 },
      { y: 0, duration: 0.3, ease: "power2.out" },
    );
  });

  function closeCalculatorCompletely() {
    gsap.to(exitModal, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        exitModal.style.display = "none";
      },
    });
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

  document.getElementById("btnExitSave").addEventListener("click", () => {
    const snapshot = store.getSnapshot();
    localStorage.setItem("smartroom_saved_calc", JSON.stringify(snapshot));
    closeCalculatorCompletely();
  });

  function triggerFullReset() {
    localStorage.removeItem("smartroom_saved_calc");

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
        const minusBtn = control.querySelector(".qty-btn:first-child");
        const plusBtn = control.querySelector(".qty-btn:last-child");
        let val = parseInt(input.value) || 0;
        while (val > 6) {
          minusBtn.click();
          val--;
        }
        while (val < 6) {
          plusBtn.click();
          val++;
        }
      }
    });

    form.reset();

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

    document.getElementById("step2Container").style.display = "none";
    document.getElementById("step3Container").style.display = "none";
    document.getElementById("step4Container").style.display = "none";
    document.getElementById("successContainer").style.display = "none";

    document.getElementById("calcSidebar").style.display = "block";
    document.getElementById("panelTopBar").style.display = "flex";
    document.getElementById("calcStepsHeader").style.display = "flex";
    document
      .getElementById("calcLayoutArea")
      .classList.remove("is-success-mode");

    continueBtnText.style.display = "block";
    continueBtnSpinner.style.display = "none";

    const step1 = document.getElementById("step1Container");
    step1.style.display = "block";
    step1.style.opacity = "1";

    document.querySelectorAll(".step").forEach((el, idx) => {
      el.classList.toggle("is-active", idx === 0);
    });

    store.currentStep = 1;
    store.notify();
    updateBackButtonsVisibility();
  }

  document.getElementById("btnExitDiscard").addEventListener("click", () => {
    triggerFullReset();
    closeCalculatorCompletely();
  });
}
