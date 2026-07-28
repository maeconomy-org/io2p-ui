// Domain types come straight from `io2p-client`; only this id alias needs a local home
// (io2p-core ids are plain server-minted UUIDv7 strings).
export type UUID = string

export * from './files'
export * from './sankey'
export * from './object'
