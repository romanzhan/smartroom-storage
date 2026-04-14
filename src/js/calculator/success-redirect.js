export const PAYMENT_SUCCESS_SESSION_KEY = "smartroom_payment_success";

/**
 * Resolve an absolute base URL for static sibling pages (e.g. payment-success.html).
 * Handles common Vite BASE_URL values: "/", "./", "/smartroom-storage/" etc.
 */
function absoluteBaseUrl() {
  const raw = import.meta.env.BASE_URL || "/";
  if (raw === "./" || raw === "") {
    // Relative base — resolve against the current page directory
    const path = window.location.pathname.replace(/[^/]*$/, "");
    return window.location.origin + path;
  }
  const prefix = raw.endsWith("/") ? raw : `${raw}/`;
  return window.location.origin + prefix;
}

export function getPaymentSuccessPageUrl() {
  try {
    return new URL("payment-success.html", absoluteBaseUrl()).href;
  } catch {
    return "/payment-success.html";
  }
}

export function getCalculatorPageUrl() {
  try {
    return new URL("index.html", absoluteBaseUrl()).href;
  } catch {
    return "/";
  }
}
