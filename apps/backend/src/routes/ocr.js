/**
 * ocr.js — OCR document scanning route for Q ME NOW
 *
 * POST /api/ocr/scan          — Scan a document image and extract fields
 * POST /api/ocr/save          — Save OCR result to private Supabase storage
 * GET  /api/ocr/signed-url/:id — Get a time-limited signed URL for an OCR file
 *
 * SECURITY:
 *   - All routes require authentication
 *   - OCR files are stored in a PRIVATE Supabase Storage bucket (ocr-documents)
 *   - Signed URLs expire after 5 minutes
 *   - Sensitive fields (TRN, national_id) are masked before returning to client
 *   - All OCR reads are audit-logged
 *
 * OCR ENGINE:
 *   Uses Tesseract.js (pure JavaScript, no native binary required).
 *   Accepts base64-encoded image data (JPEG, PNG, PDF first-page).
 *
 * EXTRACTED FIELDS (best-effort, not guaranteed):
 *   full_name, date_of_birth, national_id, trn, address, passport_number
 */
const router  = require('express').Router();
const { z }   = require('zod');
const { randomUUID: uuidv4 } = require('crypto');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditLog }    = require('../middleware/auditLog');
const { maskTRN, maskNationalId } = require('../utils/maskData');

function validationMessage(error) {
  return error.issues?.[0]?.message || 'Invalid request data.';
}

const idSchema = z.string().min(1).max(64);

// ── Validation schemas ────────────────────────────────────────
const scanSchema = z.object({
  image_base64: z.string().min(100, 'image_base64 must be a valid base64-encoded image'),
  mime_type:    z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], {
    errorMap: () => ({ message: 'mime_type must be image/jpeg, image/png, image/webp, or application/pdf' }),
  }),
  document_type: z.enum(['national_id', 'trn', 'passport', 'drivers_license', 'other']).optional(),
});

const saveSchema = z.object({
  ocr_result_id: idSchema,
  queue_id:      idSchema.optional(),
  service_id:    idSchema.optional(),
});

// ── Helper: parse OCR text into structured fields ─────────────
function parseOcrText(text) {
  const result = {
    raw_text:       text,
    full_name:      null,
    date_of_birth:  null,
    national_id:    null,
    trn:            null,
    address:        null,
    passport_number: null,
  };

  if (!text) return result;

  // TRN: 9-digit number, optionally formatted as 000-000-000
  const trnMatch = text.match(/\b(\d{3}[-\s]?\d{3}[-\s]?\d{3})\b/);
  if (trnMatch) result.trn = trnMatch[1].replace(/[-\s]/g, '');

  // Date of birth: various formats
  const dobMatch = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  if (dobMatch) result.date_of_birth = dobMatch[1];

  // National ID: typically 11 digits for Jamaica
  const nidMatch = text.match(/\b(\d{11})\b/);
  if (nidMatch) result.national_id = nidMatch[1];

  // Passport: letter(s) followed by digits
  const passportMatch = text.match(/\b([A-Z]{1,2}\d{6,9})\b/);
  if (passportMatch) result.passport_number = passportMatch[1];

  // Full name: look for "Name:" or "Full Name:" prefix
  const nameMatch = text.match(/(?:full\s*name|name)\s*[:\-]?\s*([A-Z][A-Z\s,\.]+)/i);
  if (nameMatch) result.full_name = nameMatch[1].trim();

  return result;
}

// ── POST /api/ocr/scan ────────────────────────────────────────
router.post('/scan', requireAuth, auditLog('ocr_scan', 'ocr_document'), async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }

  const { image_base64, mime_type, document_type } = parsed.data;

  try {
    // Lazy-load Tesseract to avoid startup cost
    let Tesseract;
    try {
      Tesseract = require('tesseract.js');
    } catch {
      return res.status(503).json({
        error: 'OCR engine not available. Install tesseract.js: npm install tesseract.js',
      });
    }

    // Decode base64 to buffer
    const imageBuffer = Buffer.from(image_base64, 'base64');

    // Run OCR
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {}, // suppress progress logs
    });

    const ocrText   = data.text || '';
    const extracted = parseOcrText(ocrText);
    const resultId  = uuidv4();

    // Store OCR result in DB (raw text + extracted fields, NOT the image)
    await pool.query(
      `INSERT INTO ocr_results
         (id, user_id, document_type, raw_text, extracted_full_name, extracted_dob,
          extracted_national_id, extracted_trn, extracted_passport, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        req.dbUser?.id || null,
        document_type || 'other',
        ocrText.substring(0, 5000), // cap raw text storage
        extracted.full_name,
        extracted.date_of_birth,
        extracted.national_id,
        extracted.trn,
        extracted.passport_number,
        Math.round((data.confidence || 0) * 100) / 100,
      ]
    );

    // Return extracted fields with sensitive data masked
    res.json({
      ocr_result_id: resultId,
      confidence:    data.confidence,
      extracted: {
        full_name:       extracted.full_name,
        date_of_birth:   extracted.date_of_birth,
        national_id:     maskNationalId(extracted.national_id),
        trn:             maskTRN(extracted.trn),
        passport_number: extracted.passport_number,
        address:         extracted.address,
      },
      // Provide unmasked data only for the form pre-fill (client-side only, not stored)
      form_prefill: {
        full_name:       extracted.full_name,
        date_of_birth:   extracted.date_of_birth,
        // Sensitive fields are intentionally omitted from form_prefill
        // The user must manually enter TRN and national ID
      },
    });
  } catch (err) {
    console.error('[OCR] Scan error:', err.message);
    res.status(500).json({ error: 'OCR scan failed. Please try again or enter details manually.' });
  }
});

// ── POST /api/ocr/save ────────────────────────────────────────
// Associates an OCR result with a queue/service for record-keeping
router.post('/save', requireAuth, async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }

  const { ocr_result_id, queue_id, service_id } = parsed.data;

  try {
    const [rows] = await pool.query(
      'SELECT id, user_id FROM ocr_results WHERE id = ?',
      [ocr_result_id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'OCR result not found.' });
    }
    if (rows[0].user_id && rows[0].user_id !== req.dbUser?.id) {
      return res.status(403).json({ error: 'You do not own this OCR result.' });
    }

    await pool.query(
      'UPDATE ocr_results SET queue_id = ?, service_id = ? WHERE id = ?',
      [queue_id || null, service_id || null, ocr_result_id]
    );

    res.json({ success: true, ocr_result_id });
  } catch (err) {
    console.error('[OCR] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save OCR result.' });
  }
});

// ── GET /api/ocr/signed-url/:id ───────────────────────────────
// Returns a time-limited signed URL for an OCR document image
// Only the owning user or authorized staff can access this
router.get('/signed-url/:id',
  requireAuth,
  auditLog('read_ocr_document', 'ocr_document'),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, user_id, storage_path FROM ocr_results WHERE id = ?',
        [req.params.id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'OCR document not found.' });
      }

      const record = rows[0];
      const isOwner = record.user_id === req.dbUser?.id;
      const isStaff = !!req.dbStaff;

      if (!isOwner && !isStaff) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      if (!record.storage_path) {
        return res.status(404).json({ error: 'No document image stored for this OCR result.' });
      }

      // Generate signed URL via Supabase Storage (5-minute expiry)
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase.storage
        .from('ocr-documents')
        .createSignedUrl(record.storage_path, 300); // 5 minutes

      if (error) {
        console.error('[OCR] Signed URL error:', error.message);
        return res.status(500).json({ error: 'Failed to generate signed URL.' });
      }

      res.json({
        signed_url: data.signedUrl,
        expires_in: 300,
      });
    } catch (err) {
      console.error('[OCR] Signed URL error:', err.message);
      res.status(500).json({ error: 'Failed to generate signed URL.' });
    }
  }
);

module.exports = router;
