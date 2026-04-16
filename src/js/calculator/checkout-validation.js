export const CHECKOUT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export const CHECKOUT_MSG = {
  name: "Please enter your full name (at least 2 letters).",
  phone: "Enter a valid UK phone number (10–13 digits).",
  email: "Enter a valid email address.",
  terms: "Please accept the terms to continue.",
};

export function checkoutPhoneOk(value) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Pure validation for checkout fields (DOM-safe).
 * @param {{
 *   contactName: HTMLInputElement | null | undefined;
 *   contactPhone: HTMLInputElement | null | undefined;
 *   contactEmail: HTMLInputElement | null | undefined;
 *   termsCheckbox: HTMLInputElement | null | undefined;
 * }} fields
 * @returns {{
 *   ok: boolean;
 *   firstInvalid: "name" | "phone" | "email" | "terms" | null;
 *   nameOk: boolean;
 *   phoneOk: boolean;
 *   emailOk: boolean;
 *   termsOk: boolean;
 * }}
 */
export function evaluateCheckoutFields(fields) {
  const name = (fields.contactName?.value ?? "").trim();
  const phone = fields.contactPhone?.value ?? "";
  const email = (fields.contactEmail?.value ?? "").trim();
  const termsOk = Boolean(fields.termsCheckbox?.checked);

  const nameOk = name.length >= 2 && /[a-zA-Zа-яА-ЯёЁ]/.test(name);
  const phoneOk = checkoutPhoneOk(phone);
  const emailOk = CHECKOUT_EMAIL_RE.test(email);

  let firstInvalid = null;
  if (!nameOk) firstInvalid = "name";
  else if (!phoneOk) firstInvalid = "phone";
  else if (!emailOk) firstInvalid = "email";
  else if (!termsOk) firstInvalid = "terms";

  const ok = nameOk && phoneOk && emailOk && termsOk;
  return { ok, firstInvalid, nameOk, phoneOk, emailOk, termsOk };
}
