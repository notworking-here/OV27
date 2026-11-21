import { UserRole, UNIONS } from '../types';

export interface ParsedUserAccount {
  displayName: string;
  email: string;
  union: string;
  role: UserRole;
}

/**
 * Parses raw text input containing user information into structured ParsedUserAccount objects.
 * Supports multiple common formats:
 *  - "Email, Name, Union, Role"
 *  - "Name, Email, Union, Role"
 *  - "Name <email@domain.org>"
 *  - "email@domain.org" (single email per line)
 *  - Tab-delimited copy-paste from Excel / Google Sheets
 */
export function parseBulkUserInput(
  rawText: string,
  defaultUnion: string = UNIONS[0],
  defaultRole: UserRole = 'user'
): ParsedUserAccount[] {
  if (!rawText.trim()) return [];

  const lines = rawText.split('\n');
  const results: ParsedUserAccount[] = [];
  const seenEmails = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.toLowerCase().startsWith('name,email')) {
      continue; // Skip comments and CSV headers
    }

    // Determine delimiter (tab, semicolon, or comma)
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim());

    let email = '';
    let name = '';
    let union = defaultUnion;
    let role: UserRole = defaultRole;

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

    if (parts.length === 1) {
      // Single item: Could be "john@domain.com" or "John Doe <john@domain.com>"
      const match = parts[0].match(emailRegex);
      if (match) {
        email = match[1].toLowerCase();
        const extractedName = parts[0].replace(match[0], '').replace(/[<>]/g, '').trim();
        name = extractedName || email.split('@')[0].replace(/[._]/g, ' ');
      }
    } else {
      // Multiple items: check which element is an email
      const emailIdx = parts.findIndex((p) => emailRegex.test(p));

      if (emailIdx >= 0) {
        const match = parts[emailIdx].match(emailRegex);
        email = match ? match[1].toLowerCase() : parts[emailIdx].toLowerCase();

        if (emailIdx === 0) {
          // Format: Email, Name, Union, Role
          name = parts[1] || '';
          if (parts[2]) union = resolveUnion(parts[2], defaultUnion);
          if (parts[3]) role = resolveRole(parts[3], defaultRole);
        } else if (emailIdx === 1) {
          // Format: Name, Email, Union, Role
          name = parts[0] || '';
          if (parts[2]) union = resolveUnion(parts[2], defaultUnion);
          if (parts[3]) role = resolveRole(parts[3], defaultRole);
        } else {
          // Other positioning: take first non-email as name
          name = parts[0] || '';
          if (parts[2]) union = resolveUnion(parts[2], defaultUnion);
          if (parts[3]) role = resolveRole(parts[3], defaultRole);
        }
      }
    }

    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      const cleanName = name
        ? name.replace(/\b\w/g, (c) => c.toUpperCase())
        : email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      results.push({
        displayName: cleanName,
        email,
        union,
        role,
      });
    }
  }

  return results;
}

function resolveUnion(input: string, fallback: string): string {
  const clean = input.trim().toLowerCase();
  const matched = UNIONS.find(
    (u) =>
      u.toLowerCase() === clean ||
      u.toLowerCase().includes(clean) ||
      clean.includes(u.toLowerCase())
  );
  return matched || fallback;
}

function resolveRole(input: string, fallback: UserRole): UserRole {
  const clean = input.trim().toLowerCase();
  if (clean.includes('super') || clean.includes('admin')) {
    return 'super_admin';
  }
  if (clean.includes('liaison')) {
    return 'division_liaison';
  }
  if (clean.includes('treasur')) {
    return 'treasurer';
  }
  if (clean.includes('coord') || clean.includes('director') || clean.includes('cfo')) {
    return 'coordinator';
  }
  if (clean.includes('user') || clean.includes('author') || clean.includes('member')) {
    return 'user';
  }
  return fallback;
}

/**
 * Formats a numeric currency amount strictly with 2 decimal places (standard financial cents).
 * E.g. 1222447.311 -> "1,222,447.31", 10254449 -> "10,254,449.00"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  decimals: number = 2
): string {
  const val = Number(amount) || 0;
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
