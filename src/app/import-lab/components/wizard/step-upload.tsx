'use client'

import { FileSpreadsheet, Upload } from 'lucide-react'

const RECENT = [
  {
    name: 'riverside-depot-q3.csv',
    when: 'yesterday',
    mapping: 'Northgate room register',
  },
  {
    name: 'asset-register-2026.xlsx',
    when: '3 days ago',
    mapping: 'Asset register',
  },
]

/**
 * Limits are stated INSIDE the dropzone rather than in a permanent banner above the wizard.
 *
 * Today's `ImportLimitsInfo` sits above every step, so it is loudest when it is least useful and
 * gone from view by the time a number could be exceeded. It also re-serializes the whole mapped
 * dataset on every render to compute its size.
 */
export function StepUpload({ onPick }: { onPick: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Upload a spreadsheet</h3>
        <p className="text-sm text-muted-foreground">
          Excel or CSV. Nothing is created until you confirm at the end.
        </p>
      </div>

      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Drop a file here, or click to choose</p>
        <p className="mt-1 text-sm text-muted-foreground">
          .xlsx, .xls, .csv — up to 100 MB and 50,000 rows
        </p>
      </button>

      {/* A mapping is real work — 11 columns here, 60 on a full property export. Offering the
          last one used is the difference between a quarterly import taking a minute or an hour. */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Reuse a saved mapping</p>
        <div className="divide-y rounded-md border">
          {RECENT.map((file) => (
            <button
              key={file.name}
              type="button"
              onClick={onPick}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{file.mapping}</p>
                  <p className="text-xs text-muted-foreground">
                    last used on {file.name}, {file.when}
                  </p>
                </div>
              </div>
              {/* A span, not a Button. The whole row is already the control, and a nested
                  <button> is invalid HTML that breaks hydration — a second focus stop for an
                  action the row itself performs. */}
              <span className="text-sm text-muted-foreground">Use →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
