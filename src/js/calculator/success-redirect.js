export const PAYMENT_SUCCESS_SESSION_KEY = "smartroom_payment_success";

function baseUrlPrefix() {
  const raw = import.meta.env.BASE_URL || "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function getPaymentSuccessPageUrl() {
  const base = baseUrlPrefix();
  return new URL("payment-success.html", window.location.origin + base).href;
}

export function getCalculatorPageUrl() {
  const base = baseUrlPrefix();
  return new URL("index.html", window.location.origin + base).href;
}
