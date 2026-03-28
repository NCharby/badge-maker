'use client'

import { useRef, useState, useTransition } from 'react'

type ImportError = { row: number; message: string }
type ImportResult = { imported: number; errors: ImportError[] }

interface CSVImportPanelProps {
  templatePath: string
  templateLabel: string
  onImport: (csvText: string) => Promise<ImportResult | { error: string }>
  onSuccess: () => void
}

export default function CSVImportPanel({
  templatePath,
  templateLabel,
  onImport,
  onSuccess,
}: CSVImportPanelProps) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [globalError, setGlobalError] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setResult(null)
    setGlobalError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleCancel() {
    setOpen(false)
    reset()
  }

  function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setGlobalError('Please select a CSV file.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setGlobalError('Only .csv files are accepted.')
      return
    }
    setGlobalError('')
    setResult(null)
    startTransition(async () => {
      const text = await file.text()
      const res = await onImport(text)
      if ('error' in res) {
        setGlobalError(res.error)
      } else {
        if (res.imported > 0 && res.errors.length === 0) {
          // Clean success — close panel and refresh the page to show new data
          setOpen(false)
          reset()
          onSuccess()
        } else {
          // Partial import or total failure — stay open so errors are visible
          setResult(res)
          if (res.imported > 0) onSuccess()
        }
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--sd-border)',
    fontSize: '13px',
    color: 'var(--sd-text)',
    background: 'var(--sd-card)',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div>
      {!open && (
        <button
          onClick={() => { setOpen(true); reset() }}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            border: '1px solid var(--sd-border)',
            background: 'none',
            fontSize: '13px',
            color: 'var(--sd-muted)',
            cursor: 'pointer',
          }}
        >
          Import CSV
        </button>
      )}

      {open && (
        <div style={{
          background: '#F9FAFB',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)' }}>Import from CSV</span>
            <a
              href={templatePath}
              download
              style={{ fontSize: '12px', color: 'var(--sd-purple)', textDecoration: 'none' }}
            >
              Download {templateLabel}
            </a>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
              CSV File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={inputStyle}
              onChange={() => { setResult(null); setGlobalError('') }}
            />
          </div>

          {globalError && (
            <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{globalError}</p>
          )}

          {result && (
            <div style={{ fontSize: '13px' }}>
              {result.imported > 0 && (
                <p style={{ color: 'var(--sd-green-dark)', margin: '0 0 4px' }}>
                  Imported {result.imported} {result.imported === 1 ? 'item' : 'items'}.
                </p>
              )}
              {result.errors.length > 0 && (
                <div>
                  <p style={{ color: '#dc2626', margin: '0 0 4px', fontWeight: 600 }}>
                    {result.imported === 0 ? 'No items were imported. Check the errors below:' : `${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} had errors:`}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#dc2626' }}>
                    {result.errors.map((e, i) => (
                      <li key={i} style={{ fontSize: '12px' }}>Row {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '13px', color: 'var(--sd-muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isPending}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
            >
              {isPending ? 'Importing…' : 'Upload & Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
