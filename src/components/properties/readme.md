# Properties System

The properties system handles property display, editing, formula evaluation, and file attachments for objects. It's used in three contexts: **object details** (display + edit), **object creation** (form), and **model templates** (form without formulas/files).

## Architecture

```
PropertyItem ← core UI (display + edit)
├── PropertyValueItem ← per-value row (text input or formula editor)
├── FormulaEditor ← expression editing, variable mapping, templates
├── FormulaDisplay ← read-only formula result
├── FormulaPicker ← combobox to select saved formulas
└── ValueModeToggle ← text ↔ formula toggle

usePropertyEditor ← single source of truth for property state
├── usePropertyManagement ← low-level API calls (CRUD + formula calcs)
└── change-detection utils ← track what changed vs. initial data
```

## Components

| File                          | Purpose                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `property-item.tsx`           | Core component for one property. Handles collapsed summary, expanded display, and expanded edit mode. Accepts `children` for extra content (e.g. file attach modals). |
| `property-item-rhf.tsx`       | React Hook Form adapter. Bridges RHF `useWatch`/`setValue` to `PropertyItem` callbacks. Manages file attachment modals for create flow.                               |
| `property-section-editor.tsx` | Thin render loop over `editor.properties` → `PropertyItem` + "Add Property" button. Used in the properties tab edit mode.                                             |
| `property-grid-view.tsx`      | Read-only 2-column grid display of properties (passport view).                                                                                                        |
| `formula-editor.tsx`          | Interactive formula editor: expression input, variable detection (jsep), variable-to-property mapping via Select dropdowns, live evaluation, quick templates.         |
| `formula-display.tsx`         | Read-only formula result with expandable details (expression, resolved, mappings).                                                                                    |
| `formula-picker.tsx`          | Combobox/popover for selecting from saved MathFormulas (from API).                                                                                                    |
| `value-mode-toggle.tsx`       | Two icon buttons to switch between text mode (T) and formula mode (fx).                                                                                               |

## Hooks

| File                               | Purpose                                                                                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-property-editor.ts`     | **Main state hook.** Manages: properties array, expanded state, change tracking, all mutations (add/remove/update), batch and per-property saving, available properties for formula mapping, reset. Single source of truth — consumers use methods, not raw state setters. |
| `hooks/use-property-management.ts` | Low-level API mutations: `createPropertyForObject`, `updatePropertyWithValues`, `removePropertyFromObject`, `createFormulaCalcForValue`, `deleteFormulaCalcForValue`. Wraps SDK calls with React Query invalidation.                                                       |
| `hooks/use-formula-evaluation.ts`  | Formula parsing and evaluation. Manages expression text, variable detection, variable mapping state, resolved values, and live evaluation result. Uses jsep for safe AST parsing.                                                                                          |

## Utilities

| File                          | Purpose                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/change-detection.ts`   | `hasPropertyChanged()` and `getChangedProperties()` — compares edited properties against originals using `_modified`, `_deleted`, `_isNew` flags and deep value comparison.                                            |
| `utils/composite-id.ts`       | Composite IDs (`propertyId::valueIndex`) for unique identification of property values in formula variable mapping. Supports both UUID-based (edit) and index-based (create) formats.                                   |
| `utils/formula-evaluation.ts` | Pure functions: `extractVariables()` (jsep AST), `evaluateAst()` (recursive evaluator), `safeEvaluate()`. Whitelisted math functions (abs, ceil, floor, round, sqrt, pow, min, max, log, log10) and constants (PI, E). |
| `utils/formula-mapping.ts`    | Converts between formula data and API payloads: `mapFormulaToAggregatePayload` (create), `mapAggregateResponseToFormulaData` (response), `mapFormulaToStandaloneCalc` (edit). Handles UUID resolution across flows.    |

## Types (`types.ts`)

- **`Property`** — `uuid`, `key`, `label`, `values[]`, `files[]`, internal flags (`_isNew`, `_deleted`, `_modified`, `_tempId`)
- **`PropertyValue`** — `uuid`, `value`, `formulaData`, `files[]`, `_needsInput`
- **`FormulaData`** — `formula`, `formulaUuid`, `formulaName`, `variableMapping`, `result`, `resolvedExpression`, `isValid`, `calcUuid`

## Data Flow

### Display mode (object details sheet)

```
useObjectData → initialProperties → usePropertyEditor → properties
                                                        ↓
PropertiesTab → PropertyItem (display-only, no edit callbacks)
```

### Edit mode (object details sheet)

```
usePropertyEditor.properties → PropertySectionEditor → PropertyItem (with edit callbacks)
                                                        ↓
user edits → updatePropertyName/Value/ValueFormula → saveProperties() → API
```

### Create mode (object add sheet)

```
React Hook Form → PropertyItemRHF → PropertyItem (with edit callbacks + file children)
                   ↓
                   useFieldArray for values, setValue for mutations
                   AttachmentModal for file attachments (inline Paperclip icons)
```

## Key Design Decisions

- **Single source of truth**: `usePropertyEditor` owns all property state. No external `setEditedProperties`. All mutations go through its methods.
- **Stable reference protection**: Uses `useRef`-based JSON deep comparison on `initialProperties` to prevent infinite re-render loops from unstable array references.
- **ID-based operations**: All mutations use `propertyId` (uuid or tempId), not array indices.
- **Children slot**: `PropertyItem` accepts `children` rendered inside the expanded card — used by `PropertyItemRHF` to inject file attachment modals.
- **Formula safety**: jsep for parsing (no eval), whitelisted functions only, rejects assignments.
