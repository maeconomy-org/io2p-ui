#!/usr/bin/env node
// Generates the import fixtures that are NOT worth committing: the two workbooks (a binary nobody
// can diff) and huge.csv (derived from a limit, so its size belongs next to the number).
//
// The eight hand-written CSVs beside this file are committed on purpose — a reviewer can read them.

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ExcelJS from 'exceljs'

const outDir = dirname(fileURLToPath(import.meta.url))

/**
 * Must exceed the `MAX_OBJECTS_PER_IMPORT` the e2e server runs with (200 — see the plan's §4.9 run
 * command). The product default is 50,000, and a 50,001-row fixture would be a megabyte of CSV that
 * papaparse has to chew through in the browser on every run.
 */
const HUGE_ROWS = 250

/** Must exceed the `MAX_IMPORT_FILE_SIZE_MB` the e2e server runs with (1). */
const OVERSIZE_BYTES = 2 * 1024 * 1024

function hugeCsv() {
  const lines = ['name,size']
  for (let i = 1; i <= HUGE_ROWS; i += 1) lines.push(`Plot ${i},${i * 3}`)
  return lines.join('\n') + '\n'
}

/** More than the Check step's 40-row preview, and fewer than the 200-object cap. */
const MANY_ROWS = 60

function manyCsv() {
  const lines = ['name,size']
  for (let i = 1; i <= MANY_ROWS; i += 1) lines.push(`Parcel ${i},${i * 5}`)
  return lines.join('\n') + '\n'
}

function oversizeCsv() {
  let out = 'name,notes\n'
  for (let i = 1; out.length < OVERSIZE_BYTES; i += 1) {
    out += `Row ${i},${'padding '.repeat(12)}\n`
  }
  return out
}

/** Three sheets with different columns each — a CSV is one sheet by definition. */
async function multiSheet() {
  const workbook = new ExcelJS.Workbook()

  const buildings = workbook.addWorksheet('Buildings')
  buildings.addRows([
    ['name', 'description', 'size'],
    ['North Gate', 'Main entrance building', 120],
    ['South Gate', 'Service entrance', 80],
  ])

  const plots = workbook.addWorksheet('Plots')
  plots.addRows([
    ['name', 'owner', 'area', 'zoning'],
    ['Plot A', 'Municipality', 1200, 'residential'],
    ['Plot B', 'Municipality', 900, 'mixed'],
    ['Plot C', 'Province', 450, 'green'],
  ])

  const trees = workbook.addWorksheet('Trees')
  trees.addRows([
    ['name', 'species'],
    ['Tree 1', 'Quercus robur'],
  ])

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/**
 * Trailing blanks and a fully blank column. exceljs and papaparse disagree about what a missing
 * trailing cell is, and this is the only fixture that loads the xlsx reader on that question — core
 * lists the CSV/XLSX empty-cell divergence among its verified breaks.
 */
async function emptyCells() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRows([
    ['name', 'description', 'unused', 'size'],
    ['North Gate', 'Main entrance building', '', 120],
    ['South Gate', '', '', ''],
    ['East Wing', 'Offices', '', 240],
  ])
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

async function ensure(name, produce) {
  const path = resolve(outDir, name)
  const data = await produce()
  try {
    const existing = await stat(path)
    if (existing.size === data.length) return { name, status: 'ok' }
  } catch {
    // missing — fall through to write
  }
  await writeFile(path, data)
  return { name, status: 'written', bytes: data.length }
}

export async function generateSheets() {
  await mkdir(outDir, { recursive: true })
  return Promise.all([
    ensure('huge.csv', async () => Buffer.from(hugeCsv(), 'utf8')),
    ensure('many.csv', async () => Buffer.from(manyCsv(), 'utf8')),
    ensure('oversize.csv', async () => Buffer.from(oversizeCsv(), 'utf8')),
    ensure('multi-sheet.xlsx', multiSheet),
    ensure('empty-cells.xlsx', emptyCells),
  ])
}
