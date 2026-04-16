const WINDOW_MS = 60_000;

/** Limits per browser tab (in-memory). Tune via env-style constants only. */
const MAX_AUTOCOMPLETE_PER_MIN = 36;
const MAX_PLACE_DETAILS_PER_MIN = 24;
const MAX_DISTANCE_MATRIX_JS_PER_MIN = 24;

const FAIL_STREAK_TO_COOLDOWN = 5;
const COOLDOWN_MS = 120_000;

function pruneWindow(timestamps) {
  const now = Date.now();
  while (timestamps.length && now - timestamps[0] > WINDOW_MS) {
    timestamps.shift();
  }
}

/**
 * Prevents runaway billing: sliding windows, cooldown after repeated errors,
 * minimum length before autocomplete (reduces single-character storms).
 */
export function createMapsApiGuard(options = {}) {
  const minCharsAutocomplete =
    options.minCharsAutocomplete != null ? options.minCharsAutocomplete : 2;

  const autocompleteTimes = [];
  const detailsTimes = [];
  const distanceMatrixTimes = [];

  let failStreak = 0;
  let cooldownUntil = 0;
  let lastMessage = "";

  function inCooldown() {
    return Date.now() < cooldownUntil;
  }

  function enterCooldown() {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    lastMessage =
      "Location services paused after repeated errors. Please wait about two minutes, then try again.";
  }

  return {
    minCharsAutocomplete,

    getLastMessage() {
      return lastMessage;
    },

    clearMessage() {
      lastMessage = "";
    },

    recordSuccess() {
      failStreak = 0;
    },

    recordFailure(httpStatus) {
      failStreak += 1;
      if (httpStatus === 429) {
        enterCooldown();
        lastMessage =
          "Too many requests to Google. Please wait a couple of minutes before searching again.";
        failStreak = 0;
        return;
      }
      if (failStreak >= FAIL_STREAK_TO_COOLDOWN) {
        enterCooldown();
        failStreak = 0;
      }
    },

    tryAutocomplete() {
      if (inCooldown()) {
        lastMessage =
          "Location services are briefly paused. Please wait before searching again.";
        return false;
      }
      pruneWindow(autocompleteTimes);
      if (autocompleteTimes.length >= MAX_AUTOCOMPLETE_PER_MIN) {
        lastMessage =
          "Too many address searches this minute. Please wait a moment and try again.";
        return false;
      }
      autocompleteTimes.push(Date.now());
      return true;
    },

    tryPlaceDetails() {
      if (inCooldown()) {
        lastMessage =
          "Location services are briefly paused. Please wait before trying again.";
        return false;
      }
      pruneWindow(detailsTimes);
      if (detailsTimes.length >= MAX_PLACE_DETAILS_PER_MIN) {
        lastMessage =
          "Too many place lookups this minute. Please wait briefly and select an address again.";
        return false;
      }
      detailsTimes.push(Date.now());
      return true;
    },

    tryDistanceMatrix() {
      if (inCooldown()) {
        lastMessage =
          "Location services are briefly paused. Please wait before trying again.";
        return false;
      }
      pruneWindow(distanceMatrixTimes);
      if (distanceMatrixTimes.length >= MAX_DISTANCE_MATRIX_JS_PER_MIN) {
        lastMessage =
          "Driving distance lookup limit reached for this minute. Please wait briefly and try again.";
        return false;
      }
      distanceMatrixTimes.push(Date.now());
      return true;
    },
  };
}
