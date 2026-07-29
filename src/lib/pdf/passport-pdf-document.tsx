/**
 * Product Passport — @react-pdf/renderer document.
 *
 * This file must NOT be `'use client'`. It runs only in the Node route handler.
 * All styling uses inline style objects (no Tailwind — @react-pdf has its own
 * flex/text engine). Colors are locked to light-mode values; update PDF_COLORS
 * if the design palette changes.
 */

/* eslint-disable react-hooks/purity --
 * `react-hooks/purity` forbids reading the clock during render because a
 * re-render would produce different output. There are no re-renders here: this
 * tree is handed to @react-pdf's `renderToBuffer` once, in a route handler, and
 * the buffer is returned. Nothing hydrates and nothing holds state, so
 * `Date.now()` is the correct way to stamp "age at time of generation".
 * A hook-based timestamp would be wrong — this is not a React DOM component.
 */

import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

// Read Inter .woff files from node_modules at module load time and embed as
// base64 data URIs. We avoid `require.resolve` because Turbopack rewrites it
// for externalized packages, returning an internal marker token instead of a
// real filesystem path. `process.cwd()/node_modules/@fontsource/inter` is a
// stable pnpm symlink that fs.readFileSync follows transparently.
const FONT_DIR = path.join(
  process.cwd(),
  'node_modules/@fontsource/inter/files'
)
const interDataUri = (weight: 400 | 500 | 600 | 700) => {
  const file = path.join(FONT_DIR, `inter-latin-${weight}-normal.woff`)
  const data = fs.readFileSync(file)
  return `data:font/woff;base64,${data.toString('base64')}`
}

import {
  computeDateProgress,
  findValueByKey,
  groupPropertiesByCategory,
  isImageFile,
  parseDateValue,
  type NormalizedProperty,
  type PassportFile,
} from '@/components/object-sheets/passport/utils/passport-utils'
import {
  getStatusBadgeClasses,
  isUrlValue,
  resolveColorSwatch,
  urlLinkLabel,
} from '@/components/object-sheets/passport/utils/passport-formatters'
import { formatDate } from '@/components/object-sheets/passport/utils/format-date'
import type { PassportAddressInfo } from './passport-types'
import {
  CalendarIcon,
  CATEGORY_ICONS,
  CircleCheckIcon,
  FileTextIcon,
  HourglassIcon,
  IdCardIcon,
  ImageIcon,
  MapPinIcon,
  PackageIcon,
  WrenchIcon,
} from './pdf-icons'

// ---------------------------------------------------------------------------
// Font registration — Inter, matching the on-screen passport sheet
// (`next/font/google` Inter). @fontsource/inter ships .woff/.woff2 only;
// fontkit (used by @react-pdf) supports both, so we don't need .ttf.

Font.register({
  family: 'Inter',
  fonts: [
    { src: interDataUri(400), fontWeight: 400 },
    { src: interDataUri(500), fontWeight: 500 },
    { src: interDataUri(600), fontWeight: 600 },
    { src: interDataUri(700), fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback((word) => [word])

// ---------------------------------------------------------------------------
// Design tokens (light-mode, CSS-variable equivalents)

const C = {
  primary: '#2563eb',
  primaryBg: '#eff6ff',
  primaryLight: '#dbeafe',
  muted: '#6b7280',
  border: '#d1d5db',
  bg: '#ffffff',
  text: '#111827',
  emerald: '#10b981',
  amber: '#d97706',
  red: '#dc2626',
  emeraldBg: '#d1fae5',
  amberBg: '#fef3c7',
  redBg: '#fee2e2',
  emeraldText: '#065f46',
  amberText: '#92400e',
  redText: '#991b1b',
  grayBg: '#f3f4f6',
}

// ---------------------------------------------------------------------------
// Shared styles

const S = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bg,
    padding: 28,
    lineHeight: 1.4,
  },
  // Card shell — borderRadius 8 matches shadcn `rounded-lg` used by Card
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 8,
    backgroundColor: C.bg,
    marginBottom: 6,
    overflow: 'hidden',
  },
  // Header padding matches sheet `py-3 px-3` = 12px / 12px
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardHeaderLabel: {
    fontSize: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.muted,
    lineHeight: 1,
  },
  // Content padding matches sheet `px-3 pb-3` = 12px / 12px
  cardContent: {
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 12,
  },
  // Badge pill — asymmetric vertical padding compensates for Inter's
  // cap-height sitting in the upper half of the em box, so all-caps text
  // ("WF", "A+", "Operational") visually centers within the pill.
  badge: {
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingTop: 1,
    paddingBottom: 2,
    borderWidth: 0.5,
    borderColor: C.border,
    borderStyle: 'solid',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  col: { flexDirection: 'column' },
})

// ---------------------------------------------------------------------------
// Helper: map a status value → badge background / text color

function statusColors(value: string): {
  bg: string
  text: string
  border: string
} {
  const classes = getStatusBadgeClasses(value)
  if (classes.includes('emerald'))
    return { bg: C.emeraldBg, text: C.emeraldText, border: C.emerald }
  if (classes.includes('amber'))
    return { bg: C.amberBg, text: C.amberText, border: C.amber }
  if (classes.includes('red'))
    return { bg: C.redBg, text: C.redText, border: C.red }
  return { bg: C.primaryBg, text: C.primary, border: C.primary }
}

// ---------------------------------------------------------------------------
// Translations — static strings, no useTranslations hook needed server-side

const TRANSLATIONS: Record<'en' | 'nl', Record<string, string>> = {
  en: {
    lifecycle: 'Lifecycle',
    warranty: 'Warranty',
    active: 'Active',
    expired: 'Expired',
    inService: 'In service',
    produced: 'Produced',
    lastInspection: 'Last inspection',
    nextMaintenance: 'Next maintenance',
    expectedLifespan: 'Expected lifespan',
    documents: 'Documents',
    location: 'Location',
    untitled: 'Untitled object',
    'cat.product': 'Product',
    'cat.classification': 'Classification',
    'cat.dimensions': 'Dimensions',
    'cat.composition': 'Composition',
    'cat.appearance': 'Appearance',
    'cat.sustainability': 'Sustainability',
    'cat.commerce': 'Commerce',
    'cat.ownership': 'Ownership',
    'cat.state': 'Status',
    'cat.contact': 'Contact',
    'cat.location': 'Location',
    'cat.meta': 'Other',
    'cat.other': 'Other',
  },
  nl: {
    lifecycle: 'Levenscyclus',
    warranty: 'Garantie',
    active: 'Actief',
    expired: 'Verlopen',
    inService: 'In gebruik',
    produced: 'Geproduceerd',
    lastInspection: 'Laatste inspectie',
    nextMaintenance: 'Volgend onderhoud',
    expectedLifespan: 'Verwachte levensduur',
    documents: 'Documenten',
    location: 'Locatie',
    untitled: 'Naamloos object',
    'cat.product': 'Product',
    'cat.classification': 'Classificatie',
    'cat.dimensions': 'Afmetingen',
    'cat.composition': 'Samenstelling',
    'cat.appearance': 'Uiterlijk',
    'cat.sustainability': 'Duurzaamheid',
    'cat.commerce': 'Handel',
    'cat.ownership': 'Eigendom',
    'cat.state': 'Status',
    'cat.contact': 'Contact',
    'cat.location': 'Locatie',
    'cat.meta': 'Overig',
    'cat.other': 'Overig',
  },
}

function formatDurationPdf(days: number, locale: 'en' | 'nl'): string {
  if (days < 60) return locale === 'nl' ? `${days} dagen` : `${days} days`
  if (days < 730) {
    const m = Math.round(days / 30)
    return locale === 'nl' ? `${m} maanden` : `${m} months`
  }
  const y = Math.round(days / 365)
  return locale === 'nl' ? `${y} jaar` : `${y} years`
}

// ---------------------------------------------------------------------------
// Hero section

interface HeroProps {
  object: {
    uuid: string
    name: string
    abbreviation: string
    description: string
  }
  properties: NormalizedProperty[]
  qrDataUrl: string
  locale: 'en' | 'nl'
}

function PdfHero({ object, properties, qrDataUrl, locale }: HeroProps) {
  const t = TRANSLATIONS[locale]
  const manufacturer = findValueByKey(properties, 'manufacturer')
  const model = findValueByKey(properties, 'model')
  const serial = findValueByKey(properties, 'serial-number')
  const status = findValueByKey(properties, 'status')
  const category = findValueByKey(properties, 'category')
  const subtitle = [manufacturer, model].filter(Boolean).join(' · ')
  const sc = status ? statusColors(status) : null

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 6,
        marginBottom: 6,
      }}
    >
      {/* Hero card */}
      <View
        style={[
          S.card,
          {
            flex: 1,
            marginBottom: 0,
            backgroundColor: C.primaryBg,
            padding: 12,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'flex-start',
          },
        ]}
      >
        {/* Icon badge */}
        <View
          style={{
            backgroundColor: C.primaryLight,
            borderRadius: 4,
            padding: 5,
            flexShrink: 0,
          }}
        >
          <IdCardIcon size={14} color={C.primary} />
        </View>

        {/* Name + badges (badges below title for breathing room) */}
        <View style={{ flex: 1, flexDirection: 'column', gap: 5 }}>
          <Text
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: C.text,
            }}
          >
            {object.name || t.untitled}
          </Text>
          {(object.abbreviation || status || category) && (
            <View style={[S.row, { flexWrap: 'wrap', gap: 4 }]}>
              {object.abbreviation && (
                <View
                  style={[
                    S.badge,
                    { backgroundColor: C.grayBg, borderColor: C.border },
                  ]}
                >
                  <Text style={{ fontSize: 7, color: C.text, lineHeight: 1 }}>
                    {object.abbreviation}
                  </Text>
                </View>
              )}
              {status && sc && (
                <View
                  style={[
                    S.badge,
                    { backgroundColor: sc.bg, borderColor: sc.border },
                  ]}
                >
                  <Text style={{ fontSize: 7, color: sc.text, lineHeight: 1 }}>
                    {status}
                  </Text>
                </View>
              )}
              {category && (
                <View
                  style={[
                    S.badge,
                    { backgroundColor: C.bg, borderColor: C.border },
                  ]}
                >
                  <Text style={{ fontSize: 7, color: C.muted, lineHeight: 1 }}>
                    {category}
                  </Text>
                </View>
              )}
            </View>
          )}

          {(subtitle || serial) && (
            <Text style={{ fontSize: 8, color: C.muted }}>
              {[subtitle, serial ? `SN ${serial}` : '']
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          {object.description && (
            <Text style={{ fontSize: 8, color: C.muted }}>
              {object.description}
            </Text>
          )}
        </View>
      </View>

      {/* QR code card */}
      {qrDataUrl && (
        <View
          style={[
            S.card,
            {
              marginBottom: 0,
              padding: 6,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <Image src={qrDataUrl} style={{ width: 96, height: 96 }} />
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Lifecycle ribbon

interface LifecycleProps {
  properties: NormalizedProperty[]
  locale: 'en' | 'nl'
}

function PdfLifecycle({ properties, locale }: LifecycleProps) {
  const t = TRANSLATIONS[locale]

  const productionDate = parseDateValue(
    findValueByKey(properties, 'production-date')
  )
  const installationDate = parseDateValue(
    findValueByKey(properties, 'installation-date')
  )
  const warrantyEnd = parseDateValue(findValueByKey(properties, 'warranty-end'))
  const lastInspection = parseDateValue(
    findValueByKey(properties, 'last-inspection')
  )
  const nextMaintenance = parseDateValue(
    findValueByKey(properties, 'next-maintenance')
  )
  const lifespanYears = findValueByKey(properties, 'lifespan-years') || null

  const warrantyAnchor = productionDate ?? installationDate
  const warrantyProgress = computeDateProgress(warrantyAnchor, warrantyEnd)

  const ageAnchor = installationDate ?? productionDate
  const ageDays = ageAnchor
    ? Math.max(0, Math.round((Date.now() - ageAnchor.getTime()) / 86400000))
    : null

  const hasAny = Boolean(
    productionDate ||
    installationDate ||
    warrantyEnd ||
    lastInspection ||
    nextMaintenance ||
    lifespanYears
  )

  if (!hasAny) return null

  const today = Date.now()
  const isMaintenanceOverdue =
    !!nextMaintenance && nextMaintenance.getTime() < today

  // Progress bar color
  let barColor = C.primary
  if (warrantyProgress?.isOverdue) barColor = C.red
  else if ((warrantyProgress?.percent ?? 0) >= 90) barColor = C.amber

  // Warranty badge
  let warrantyBadgeBg = C.emeraldBg
  let warrantyBadgeText = C.emeraldText
  let warrantyBadgeLabel = t.active
  if (warrantyProgress?.isOverdue) {
    warrantyBadgeBg = C.redBg
    warrantyBadgeText = C.redText
    warrantyBadgeLabel = t.expired
  } else if ((warrantyProgress?.percent ?? 0) >= 90) {
    warrantyBadgeBg = C.amberBg
    warrantyBadgeText = C.amberText
    warrantyBadgeLabel =
      locale === 'nl'
        ? `Verloopt over ${warrantyProgress!.daysRemaining} dagen`
        : `Expires in ${warrantyProgress!.daysRemaining} days`
  }

  const statItems: Array<{
    icon: React.ReactElement
    label: string
    value: string
    warn?: boolean
  }> = []

  if (ageDays !== null)
    statItems.push({
      icon: <CalendarIcon size={9} color={C.primary} />,
      label: t.inService,
      value: formatDurationPdf(ageDays, locale),
    })
  if (productionDate)
    statItems.push({
      icon: <PackageIcon size={9} color={C.muted} />,
      label: t.produced,
      value: formatDate(productionDate, locale),
    })
  if (lastInspection)
    statItems.push({
      icon: <CircleCheckIcon size={9} color={C.muted} />,
      label: t.lastInspection,
      value: formatDate(lastInspection, locale),
    })
  if (nextMaintenance)
    statItems.push({
      icon: (
        <WrenchIcon size={9} color={isMaintenanceOverdue ? C.amber : C.muted} />
      ),
      label: t.nextMaintenance,
      value: formatDate(nextMaintenance, locale),
      warn: isMaintenanceOverdue,
    })
  if (lifespanYears)
    statItems.push({
      icon: <HourglassIcon size={9} color={C.muted} />,
      label: t.expectedLifespan,
      value: formatDurationPdf(Number(lifespanYears) * 365 || 0, locale),
    })

  return (
    <View style={S.card} wrap={false}>
      {/* Lifecycle has no S.cardHeader — its title sits inline with the
          warranty badge — so we restore top padding here that was zeroed
          out for category cards. */}
      <View style={[S.cardContent, { paddingTop: 12 }]}>
        {/* Header row */}
        <View style={[S.row, { marginBottom: warrantyProgress ? 5 : 4 }]}>
          <CalendarIcon size={10} color={C.primary} />
          <Text style={{ fontWeight: 600, fontSize: 9 }}>{t.lifecycle}</Text>
          {warrantyProgress && (
            <>
              <Text style={{ color: C.border, fontSize: 9 }}>·</Text>
              <Text style={{ color: C.muted, fontSize: 9 }}>{t.warranty}</Text>
              <View style={{ flex: 1 }} />
              <View
                style={[
                  S.badge,
                  { backgroundColor: warrantyBadgeBg, borderWidth: 0 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 7,
                    color: warrantyBadgeText,
                    lineHeight: 1,
                  }}
                >
                  {warrantyBadgeLabel}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Progress bar */}
        {warrantyProgress && (
          <>
            <View
              style={{
                height: 5,
                backgroundColor: C.grayBg,
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 3,
              }}
            >
              <View
                style={{
                  height: 5,
                  width: `${warrantyProgress.percent}%`,
                  backgroundColor: barColor,
                  borderRadius: 3,
                }}
              />
            </View>
            <View
              style={[
                S.row,
                { justifyContent: 'space-between', marginBottom: 6 },
              ]}
            >
              <Text style={{ fontSize: 7, color: C.muted }}>
                {formatDate(warrantyProgress.from, locale)}
              </Text>
              <Text style={{ fontSize: 7, color: C.muted }}>
                {warrantyProgress.percent}%{' '}
                {locale === 'nl' ? 'verstreken' : 'elapsed'}
              </Text>
              <Text style={{ fontSize: 7, color: C.muted }}>
                {formatDate(warrantyProgress.to, locale)}
              </Text>
            </View>
          </>
        )}

        {/* Stat grid — 2-column */}
        {statItems.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {statItems.map((item, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  minWidth: '45%',
                  backgroundColor: C.grayBg,
                  borderRadius: 3,
                  padding: 5,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 4,
                }}
              >
                {item.icon}
                <View>
                  <Text
                    style={{
                      fontSize: 7,
                      color: C.muted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontWeight: 600,
                      fontSize: 9,
                      color: item.warn ? C.amber : C.text,
                    }}
                  >
                    {item.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Category cards grid

interface CategoriesProps {
  properties: NormalizedProperty[]
  locale: 'en' | 'nl'
}

function PdfCategoriesGrid({ properties, locale }: CategoriesProps) {
  const t = TRANSLATIONS[locale]
  const groups = groupPropertiesByCategory(properties, locale)

  if (groups.length === 0) return null

  // Split into two columns for visual balance
  const left: typeof groups = []
  const right: typeof groups = []
  groups.forEach((g, i) => (i % 2 === 0 ? left : right).push(g))

  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 0 }}>
      <View style={{ flex: 1, gap: 6 }}>
        {left.map((group) => (
          <PdfCategoryCard key={group.category} group={group} t={t} />
        ))}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {right.map((group) => (
          <PdfCategoryCard key={group.category} group={group} t={t} />
        ))}
      </View>
    </View>
  )
}

interface CategoryCardProps {
  group: ReturnType<typeof groupPropertiesByCategory>[number]
  t: Record<string, string>
}

// Mirrors ENERGY_LABEL_PALETTE from passport-formatters.ts (Tailwind → hex)
const ENERGY_LABEL_PDF: Record<string, { bg: string; text: string }> = {
  'A+++': { bg: '#059669', text: '#ffffff' },
  'A++': { bg: '#10b981', text: '#ffffff' },
  'A+': { bg: '#10b981', text: '#ffffff' },
  A: { bg: '#22c55e', text: '#ffffff' },
  B: { bg: '#a3e635', text: '#1a2e05' },
  C: { bg: '#fde047', text: '#713f12' },
  D: { bg: '#fbbf24', text: '#451a03' },
  E: { bg: '#fb923c', text: '#431407' },
  F: { bg: '#ef4444', text: '#ffffff' },
  G: { bg: '#b91c1c', text: '#ffffff' },
}

function energyLabelColors(value: string): { bg: string; text: string } | null {
  return ENERGY_LABEL_PDF[value.trim().toUpperCase()] ?? null
}

function toAbsoluteUrl(value: string): string {
  const v = value.trim()
  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v
  return `https://${v}`
}

function PdfCategoryCard({ group, t }: CategoryCardProps) {
  const IconComponent = CATEGORY_ICONS[group.category] ?? FileTextIcon
  const categoryLabel = t[`cat.${group.category}`] ?? group.category

  return (
    <View style={S.card} wrap={false}>
      <View style={S.cardHeader}>
        <IconComponent size={10} color={C.primary} />
        <Text style={S.cardHeaderLabel}>{categoryLabel}</Text>
      </View>
      <View style={S.cardContent}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {group.entries.map(({ property, displayLabel, displayValue }) => {
            const isColor =
              property.key === 'color' || property.key === 'colour'
            const isEnergyLabel = property.key === 'energy-label'
            const isUrl = isUrlValue(property.key, displayValue)
            const isLong = displayValue.length > 18 || isUrl || isColor
            const swatch = isColor ? resolveColorSwatch(displayValue) : null
            const elColors = isEnergyLabel
              ? energyLabelColors(displayValue)
              : null

            return (
              <View
                key={property.uuid ?? property.key}
                style={{ width: isLong ? '100%' : '48%', marginBottom: 2 }}
              >
                <Text
                  style={{
                    fontSize: 7,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    color: C.muted,
                    marginBottom: 1,
                  }}
                >
                  {displayLabel}
                </Text>
                <View style={S.row}>
                  {swatch && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: swatch,
                        borderWidth: 0.5,
                        borderColor: C.border,
                        borderStyle: 'solid',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {elColors ? (
                    <View
                      style={[
                        S.badge,
                        { backgroundColor: elColors.bg, borderWidth: 0 },
                      ]}
                    >
                      <Text
                        style={{
                          fontWeight: 700,
                          fontSize: 7,
                          color: elColors.text,
                          lineHeight: 1,
                        }}
                      >
                        {displayValue}
                      </Text>
                    </View>
                  ) : isUrl ? (
                    <Link src={toAbsoluteUrl(displayValue)}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: C.primary,
                        }}
                      >
                        {urlLinkLabel(displayValue)}
                      </Text>
                    </Link>
                  ) : (
                    <Text
                      style={{
                        fontWeight: 500,
                        fontSize: 9,
                        color: C.text,
                      }}
                    >
                      {displayValue}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Address card

interface AddressProps {
  addressInfo: PassportAddressInfo
  locale: 'en' | 'nl'
}

function PdfAddressCard({ addressInfo, locale }: AddressProps) {
  const t = TRANSLATIONS[locale]

  const lines = [
    [addressInfo.street, addressInfo.houseNumber].filter(Boolean).join(' '),
    [addressInfo.postalCode, addressInfo.city].filter(Boolean).join(' '),
    addressInfo.country,
  ].filter((s): s is string => !!s && s.trim().length > 0)

  if (lines.length === 0 && !addressInfo.fullAddress) return null

  return (
    <View style={S.card} wrap={false}>
      <View style={S.cardHeader}>
        <MapPinIcon size={10} color={C.primary} />
        <Text style={S.cardHeaderLabel}>{t.location}</Text>
      </View>
      <View style={S.cardContent}>
        {addressInfo.fullAddress ? (
          <Text style={{ fontSize: 9, color: C.text }}>
            {addressInfo.fullAddress}
          </Text>
        ) : (
          lines.map((line, i) => (
            <Text key={i} style={{ fontSize: 9, color: C.text }}>
              {line}
            </Text>
          ))
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Documents list

interface DocumentsProps {
  files: PassportFile[]
  locale: 'en' | 'nl'
}

function PdfDocumentsList({ files, locale }: DocumentsProps) {
  const t = TRANSLATIONS[locale]
  const live = (files ?? []).filter((f) => !f.softDeleted)
  if (live.length === 0) return null

  const images = live.filter(isImageFile)
  const docs = live.filter((f) => !isImageFile(f))

  return (
    <View style={S.card} wrap={false}>
      <View style={S.cardHeader}>
        <FileTextIcon size={10} color={C.primary} />
        <Text style={S.cardHeaderLabel}>
          {t.documents} ({live.length})
        </Text>
      </View>
      <View style={S.cardContent}>
        {images.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 4,
              marginBottom: 4,
            }}
          >
            {images.slice(0, 6).map((file) => (
              <View
                key={file.uuid ?? file.fileName}
                style={[
                  S.row,
                  {
                    backgroundColor: C.grayBg,
                    borderRadius: 3,
                    paddingHorizontal: 5,
                    paddingVertical: 3,
                    border: `0.5pt solid ${C.border}`,
                  },
                ]}
              >
                <ImageIcon size={8} color={C.muted} />
                <Text style={{ fontSize: 8, color: C.muted }}>
                  {(file.fileName ?? '').slice(0, 28)}
                </Text>
              </View>
            ))}
            {images.length > 6 && (
              <Text style={{ fontSize: 8, color: C.muted }}>
                +{images.length - 6}
              </Text>
            )}
          </View>
        )}
        {docs.map((file) => (
          <View
            key={file.uuid ?? file.fileName}
            style={[S.row, { marginBottom: 3 }]}
          >
            <FileTextIcon size={8} color={C.muted} />
            <Text style={{ fontSize: 8, color: C.muted }}>
              {(file.fileName ?? '').slice(0, 60)}
            </Text>
          </View>
        ))}
        {docs.length > 8 && (
          <Text style={{ fontSize: 8, color: C.muted }}>
            +{docs.length - 8}
          </Text>
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Root document export

export interface PassportPdfDocumentProps {
  object: {
    uuid: string
    name: string
    abbreviation: string
    description: string
  }
  properties: NormalizedProperty[]
  files: PassportFile[]
  addressInfo: PassportAddressInfo | null
  qrDataUrl: string
  locale: 'en' | 'nl'
}

export function PassportPdfDocument({
  object,
  properties,
  files,
  addressInfo,
  qrDataUrl,
  locale,
}: PassportPdfDocumentProps) {
  return (
    <Document
      title={object.name || 'Passport'}
      author="Internet of Materials"
      subject="Product Passport"
    >
      <Page size="A4" style={S.page}>
        <PdfHero
          object={object}
          properties={properties}
          qrDataUrl={qrDataUrl}
          locale={locale}
        />
        <PdfLifecycle properties={properties} locale={locale} />
        <PdfCategoriesGrid properties={properties} locale={locale} />
        {addressInfo && (
          <PdfAddressCard addressInfo={addressInfo} locale={locale} />
        )}
        <PdfDocumentsList files={files} locale={locale} />
      </Page>
    </Document>
  )
}
