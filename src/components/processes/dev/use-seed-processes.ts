'use client'

import { useState } from 'react'

import { useCommonApi } from '@/hooks/api'
import { useProcesses } from '@/hooks/api/use-processes'
import { slugifyKey } from '@/components/processes/sheets/process-create-sheet'
import type { ProcessModelInput } from '@/components/processes/sheets/process-create-sheet'
import type { ProcessMaterial } from '@/types/process'
import { logger } from '@/lib'
import {
  PROCESS_SEED_TEMPLATES,
  type ProcessSeedTemplate,
  type SeedMaterial,
} from './seed-templates'

export interface SeedResult {
  created: number
  skipped: number
  unresolved: string[]
}

/**
 * DEV-ONLY: resolve template object names to current UUIDs and create each process through
 * the normal codec path. Survives DB wipes because it looks objects up by name every run.
 */
export function useSeedProcesses() {
  const { useSearch } = useCommonApi()
  const search = useSearch()
  const { useCreateProcess } = useProcesses()
  const createProcess = useCreateProcess()
  const [isSeeding, setIsSeeding] = useState(false)

  const resolveObject = async (
    name: string
  ): Promise<{ uuid: string; name: string } | null> => {
    const res = await search.mutateAsync({
      searchTerm: name,
      size: 25,
      page: 0,
    })
    const lower = name.toLowerCase()
    const matches = (res?.content ?? []).filter(
      (o) => o.name?.toLowerCase() === lower && o.uuid
    )
    if (matches.length === 0) return null
    if (matches.length > 1) {
      logger.warn(
        `Seed: "${name}" matched ${matches.length} objects; using the first.`
      )
    }
    const first = matches[0]
    return { uuid: first.uuid as string, name: first.name ?? name }
  }

  const toMaterial = (
    m: SeedMaterial,
    nameToObject: Map<string, { uuid: string; name: string }>
  ): ProcessMaterial | null => {
    const obj = nameToObject.get(m.objectName.toLowerCase())
    if (!obj) return null
    return {
      objectUuid: obj.uuid,
      objectName: obj.name,
      properties: [
        {
          key: 'quantity',
          label: m.quantityLabel ?? 'Quantity',
          values: [m.quantity ?? ''],
          isQuantity: true,
        },
        ...(m.properties ?? []).map((p) => ({
          key: slugifyKey(p.label),
          label: p.label,
          values: [p.value],
          isQuantity: false,
        })),
      ],
    }
  }

  const toModel = (
    tpl: ProcessSeedTemplate,
    nameToObject: Map<string, { uuid: string; name: string }>
  ): ProcessModelInput | null => {
    const inputs = tpl.inputs
      .map((m) => toMaterial(m, nameToObject))
      .filter((m): m is ProcessMaterial => m !== null)
    const outputs = tpl.outputs
      .map((m) => toMaterial(m, nameToObject))
      .filter((m): m is ProcessMaterial => m !== null)
    // A process needs at least one input and one output; otherwise skip it.
    if (inputs.length === 0 || outputs.length === 0) return null
    return {
      name: tpl.name,
      type: tpl.type,
      description: tpl.description,
      properties: (tpl.properties ?? []).map((p) => ({
        key: slugifyKey(p.label),
        label: p.label,
        values: [p.value],
      })),
      inputs,
      outputs,
    }
  }

  const seed = async (): Promise<SeedResult> => {
    setIsSeeding(true)
    try {
      // Resolve every referenced object name once.
      const names = Array.from(
        new Set(
          PROCESS_SEED_TEMPLATES.flatMap((t) =>
            [...t.inputs, ...t.outputs].map((m) => m.objectName)
          )
        )
      )
      const nameToObject = new Map<string, { uuid: string; name: string }>()
      const unresolved: string[] = []
      for (const name of names) {
        const obj = await resolveObject(name)
        if (obj) nameToObject.set(name.toLowerCase(), obj)
        else unresolved.push(name)
      }

      let created = 0
      let skipped = 0
      for (const tpl of PROCESS_SEED_TEMPLATES) {
        const model = toModel(tpl, nameToObject)
        if (!model) {
          skipped++
          logger.warn(
            `Seed: skipped "${tpl.name}" (missing input/output object)`
          )
          continue
        }
        await createProcess.mutateAsync(model)
        created++
      }
      return { created, skipped, unresolved }
    } finally {
      setIsSeeding(false)
    }
  }

  return { seed, isSeeding }
}
