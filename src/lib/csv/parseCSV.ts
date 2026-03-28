/**
 * Minimal CSV parser — handles quoted fields with embedded commas,
 * strips BOM, normalizes headers to lowercase-trimmed keys.
 * No external dependencies.
 */
export function parseCSV(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text

  const lines = splitLines(cleaned)
  if (lines.length === 0) return []

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim())

  const results: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    // Skip fully empty rows
    if (values.every(v => v === '')) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? ''
    })
    results.push(row)
  }
  return results
}

function splitLines(text: string): string[] {
  // Normalize line endings then split; filter trailing empty line
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((_, i, arr) =>
    i < arr.length - 1 || arr[i] !== ''
  )
}

function parseRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}
