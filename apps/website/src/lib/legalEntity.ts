/**
 * legalEntity.ts — the handful of legal facts only the company can supply.
 *
 * The Privacy Policy and Terms are written and complete except for these. They
 * are gathered here, in one file, for two reasons:
 *
 * 1. Fill them once and BOTH published pages update. The policies themselves
 *    stay in legal/*.md as the single source of truth for the wording; this is
 *    only the identity block that the wording refers to.
 *
 * 2. While any of them is blank, the published pages carry a visible notice
 *    saying so, and the blank is rendered as an obvious marker rather than as
 *    prose. That is deliberate: a policy that quietly reads "operated by
 *    [REGISTERED COMPANY NAME]" is worse than one that says plainly it is not
 *    finished — especially in a procurement review, which is where these
 *    documents will actually be read.
 *
 * The notice disappears on its own once every field below is non-empty. There
 * is nothing else to remember to switch off.
 */

export interface LegalEntity {
  /** The registered business name, exactly as filed. */
  registeredName: string;
  /**
   * Business Name (BN) registration number from the Companies Office of
   * Jamaica. DKS Technologies is a SOLE TRADER, not a limited company, so this
   * is a business-name registration — there is no company number, and saying
   * "company number" on a published policy would be a misstatement.
   */
  businessRegistrationNumber: string;
  /**
   * Where post reaches us — deliberately NOT the principal place of business
   * from the certificate, which is residential. The Act requires the controller
   * be contactable; it does not require a home address on a public page. The
   * registered particulars stay with the Companies Office, which is the record
   * that is meant to hold them.
   */
  correspondenceAddress: string;
  /** Where data-protection requests and complaints go. */
  privacyEmail: string;
  /** General support and contractual notices. */
  supportEmail: string;
  /**
   * Data controller registration with the Office of the Information
   * Commissioner. Put "Not yet registered" if that is the honest position —
   * the notice will clear, and the page will say what is true.
   */
  oicRegistration: string;
}

export const LEGAL_ENTITY: LegalEntity = {
  // From the Certificate of Registration, Form B.N.9, dated 9 August 2026.
  registeredName: "DKS Technologies",
  businessRegistrationNumber: "11602/2026",
  correspondenceAddress:
    "Debra-Kaye Samantha Smith, c/o Marvaley Post Office, Kingston 20, Jamaica",
  /* One mailbox, used for both. A privacy policy that routes data-subject
     requests to an address nobody has created is worse than one that shares an
     inbox — the request simply bounces, and the obligation is missed. Split
     these the day privacy@ exists. */
  privacyEmail: "customersupport@uselyne.com",
  supportEmail: "customersupport@uselyne.com",
  /* The honest position. Jamaica's Data Protection Act requires controllers to
     register with the Office of the Information Commissioner, so this line is
     an admission — but an unregistered controller claiming otherwise is worse,
     and a procurement reviewer will check. Change it the moment it is done. */
  oicRegistration: "Not yet registered",
};

/** Which identity fields are still outstanding. Empty array = ready to publish. */
export function outstandingLegalFields(entity: LegalEntity = LEGAL_ENTITY): string[] {
  const labels: Record<keyof LegalEntity, string> = {
    registeredName: "Registered business name",
    businessRegistrationNumber: "Business Name (BN) registration number",
    correspondenceAddress: "Correspondence address",
    privacyEmail: "Privacy contact address",
    supportEmail: "Support contact address",
    oicRegistration: "Information Commissioner registration",
  };
  return (Object.keys(labels) as Array<keyof LegalEntity>)
    .filter((key) => !entity[key]?.trim())
    .map((key) => labels[key]);
}

/**
 * Substitute the identity block into the policy text.
 *
 * An unfilled field is left as its own placeholder token rather than being
 * silently replaced with an empty string — a sentence that reads "operated by ,
 * a company registered in Jamaica" would look like a rendering bug and hide the
 * real problem.
 */
export function applyLegalEntity(markdown: string, entity: LegalEntity = LEGAL_ENTITY): string {
  const map: Record<string, string> = {
    "[REGISTERED COMPANY NAME]": entity.registeredName,
    "[NUMBER]": entity.businessRegistrationNumber,
    "[ADDRESS]": entity.correspondenceAddress,
    "[PRIVACY EMAIL]": entity.privacyEmail,
    "[SUPPORT EMAIL]": entity.supportEmail,
    "[REGISTRATION NUMBER]": entity.oicRegistration,
  };
  return Object.entries(map).reduce(
    (text, [token, value]) => (value.trim() ? text.split(token).join(value.trim()) : text),
    markdown,
  );
}
