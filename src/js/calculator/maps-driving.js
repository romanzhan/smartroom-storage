/**
 * Driving distance via Maps JavaScript API (DistanceMatrixService).
 * Works in the browser (unlike Distance Matrix REST, which is blocked by CORS).
 * No map div required.
 */

let mapsScriptPromise = null;
let mapsScriptKey = "";

/**
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
export function loadMapsJavaScriptApi(apiKey) {
  const key = (apiKey || "").trim();
  if (!key) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }

  if (typeof window !== "undefined" && window.google?.maps?.DistanceMatrixService) {
    return Promise.resolve();
  }

  if (mapsScriptPromise && mapsScriptKey === key) {
    return mapsScriptPromise;
  }

  mapsScriptKey = key;
  mapsScriptPromise = new Promise((resolve, reject) => {
    const cbName = `__smartroomGmInit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    window[cbName] = () => {
      try {
        delete window[cbName];
        if (window.google?.maps?.DistanceMatrixService) {
          resolve();
        } else {
          mapsScriptPromise = null;
          reject(new Error("Google Maps loaded without DistanceMatrixService"));
        }
      } catch (e) {
        mapsScriptPromise = null;
        reject(e);
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cbName}`;
    script.onerror = () => {
      delete window[cbName];
      mapsScriptPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

/**
 * Driving route distance in miles (Distance Matrix via JS API).
 * @returns {Promise<number|null>}
 */
export function getDrivingDistanceMilesJs(
  originLat,
  originLng,
  destLat,
  destLng,
) {
  if (
    typeof originLat !== "number" ||
    typeof originLng !== "number" ||
    typeof destLat !== "number" ||
    typeof destLng !== "number" ||
    Number.isNaN(originLat) ||
    Number.isNaN(originLng) ||
    Number.isNaN(destLat) ||
    Number.isNaN(destLng)
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: originLat, lng: originLng }],
          destinations: [{ lat: destLat, lng: destLng }],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        },
        (response, status) => {
          if (status !== "OK") {
            resolve(null);
            return;
          }
          const row = response?.rows?.[0];
          const element = row?.elements?.[0];
          if (!element || element.status !== "OK") {
            resolve(null);
            return;
          }
          const meters = element.distance?.value;
          if (typeof meters !== "number") {
            resolve(null);
            return;
          }
          resolve(meters / 1609.344);
        },
      );
    } catch {
      resolve(null);
    }
  });
}
