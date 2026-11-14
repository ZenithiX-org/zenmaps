/**
 * Promise wrapper around the Geolocation API with human-friendly errors.
 */

const MESSAGES = {
  1: 'Location permission was denied. You can enable it in your browser settings.',
  2: 'Your location is not available right now. Please try again.',
  3: 'Finding your location took too long. Please try again.',
};

/**
 * @typedef {Object} LocationResult
 * @property {number} lat
 * @property {number} lon
 * @property {number} accuracy metres
 */

/**
 * @param {PositionOptions} [options]
 * @returns {Promise<LocationResult>}
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support location sharing.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(new Error(MESSAGES[error.code] ?? 'Could not determine your location.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
        ...options,
      },
    );
  });
}
