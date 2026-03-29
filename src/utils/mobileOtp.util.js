/** Shared Indian mobile normalization / validation (no OTP). */

/** @param {string} raw */
export function normalizeIndianMobile(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return '';
}

export function isValidIndianMobile10(digits) {
  return /^[6-9]\d{9}$/.test(digits);
}
