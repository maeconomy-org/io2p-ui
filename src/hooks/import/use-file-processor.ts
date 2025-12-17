import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { MAX_FILE_SIZE_MB, STREAM_CHUNK_SIZE } from '@/constants'

export interface SheetData {
  name: string
  data: any[]
  suggestedStartRow?: number
}

export interface UseFileProcessorProps {
  onProgress?: (progress: number) => void
  maxSizeInMB?: number
  streamChunkSize?: number
}

export interface UseFileProcessorResult {
  processFile: (file: File) => Promise<SheetData[]>
  isProcessing: boolean
  progress: number
  error: string | null
  reset: () => void
}

/**
 * Hook for processing XLSX and CSV files with improved handling of large files
 */
export function useFileProcessor({
  onProgress,
  maxSizeInMB = MAX_FILE_SIZE_MB,
  streamChunkSize = STREAM_CHUNK_SIZE, // Use imported constants for default values
}: UseFileProcessorProps = {}): UseFileProcessorResult {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const reset = useCallback(() => {
    setIsProcessing(false)
    setError(null)
    setProgress(0)
  }, [])

  const updateProgress = useCallback(
    (value: number) => {
      setProgress(value)
      onProgress?.(value)
    },
    [onProgress]
  )

  const processFile = useCallback(
    async (file: File): Promise<SheetData[]> => {
      setIsProcessing(true)
      setError(null)
      updateProgress(0)

      try {
        // Check file size
        const fileSizeInMB = file.size / (1024 * 1024)
        if (fileSizeInMB > maxSizeInMB) {
          throw new Error(
            `File size exceeds the maximum limit of ${maxSizeInMB}MB`
          )
        }

        // Check file type
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
          throw new Error('Please upload an XLSX or CSV file')
        }

        // Use different processing based on file type
        if (file.name.endsWith('.csv')) {
          // For CSV files, use dedicated CSV parser
          return await processCSVFile(file)
        } else {
          // For XLSX files, use different strategies based on file size
          if (fileSizeInMB > 5) {
            // For larger files, use streaming approach
            return await processLargeFile(file)
          } else {
            // For smaller files, use standard approach
            return await processStandardFile(file)
          }
        }
      } catch (err) {
        console.error('Error parsing file:', err)
        setError(err instanceof Error ? err.message : 'Failed to parse file')
        return []
      } finally {
        setIsProcessing(false)
      }
    },
    [maxSizeInMB, updateProgress]
  )

  // Process CSV files
  const processCSVFile = useCallback(
    async (file: File): Promise<SheetData[]> => {
      updateProgress(10)
      const text = await file.text()
      updateProgress(20)

      updateProgress(30)

      // Parse CSV using papaparse
      const parseResult = Papa.parse(text, {
        header: false, // We want raw array data
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => {
          // Try to parse numbers
          const trimmed = value.trim()
          if (trimmed === '') return ''

          const numValue = Number(trimmed)
          if (!isNaN(numValue) && trimmed !== '') {
            return numValue
          }

          return trimmed
        },
      })

      updateProgress(70)

      if (parseResult.errors.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors)
      }

      const data = parseResult.data as any[][]

      // Filter out completely empty rows
      const cleanedData = data.filter(
        (row) =>
          row &&
          Array.isArray(row) &&
          row.some((cell) => cell !== undefined && cell !== null && cell !== '')
      )

      // Try to detect the start row by finding patterns
      const suggestedStartRow = detectDataStartRow(cleanedData)

      updateProgress(100)

      // Return as a single sheet (CSV files only have one sheet)
      return [
        {
          name: 'Sheet1',
          data: cleanedData,
          suggestedStartRow,
        },
      ]
    },
    [updateProgress]
  )

  // Process standard-sized files
  const processStandardFile = useCallback(
    async (file: File): Promise<SheetData[]> => {
      updateProgress(10)
      const buffer = await file.arrayBuffer()
      updateProgress(40)

      // Parse workbook
      const workbook = XLSX.read(buffer, { type: 'array' })
      updateProgress(70)

      return extractSheetData(workbook)
    },
    [updateProgress]
  )

  // Process large files with streaming
  const processLargeFile = useCallback(
    async (file: File): Promise<SheetData[]> => {
      return new Promise((resolve, reject) => {
        try {
          // Use FileReader with chunking for better memory usage
          const reader = new FileReader()
          let offset = 0
          const fileSize = file.size
          const chunks: Uint8Array[] = []

          reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
              // Add this chunk to our array
              chunks.push(new Uint8Array(e.target.result))

              // Calculate progress
              offset += streamChunkSize
              const percentLoaded = Math.min(
                90, // Cap at 90% for processing phase
                Math.round((offset / fileSize) * 100)
              )
              updateProgress(percentLoaded)

              // If we've loaded the whole file, process it
              if (offset >= fileSize) {
                try {
                  // Combine all chunks
                  const totalLength = chunks.reduce(
                    (sum, chunk) => sum + chunk.length,
                    0
                  )
                  const combinedChunks = new Uint8Array(totalLength)

                  let position = 0
                  for (const chunk of chunks) {
                    combinedChunks.set(chunk, position)
                    position += chunk.length
                  }

                  // Parse the workbook from the combined chunks
                  const workbook = XLSX.read(combinedChunks, { type: 'array' })
                  const sheetData = extractSheetData(workbook)
                  updateProgress(100)
                  resolve(sheetData)
                } catch (err) {
                  reject(err)
                }
              } else {
                // Read the next chunk
                readNextChunk()
              }
            }
          }

          reader.onerror = (err) => {
            reject(err)
          }

          // Function to read the next chunk
          const readNextChunk = () => {
            const slice = file.slice(
              offset,
              Math.min(offset + streamChunkSize, fileSize)
            )
            reader.readAsArrayBuffer(slice)
          }

          // Start reading
          readNextChunk()
        } catch (err) {
          reject(err)
        }
      })
    },
    [streamChunkSize, updateProgress]
  )

  // Helper to extract sheet data from a workbook
  const extractSheetData = useCallback(
    (workbook: XLSX.WorkBook): SheetData[] => {
      const sheetNames = workbook.SheetNames

      // Process each sheet
      const sheets = sheetNames.map((name) => {
        // Convert sheet to JSON with headers
        const worksheet = workbook.Sheets[name]
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        // Filter out empty rows
        const data = cleanSheetData(rawData)

        // Try to detect the start row by finding patterns
        const suggestedStartRow = detectDataStartRow(data)

        return { name, data, suggestedStartRow }
      })

      // Check if we have data
      if (sheets.length === 0) {
        throw new Error('No sheets found in the file')
      }

      // Check if any sheet has data
      const hasData = sheets.some((sheet) => sheet.data.length > 0)
      if (!hasData) {
        throw new Error('No data found in any sheet')
      }

      return sheets
    },
    []
  )

  return { processFile, isProcessing, progress, error, reset }
}

// Function to detect where the actual data starts
function detectDataStartRow(data: any[]): number {
  // If less than 10 rows, just return 0 (first row)
  if (data.length < 10) return 0

  // Strategy 1: Look for a potential header row by analyzing row structure
  // A header row typically has many columns filled with string values
  for (let i = 0; i < Math.min(20, data.length - 1); i++) {
    const currentRow = data[i]
    if (!currentRow || currentRow.length < 3) continue

    // Check if this row has multiple string values (potential header)
    const stringCells = currentRow.filter(
      (cell: any) => typeof cell === 'string' && cell.trim() !== ''
    ).length

    // Check if next row has a similar structure but with different value types
    const nextRow = data[i + 1]
    if (nextRow && nextRow.length >= currentRow.length * 0.8) {
      // If current row has mostly strings and next row has similar structure
      // this is likely a header row
      if (stringCells >= Math.max(3, currentRow.length * 0.5)) {
        return i
      }
    }
  }

  // Strategy 2: Look for rows with consistent structure
  // Create a map to track patterns of non-empty cells
  const rowPatterns = new Map<string, number[]>()
  const rowCounts = new Map<number, number>() // Track rows with same number of cells

  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i]
    if (!row) continue

    // Count non-empty cells
    const nonEmptyCells = row.filter(
      (cell: any) => cell !== undefined && cell !== null && cell !== ''
    ).length

    // Skip rows with very few cells
    if (nonEmptyCells < 3) continue

    // Track rows with the same number of non-empty cells
    if (!rowCounts.has(nonEmptyCells)) {
      rowCounts.set(nonEmptyCells, 1)
    } else {
      rowCounts.set(nonEmptyCells, (rowCounts.get(nonEmptyCells) || 0) + 1)
    }

    // Create a pattern string based on which cells are empty/non-empty
    const pattern = row
      .map((cell: any) =>
        cell !== undefined && cell !== null && cell !== '' ? '1' : '0'
      )
      .join('')

    if (!rowPatterns.has(pattern)) {
      rowPatterns.set(pattern, [i])
    } else {
      rowPatterns.get(pattern)?.push(i)
    }
  }

  // Find the most common pattern with at least 3 occurrences
  let mostCommonPattern: string | null = null
  let maxOccurrences = 0

  rowPatterns.forEach((occurrences, pattern) => {
    // Only consider patterns with at least 3 non-empty cells
    const nonEmptyCellCount = (pattern.match(/1/g) || []).length
    if (
      occurrences.length > maxOccurrences &&
      occurrences.length >= 3 &&
      nonEmptyCellCount >= 3
    ) {
      mostCommonPattern = pattern
      maxOccurrences = occurrences.length
    }
  })

  if (mostCommonPattern) {
    // Get the first occurrence of this pattern
    const firstOccurrence = rowPatterns.get(mostCommonPattern)?.[0] || 0

    // Check if there's a potential header row right before this
    if (firstOccurrence > 0) {
      const prevRow = data[firstOccurrence - 1]
      const currentRow = data[firstOccurrence]

      if (prevRow && currentRow) {
        // If previous row has similar number of cells as the data rows
        // and contains mostly string values, it's likely a header
        const prevRowNonEmpty = prevRow.filter(
          (cell: any) => cell !== undefined && cell !== null && cell !== ''
        ).length

        const prevRowStrings = prevRow.filter(
          (cell: any) => typeof cell === 'string' && cell.trim() !== ''
        ).length

        const currentRowNonEmpty = currentRow.filter(
          (cell: any) => cell !== undefined && cell !== null && cell !== ''
        ).length

        // If previous row has similar structure and mostly strings, it's likely a header
        if (
          prevRowNonEmpty >= currentRowNonEmpty * 0.8 &&
          prevRowStrings >= prevRowNonEmpty * 0.7
        ) {
          return firstOccurrence - 1 // Return the header row
        }
      }
    }

    return firstOccurrence
  }

  // Default to first row if no clear pattern is found
  return 0
}

// Function to clean sheet data by removing empty rows
function cleanSheetData(data: any[]): any[] {
  if (!data || !data.length) return []

  // Find the last row with actual data
  let lastDataRowIndex = data.length - 1

  while (lastDataRowIndex >= 0) {
    const row = data[lastDataRowIndex]

    // Check if the row has any non-empty cells
    const hasData =
      row &&
      Array.isArray(row) &&
      row.some((cell) => cell !== undefined && cell !== null && cell !== '')

    if (hasData) break
    lastDataRowIndex--
  }

  // Filter out completely empty rows within the data range
  return data.slice(0, lastDataRowIndex + 1).filter((row, index) => {
    // Keep header rows (first few rows) even if empty
    if (index < 5) return true

    // Check if the row is empty or just contains empty values
    return (
      row &&
      Array.isArray(row) &&
      row.some((cell) => cell !== undefined && cell !== null && cell !== '')
    )
  })
}
