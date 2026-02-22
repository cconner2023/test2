/**
 * PII Detection — scans free-text input for patterns that may indicate
 * personally identifiable information (SSN, DOB, phone, email, DoD ID, MRN).
 *
 * Returns user-facing warning strings. Detection is BLOCKING — notes with
 * detected PII cannot be saved until the flagged content is removed.
 */

interface PIIMatch {
  pattern: string;
  label: string;
}

const PII_PATTERNS: PIIMatch[] = [
  // SSN: 123-45-6789 or 123456789 (9 consecutive digits not part of a larger number)
  { pattern: '(?<!\\d)\\d{3}-\\d{2}-\\d{4}(?!\\d)', label: 'SSN' },
  { pattern: '(?<!\\d)\\d{9}(?!\\d)', label: 'SSN (9-digit number)' },

  // DoD ID / EDIPI: 10-digit number
  { pattern: '(?<!\\d)\\d{10}(?!\\d)', label: 'DoD ID / EDIPI' },

  // Date of birth with keyword prefix: DOB 01/15/1990
  { pattern: '(?:DOB|D\\.O\\.B|date of birth|born)\\s*[:\\-]?\\s*\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}', label: 'Date of Birth' },

  // Standalone dates: MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY, YYYY-MM-DD
  { pattern: '(?<!\\d)(?:0?[1-9]|1[0-2])[/\\-.](?:0?[1-9]|[12]\\d|3[01])[/\\-.](?:19|20)\\d{2}(?!\\d)', label: 'Date (possible DOB/PHI)' },
  { pattern: '(?<!\\d)(?:19|20)\\d{2}[/\\-.](?:0?[1-9]|1[0-2])[/\\-.](?:0?[1-9]|[12]\\d|3[01])(?!\\d)', label: 'Date (possible DOB/PHI)' },

  // Written dates: January 15, 1990 / 15 Jan 1990
  { pattern: '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\.?\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}', label: 'Date (possible DOB/PHI)' },
  { pattern: '\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\.?\\s+(?:19|20)\\d{2}', label: 'Date (possible DOB/PHI)' },

  // Phone numbers: (123) 456-7890, 123-456-7890, 123.456.7890
  { pattern: '\\(?\\d{3}\\)?[\\s.\\-]?\\d{3}[\\s.\\-]?\\d{4}', label: 'Phone number' },

  // Email addresses
  { pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', label: 'Email address' },

  // Street addresses: number + street name + suffix
  { pattern: '\\d{1,5}\\s+[A-Za-z]+\\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place)\\.?(?:\\s|,|$)', label: 'Street address' },

  // MRN / Medical Record Number keywords
  { pattern: '(?:MRN|medical record|record number|patient id)\\s*[:#]?\\s*\\w+', label: 'Medical Record Number' },

  // "Patient Name" or "Pt Name" followed by text
  { pattern: '(?:patient|pt)\\.?\\s+name\\s*[:\\-]?\\s*[A-Za-z]+', label: 'Patient name reference' },
];

// Compile once
const compiledPatterns = PII_PATTERNS.map(({ pattern, label }) => ({
  regex: new RegExp(pattern, 'i'),
  label,
}));

/**
 * Scans text for PII patterns and returns a deduplicated list of warning labels.
 * Returns an empty array if no PII detected.
 */
export function detectPII(text: string): string[] {
  if (!text || text.length < 5) return [];

  const found = new Set<string>();
  for (const { regex, label } of compiledPatterns) {
    if (regex.test(text)) {
      found.add(label);
    }
  }
  return Array.from(found);
}
