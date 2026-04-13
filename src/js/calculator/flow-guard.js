/**
 * Minimum DOM required for calculator step/checkout flow. Missing pieces → skip attach (no throw).
 * @param {ReturnType<typeof import("./dom.js").getCalculatorDom>} dom
 * @returns {string[]} human-readable missing keys
 */
export function listMissingFlowDom(dom) {
  if (!dom?.form) return ["form"];

  /** @type {Array<[string, unknown]>} */
  const required = [
    ["panel", dom.panel],
    ["messages", dom.messages],
    ["initialView", dom.initialView],
    ["expandedView", dom.expandedView],
    ["sharedToggle", dom.sharedToggle],
    ["toggleExpandedSlot", dom.toggleExpandedSlot],
    ["hiddenInput", dom.hiddenInput],
    ["errorText", dom.errorText],
    ["postcodeText", dom.postcodeText],
    ["backBtn", dom.backBtn],
    ["exitModal", dom.exitModal],
    ["btnExitSave", dom.btnExitSave],
    ["btnExitDiscard", dom.btnExitDiscard],
    ["switchModal", dom.switchModal],
    ["btnCancelSwitch", dom.btnCancelSwitch],
    ["btnConfirmSwitch", dom.btnConfirmSwitch],
    ["dateModal", dom.dateModal],
    ["modalBtnChange", dom.modalBtnChange],
    ["modalBtnConfirm", dom.modalBtnConfirm],
    ["desktopStepBackBtn", dom.desktopStepBackBtn],
    ["mobileStepBackBtn", dom.mobileStepBackBtn],
    ["continueBtn", dom.continueBtn],
    ["mobileContinueBtn", dom.mobileContinueBtn],
    ["calcBoxesView", dom.calcBoxesView],
    ["calcFurnitureView", dom.calcFurnitureView],
    ["step1Container", dom.step1Container],
    ["step2Container", dom.step2Container],
    ["step3Container", dom.step3Container],
    ["step4Container", dom.step4Container],
    ["calcSidebar", dom.calcSidebar],
    ["panelTopBar", dom.panelTopBar],
    ["calcStepsHeader", dom.calcStepsHeader],
    ["calcLayoutArea", dom.calcLayoutArea],
    ["sidebarTermsBox", dom.sidebarTermsBox],
    ["checkoutSummaryBox", dom.checkoutSummaryBox],
    ["termsCheckbox", dom.termsCheckbox],
    ["contactName", dom.contactName],
    ["contactPhone", dom.contactPhone],
    ["contactEmail", dom.contactEmail],
    ["postcodeSearchMode", dom.postcodeSearchMode],
  ];

  const missing = required.filter(([, el]) => !el).map(([k]) => k);

  const toggles = dom.toggleButtons;
  if (!toggles || toggles.length === 0) {
    missing.push("toggleButtons (at least one .storage-toggle-btn)");
  }

  return missing;
}
