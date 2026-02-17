export interface FormulaTemplate {
  label: string
  formula: string
  description: string
  category: 'basic' | 'statistics' | 'geometry' | 'conversion' | 'finance'
}

/**
 * Formula templates for common calculations.
 * In the future these can be fetched from an API.
 */
export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  // Basic
  {
    label: 'Sum',
    formula: 'x + y',
    description: 'Add two values',
    category: 'basic',
  },
  {
    label: 'Difference',
    formula: 'x - y',
    description: 'Subtract y from x',
    category: 'basic',
  },
  {
    label: 'Product',
    formula: 'x * y',
    description: 'Multiply two values',
    category: 'basic',
  },
  {
    label: 'Ratio',
    formula: 'x / y',
    description: 'Ratio of x to y',
    category: 'basic',
  },
  {
    label: 'Square Root',
    formula: 'sqrt(x)',
    description: 'Square root of x',
    category: 'basic',
  },
  {
    label: 'Power',
    formula: 'pow(x, y)',
    description: 'x raised to the power of y',
    category: 'basic',
  },
  {
    label: 'Absolute Value',
    formula: 'abs(x)',
    description: 'Absolute value of x',
    category: 'basic',
  },
  {
    label: 'Modulo',
    formula: 'x % y',
    description: 'Remainder of x / y',
    category: 'basic',
  },

  // Statistics
  {
    label: 'Average (2)',
    formula: '(x + y) / 2',
    description: 'Average of two values',
    category: 'statistics',
  },
  {
    label: 'Average (3)',
    formula: '(a + b + c) / 3',
    description: 'Average of three values',
    category: 'statistics',
  },
  {
    label: 'Weighted Sum',
    formula: 'x * 0.6 + y * 0.4',
    description: 'Weighted sum (60/40)',
    category: 'statistics',
  },
  {
    label: 'Min / Max',
    formula: 'min(x, y)',
    description: 'Minimum of two values',
    category: 'statistics',
  },
  {
    label: 'Clamp',
    formula: 'max(lo, min(x, hi))',
    description: 'Clamp x between lo and hi',
    category: 'statistics',
  },
  {
    label: 'Variance (2)',
    formula: 'pow(x - (x + y) / 2, 2) + pow(y - (x + y) / 2, 2)',
    description: 'Sum of squared deviations from mean',
    category: 'statistics',
  },

  // Geometry
  {
    label: 'Area (Rectangle)',
    formula: 'w * h',
    description: 'Width × Height',
    category: 'geometry',
  },
  {
    label: 'Area (Circle)',
    formula: 'PI * pow(r, 2)',
    description: 'π × r²',
    category: 'geometry',
  },
  {
    label: 'Volume (Box)',
    formula: 'l * w * h',
    description: 'Length × Width × Height',
    category: 'geometry',
  },
  {
    label: 'Hypotenuse',
    formula: 'sqrt(pow(a, 2) + pow(b, 2))',
    description: 'Pythagorean theorem: √(a² + b²)',
    category: 'geometry',
  },
  {
    label: 'Perimeter (Rect)',
    formula: '2 * (w + h)',
    description: '2 × (Width + Height)',
    category: 'geometry',
  },

  // Conversion
  {
    label: 'Percentage',
    formula: '(x / y) * 100',
    description: 'x as percentage of y',
    category: 'conversion',
  },
  {
    label: 'Markup',
    formula: 'x * (1 + y / 100)',
    description: 'Apply y% markup to x',
    category: 'conversion',
  },
  {
    label: 'Discount',
    formula: 'x * (1 - y / 100)',
    description: 'Apply y% discount to x',
    category: 'conversion',
  },
  {
    label: 'Unit Conversion',
    formula: 'x * factor',
    description: 'Convert x by a factor',
    category: 'conversion',
  },

  // Finance
  {
    label: 'Margin',
    formula: '(price - cost) / price * 100',
    description: 'Profit margin percentage',
    category: 'finance',
  },
  {
    label: 'Compound Interest',
    formula: 'principal * pow(1 + rate / 100, years)',
    description: 'A = P × (1 + r)^t',
    category: 'finance',
  },
  {
    label: 'ROI',
    formula: '(gain - cost) / cost * 100',
    description: 'Return on investment %',
    category: 'finance',
  },
  {
    label: 'Break-Even',
    formula: 'fixed / (price - variable)',
    description: 'Break-even quantity',
    category: 'finance',
  },
]
