import {
  PAYMENT_SUCCESS_SESSION_KEY,
  getCalculatorPageUrl,
} from "./calculator/success-redirect.js";

function resetInventoryChecklist(inventoryBlock) {
  if (!inventoryBlock) return;
  inventoryBlock.querySelectorAll(".inventory-qty").forEach((inp) => {
    inp.value = "0";
    inp.disabled = false;
  });
  const notes = document.getElementById("inventoryOtherNotes");
  if (notes) {
    notes.value = "";
    notes.disabled = false;
  }
  const errEl = document.getElementById("inventoryChecklistError");
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
  }
  const btn = document.getElementById("btnSubmitInventory");
  if (btn) btn.style.display = "";
  const successMsg = document.getElementById("inventorySuccessMsg");
  if (successMsg) successMsg.style.display = "none";
}

function collectPickupInventorySummary(inventoryBlock) {
  if (!inventoryBlock) return "";
  const parts = [];
  inventoryBlock.querySelectorAll(".inventory-checklist tbody tr").forEach(
    (tr) => {
      const label = tr.querySelector("td:first-child")?.textContent?.trim();
      const input = tr.querySelector(".inventory-qty");
      const n = parseInt(input?.value, 10) || 0;
      if (n > 0 && label) parts.push(`${n}× ${label}`);
    },
  );
  const other = document
    .getElementById("inventoryOtherNotes")
    ?.value?.trim();
  if (other) parts.push(`Notes: ${other}`);
  return parts.join("; ");
}

export function initPaymentSuccessPage() {
  const homeLink = document.getElementById("paymentSuccessHomeLink");
  if (homeLink) homeLink.href = getCalculatorPageUrl();

  let ctx = null;
  try {
    const raw = sessionStorage.getItem(PAYMENT_SUCCESS_SESSION_KEY);
    if (raw) ctx = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  const inventoryBlock = document.getElementById("inventoryBlock");
  const showChecklist =
    ctx?.isFurniture === true && ctx?.isCollection === true;

  if (inventoryBlock) {
    if (showChecklist) {
      inventoryBlock.style.display = "block";
      resetInventoryChecklist(inventoryBlock);
    } else {
      inventoryBlock.style.display = "none";
    }
  }

  const btnSubmit = document.getElementById("btnSubmitInventory");
  const inventorySuccessMsg = document.getElementById("inventorySuccessMsg");
  if (btnSubmit && inventoryBlock && inventorySuccessMsg) {
    btnSubmit.addEventListener("click", () => {
      const summary = collectPickupInventorySummary(inventoryBlock);
      const errEl = document.getElementById("inventoryChecklistError");
      if (!summary) {
        if (errEl) {
          errEl.textContent =
            "Add at least one quantity or describe items under Other.";
          errEl.hidden = false;
        }
        return;
      }
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
      btnSubmit.style.display = "none";
      inventoryBlock.querySelectorAll(".inventory-qty").forEach((inp) => {
        inp.disabled = true;
      });
      const notes = document.getElementById("inventoryOtherNotes");
      if (notes) notes.disabled = true;
      inventorySuccessMsg.style.display = "block";
      try {
        localStorage.setItem(
          "smartroom_pickup_inventory",
          JSON.stringify({ savedAt: Date.now(), summary }),
        );
      } catch {
        /* ignore quota */
      }
    });
  }
}
