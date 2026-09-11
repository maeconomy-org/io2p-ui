// The app's write model. `draft` owns EntityDraft and the diff/upload machinery; the other three
// are per-kind specialisations built on it, which is why they share one entry point.
export * from './draft'
export * from './process'
export * from './template'
export * from './duplicate'
