/**
 * maskData.js — Sensitive data masking utilities for Q ME NOW
 *
 * These functions mask sensitive fields before sending data to the frontend.
 * Full sensitive data is only available to authorized staff during an active
 * service session or approved administrative process.
 *
 * Masking rules:
 *   TRN:        ***-***-123  (last 3 digits visible)
 *   National ID: ****-****-1234 (last 4 digits visible)
 *   Passport:   **1234 (last 4 characters visible)
 *   Phone:      ***-***-1234 (last 4 digits visible)
 *   Email:      j***@example.com (first char + domain visible)
 */

/**
 * Mask a TRN (Tax Registration Number).
 * Example: "123-456-789" → "***-***-789"
 */
function maskTRN(trn) {
  if (!trn) return null;
  const digits = trn.replace(/\D/g, '');
  if (digits.length < 3) return '***';
  const last3 = digits.slice(-3);
  return `***-***-${last3}`;
}

/**
 * Mask a National ID number.
 * Example: "1234567890" → "******7890"
 */
function maskNationalId(id) {
  if (!id) return null;
  const str = String(id);
  if (str.length <= 4) return '****';
  return str.slice(0, -4).replace(/./g, '*') + str.slice(-4);
}

/**
 * Mask a passport number.
 * Example: "AB123456" → "****3456"
 */
function maskPassport(passport) {
  if (!passport) return null;
  const str = String(passport);
  if (str.length <= 4) return '****';
  return str.slice(0, -4).replace(/./g, '*') + str.slice(-4);
}

/**
 * Mask a phone number.
 * Example: "876-555-1234" → "***-***-1234"
 */
function maskPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

/**
 * Mask an email address.
 * Example: "john.doe@example.com" → "j***@example.com"
 */
function maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.charAt(0) + '***';
  return `${masked}@${domain}`;
}

/**
 * Apply masking to a user object for public/staff display.
 * Pass showFull=true only for authorized staff during an active service session.
 *
 * @param {object} user
 * @param {boolean} showFull - If true, returns unmasked data (authorized staff only)
 * @returns {object} user with sensitive fields masked
 */
function maskUser(user, showFull = false) {
  if (!user) return null;
  if (showFull) return user;

  return {
    ...user,
    trn:         maskTRN(user.trn),
    national_id: maskNationalId(user.national_id),
    phone:       maskPhone(user.phone),
    // Email is not masked in normal staff view but is masked in public views
    // date_of_birth is not exposed in masked view
    date_of_birth: undefined,
  };
}

/**
 * Apply masking to a staff object.
 * Hides sensitive personal data unless the requester is a manager/executive
 * viewing their own org's staff.
 *
 * @param {object} staff
 * @param {boolean} showFull
 * @returns {object}
 */
function maskStaff(staff, showFull = false) {
  if (!staff) return null;
  if (showFull) return staff;

  return {
    ...staff,
    phone:         maskPhone(staff.phone),
    date_of_birth: undefined,
    address:       undefined,
  };
}

/**
 * Strip all sensitive PII from a customer object for public queue display.
 * Public queue screens must never expose names, TRNs, IDs, phone numbers,
 * emails, or full ticket history.
 *
 * @param {object} ticket
 * @returns {object} safe ticket for public display
 */
function toPublicTicket(ticket) {
  if (!ticket) return null;
  return {
    id:                     ticket.id,
    ticket_number:          ticket.ticket_number,
    position:               ticket.position,
    status:                 ticket.status,
    estimated_wait_minutes: ticket.estimated_wait_minutes,
    waiting_position:       ticket.waiting_position,
    is_next:                ticket.is_next,
    status_message:         ticket.status_message,
    joined_at:              ticket.joined_at,
    // Deliberately omit: user_id, user_name, user_phone, intake_form_id
    // called_at, started_serving_at, completed_at, served_by_staff_id
  };
}

module.exports = {
  maskTRN,
  maskNationalId,
  maskPassport,
  maskPhone,
  maskEmail,
  maskUser,
  maskStaff,
  toPublicTicket,
};
