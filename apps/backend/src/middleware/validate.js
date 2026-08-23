/**
 * validate.js — Zod-based input validation middleware for Q ME NOW backend
 *
 * Usage:
 *   const { validate, schemas } = require('../middleware/validate');
 *   router.post('/path', validate(schemas.createBranch), handler);
 *
 * The middleware validates req.body against the provided Zod schema.
 * On failure it returns HTTP 400 with the first validation error message.
 * On success it replaces req.body with the parsed (sanitized) data.
 */
const { z } = require('zod');
const idSchema = z.string().min(1).max(64);

// ── Validation middleware factory ─────────────────────────────
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues?.[0]?.message || 'Invalid request data.';
      return res.status(400).json({ error: message });
    }
    // Replace body with sanitized/parsed data
    req.body = result.data;
    next();
  };
}

// ── Shared schemas ────────────────────────────────────────────
const schemas = {
  // Auth
  // No national_id or trn: identification numbers are kept in the device
  // keychain by the app and never sent here. See routes/auth.js PATCH /profile.
  syncUser: z.object({
    full_name:     z.string().min(1).max(255).optional(),
    phone:         z.string().max(50).optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be YYYY-MM-DD').optional(),
  }),

  // Staff invite
  staffInvite: z.object({
    email:       z.string().email('A valid email is required'),
    full_name:   z.string().min(1).max(255),
    role:        z.enum(['line_staff', 'manager', 'executive']),
    business_id: idSchema,
    branch_id:   idSchema.optional(),
  }),

  // Businesses
  createBusiness: z.object({
    name:                 z.string().min(1).max(255),
    slug:                 z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
    description:          z.string().max(1000).optional(),
    logo_url:             z.string().url().optional(),
    website_url:          z.string().url().optional(),
    phone:                z.string().max(50).optional(),
    email:                z.string().email().optional(),
    subscription_tier_id: idSchema,
  }),

  // Branches
  createBranch: z.object({
    business_id: idSchema,
    name:        z.string().min(1).max(255),
    address:     z.string().max(500).optional(),
    phone:       z.string().max(50).optional(),
    email:       z.string().email().optional(),
    photo_url:   z.string().url().optional(),
    is_active:   z.boolean().optional(),
  }),

  // Services
  createService: z.object({
    business_id:           idSchema,
    name:                  z.string().min(1).max(255),
    description:           z.string().max(1000).optional(),
    ticket_prefix:         z.string().max(10).optional(),
    base_avg_time_minutes: z.number().int().min(1).max(480).optional(),
    is_active:             z.boolean().optional(),
  }),

  // Queues
  createQueue: z.object({
    branch_id:    idSchema,
    service_id:   idSchema,
    queue_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    max_capacity: z.number().int().min(1).max(1000).optional(),
  }),

  // Tickets
  joinQueue: z.object({
    queue_id:  idSchema,
    form_data: z.record(z.unknown()).optional(),
  }),

  updateTicketStatus: z.object({
    new_status: z.enum(['in_service', 'served', 'left', 'cancelled']),
    notes:      z.string().max(1000).optional(),
  }),

  // Staff
  createStaff: z.object({
    business_id:         idSchema,
    branch_id:           idSchema.optional(),
    role_id:             idSchema,
    full_name:           z.string().min(1).max(255),
    email:               z.string().email(),
    phone:               z.string().max(50).optional(),
    staff_code:          z.string().min(1).max(50),
    assigned_service_id: idSchema.optional(),
  }),

  // Notifications
  sendNotification: z.object({
    user_id:  idSchema,
    title:    z.string().min(1).max(255),
    body:     z.string().min(1).max(1000),
    type:     z.enum(['queue_update', 'position_update', 'called', 'general']).optional(),
    data:     z.record(z.unknown()).optional(),
  }),

  // Predictions
  savePrediction: z.object({
    business_id:   idSchema,
    branch_id:     idSchema.optional(),
    insight_type:  z.string().min(1).max(100),
    insight_data:  z.record(z.unknown()),
    model_version: z.string().max(50).optional(),
  }),
};

module.exports = { validate, schemas };
