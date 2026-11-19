/**
 * The sheet the walkthrough imports, so the tour can show all five steps.
 *
 * Everything past the dropzone — sheet, mapping, check, run — is rendered FROM a
 * parsed file, so a tour without one can only point at the dropzone and stop.
 * That taught the first step of five.
 *
 * Held as CSV text and turned into a `File` on demand: `parseSheetFile`
 * dispatches on the extension and the wizard is a pure cascade from there, so
 * this walks the real pipeline rather than a fixture injected halfway down it.
 *
 * The columns are chosen, not decorative. `Name` is what `suggestMapping` reads
 * as the name field, and WITHOUT one the wizard is `blockedBecause: noName` from
 * the map step onward — the tour would advance into a Check that builds nothing.
 * `Building` and `Floor` repeat so the hierarchy is offered; `Area`/`Built` are
 * numeric so the level suggester rules them out as measurements.
 */
const SAMPLE_CSV = `Building,Floor,Name,Area m2,Built,Street,City,Postcode
Blok A,Ground floor,Reception,48.5,1996,Kerkstraat,Rotterdam,3011 AB
Blok A,Ground floor,Meeting room,22.0,1996,Kerkstraat,Rotterdam,3011 AB
Blok A,First floor,Office 1.01,31.4,1996,Kerkstraat,Rotterdam,3011 AB
Blok A,First floor,Office 1.02,29.8,1996,Kerkstraat,Rotterdam,3011 AB
Blok B,Ground floor,Workshop,120.0,2004,Kerkstraat,Rotterdam,3011 AB
Blok B,First floor,Storage,64.0,2004,Kerkstraat,Rotterdam,3011 AB
`

/**
 * The name is user-visible — the wizard prints it, and `useRunImport` would send
 * it as `filename`. It says what this is in a job list, in case a run ever
 * escapes the tour.
 */
export const SAMPLE_SHEET_NAME = 'example-buildings.csv'

export const sampleSheetFile = () =>
  new File([SAMPLE_CSV], SAMPLE_SHEET_NAME, { type: 'text/csv' })
