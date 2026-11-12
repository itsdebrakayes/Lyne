/**
 * sectorExamples — the worked examples in hints and placeholders.
 *
 * Terms (useSectorTerms) rename the nouns; these are the sentences around
 * them. "Bring two payslips" teaches a credit union what a good checklist item
 * looks like and teaches a hospital nothing, so each sector gets examples from
 * its own counter, or bedside. Government wording is the fallback.
 */
export interface SectorExamples {
  /** The "Keep it concrete" hint: a good item and a vague one. */
  concreteGood: string;
  concreteVague: string;
  bringPlaceholder: string;
  preparePlaceholder: string;
  /** What was missing on an incomplete visit. */
  missingPlaceholder: string;
  /** What must not be typed into that note. */
  sensitiveWarning: string;
}

const DEFAULT: SectorExamples = {
  concreteGood: 'Bring two payslips',
  concreteVague: 'bring all documents',
  bringPlaceholder: 'e.g. Two recent payslips',
  preparePlaceholder: 'e.g. Complete the loan application',
  missingPlaceholder: 'e.g. Proof of address was older than three months',
  sensitiveWarning: 'Do not enter account balances or sensitive financial details.',
};

const BY_SECTOR: Record<string, SectorExamples> = {
  healthcare: {
    concreteGood: 'Bring the imaging order from your doctor',
    concreteVague: 'bring your paperwork',
    bringPlaceholder: 'e.g. Imaging order from your doctor',
    preparePlaceholder: 'e.g. Do not eat for 8 hours before the scan',
    missingPlaceholder: 'e.g. No imaging order; sent back to the referring doctor',
    sensitiveWarning: 'Keep it to what was missing. Do not enter diagnoses or clinical notes.',
  },
};

export function sectorExamples(sector?: string | null): SectorExamples {
  return (sector && BY_SECTOR[sector]) || DEFAULT;
}
