import React from 'react';

export type NarrativeBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

const KNOWN_TABLE_HEADER_TRIPLETS: string[][] = [
  ['segment', 'selection', 'purpose / use'],
  ['segment', 'selection', 'purpose'],
  ['audience', 'selection', 'purpose / use'],
  ['audience', 'status', 'purpose'],
  ['category', 'selection', 'purpose'],
  ['group', 'selection', 'purpose'],
];

const SHORT_STATUS_VALUES = new Set([
  'yes',
  'no',
  'open',
  'selected',
  'included',
  'primary',
  'secondary',
  'optional',
  'n/a',
  'active',
  'all',
]);

function isAudienceRowLead(line: string): boolean {
  return /^(?:group\s+|category\s+|segment\s+)?[A-E](?:\s*[–\-—/to]+\s*[A-E])?\s*[–\-—:]/i.test(
    line.trim()
  );
}

function isShortStatusToken(line: string): boolean {
  const clean = line.trim().toLowerCase().replace(/[.,;:!]+$/, '');
  return SHORT_STATUS_VALUES.has(clean) || (clean.length > 0 && clean.length <= 12 && !clean.includes(' '));
}

/**
 * Parses raw proposal narrative text (such as audienceEDetails, deliverables, integration, etc.)
 * into clean paragraphs, bullet lists, or reconstructed tables when an author pasted a multi-column
 * table from Word/Docs/AI that got flattened into single-cell lines.
 */
export function parseStructuredNarrativeBlocks(rawText?: string | null): NarrativeBlock[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize line endings and trim each line
  const rawLines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  // Extract non-empty lines while preserving paragraph grouping where appropriate
  const nonEmptyLines = rawLines.filter((l) => l.length > 0);
  if (nonEmptyLines.length === 0) return [];

  const blocks: NarrativeBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraphs = () => {
    if (paragraphBuffer.length === 0) return;
    for (const p of paragraphBuffer) {
      if (p.trim()) {
        blocks.push({ type: 'paragraph', text: p.trim() });
      }
    }
    paragraphBuffer = [];
  };

  let i = 0;
  while (i < nonEmptyLines.length) {
    const line = nonEmptyLines[i];

    // 1. Check for Tab-Separated or Pipe-Separated Table Rows
    if (line.includes('\t') || (line.startsWith('|') && line.endsWith('|') && line.length > 3)) {
      const tableLines: string[][] = [];
      while (i < nonEmptyLines.length) {
        const cur = nonEmptyLines[i];
        if (cur.includes('\t')) {
          tableLines.push(cur.split('\t').map((c) => c.trim()));
          i++;
        } else if (cur.startsWith('|') && cur.endsWith('|')) {
          const cells = cur
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          // Skip markdown separator row like |---|---|
          if (!cells.every((c) => /^[-:]+$/.test(c))) {
            tableLines.push(cells);
          }
          i++;
        } else {
          break;
        }
      }
      if (tableLines.length >= 2) {
        flushParagraphs();
        blocks.push({
          type: 'table',
          headers: tableLines[0],
          rows: tableLines.slice(1),
        });
        continue;
      }
    }

    // 2. Check for Flattened 3-Column Header Triplet (e.g. "Segment", "Selection", "Purpose / Use")
    if (i + 2 < nonEmptyLines.length) {
      const c1 = nonEmptyLines[i].toLowerCase();
      const c2 = nonEmptyLines[i + 1].toLowerCase();
      const c3 = nonEmptyLines[i + 2].toLowerCase();

      const matchedHeader = KNOWN_TABLE_HEADER_TRIPLETS.some(
        ([h1, h2, h3]) => c1 === h1 && c2 === h2 && (c3 === h3 || c3.startsWith(h3))
      );

      if (matchedHeader) {
        const headers = [nonEmptyLines[i], nonEmptyLines[i + 1], nonEmptyLines[i + 2]];
        i += 3;
        const rows: string[][] = [];

        while (i + 2 < nonEmptyLines.length) {
          const r1 = nonEmptyLines[i];
          const r2 = nonEmptyLines[i + 1];
          const r3 = nonEmptyLines[i + 2];

          // Verify it looks like a 3-cell row (either starts with segment label or r2 is a short selection token)
          if (isAudienceRowLead(r1) || isShortStatusToken(r2)) {
            rows.push([r1, r2, r3]);
            i += 3;
          } else {
            break;
          }
        }

        if (rows.length > 0) {
          flushParagraphs();
          blocks.push({
            type: 'table',
            headers,
            rows,
          });
          continue;
        }
      }
    }

    // 3. Check for Headerless Flattened Audience Triplets (e.g. "A – Church members..." / "Yes" / "To serve...")
    if (
      i + 2 < nonEmptyLines.length &&
      isAudienceRowLead(nonEmptyLines[i]) &&
      isShortStatusToken(nonEmptyLines[i + 1])
    ) {
      const rows: string[][] = [];
      while (
        i + 2 < nonEmptyLines.length &&
        isAudienceRowLead(nonEmptyLines[i]) &&
        isShortStatusToken(nonEmptyLines[i + 1])
      ) {
        rows.push([nonEmptyLines[i], nonEmptyLines[i + 1], nonEmptyLines[i + 2]]);
        i += 3;
      }

      if (rows.length > 0) {
        flushParagraphs();
        blocks.push({
          type: 'table',
          headers: ['Segment', 'Selection', 'Purpose / Role in Project'],
          rows,
        });
        continue;
      }
    }

    // 4. Check for consecutive bullet lines
    if (/^(?:[•*▪▸\-–]|\d+[.)])\s+/.test(line)) {
      flushParagraphs();
      const items: string[] = [];
      while (
        i < nonEmptyLines.length &&
        /^(?:[•*▪▸\-–]|\d+[.)])\s+/.test(nonEmptyLines[i])
      ) {
        items.push(nonEmptyLines[i].replace(/^(?:[•*▪▸\-–]|\d+[.)])\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'bullets', items });
      continue;
    }

    // 5. Standard paragraph line
    paragraphBuffer.push(line);
    i++;
  }

  flushParagraphs();
  return blocks;
}

/**
 * Checks whether a raw text string contains a flattened multi-line pasted table
 * that can be cleaned into compact bullet lines in the editor.
 */
export function hasFlattenedPastedTable(rawText?: string | null): boolean {
  const blocks = parseStructuredNarrativeBlocks(rawText);
  return blocks.some((b) => b.type === 'table');
}

/**
 * Converts a raw text string containing a flattened pasted table into clean, compact
 * single-line bullet statements suitable for a plain textarea.
 */
export function compactFlattenedTableText(rawText: string): string {
  const blocks = parseStructuredNarrativeBlocks(rawText);
  if (!blocks.some((b) => b.type === 'table')) {
    // Still collapse 3+ consecutive newlines into double newlines
    return rawText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const out: string[] = [];
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      out.push(block.text);
    } else if (block.type === 'bullets') {
      out.push(block.items.map((item) => `• ${item}`).join('\n'));
    } else if (block.type === 'table') {
      const bulletRows = block.rows.map((row) => {
        if (row.length === 3) {
          const [col1, col2, col3] = row;
          const statusPart =
            col2 && col2.toLowerCase() !== 'yes' ? ` [${col2}]` : '';
          return `• ${col1}${statusPart}: ${col3}`;
        }
        return `• ${row.join(' — ')}`;
      });
      out.push(bulletRows.join('\n'));
    }
  }

  return out.join('\n\n').trim();
}

interface FormattedNarrativeTextProps {
  text?: string | null;
  fallback?: string;
  className?: string;
}

/**
 * Renders proposal narrative text cleanly in both the PDF Print View and Review Drawer,
 * automatically formatting flattened pasted tables into compact, structured tables
 * and collapsing excessive empty lines.
 */
export const FormattedNarrativeText: React.FC<FormattedNarrativeTextProps> = ({
  text,
  fallback = '—',
  className = '',
}) => {
  const blocks = parseStructuredNarrativeBlocks(text);

  if (blocks.length === 0) {
    return <span className="text-slate-400 italic">{fallback}</span>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'paragraph') {
          return (
            <p key={idx} className="leading-relaxed break-words">
              {block.text}
            </p>
          );
        }

        if (block.type === 'bullets') {
          return (
            <ul key={idx} className="list-disc pl-4 space-y-1">
              {block.items.map((item, i) => (
                <li key={i} className="leading-relaxed break-words">
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={idx}
              className="my-1.5 border border-slate-200 rounded-lg overflow-hidden bg-white print:border-slate-300"
            >
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-100 print:border-slate-300">
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className={`py-1.5 px-2.5 ${
                          hIdx === 1 && block.headers.length === 3 ? 'w-20 text-center' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="align-top">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-1.5 px-2.5 break-words ${
                            cIdx === 0
                              ? 'font-semibold text-slate-900'
                              : cIdx === 1 && row.length === 3
                              ? 'text-center font-bold text-slate-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
