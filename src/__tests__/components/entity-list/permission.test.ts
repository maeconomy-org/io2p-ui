import { describe, it, expect } from 'vitest'

import {
  canDelete,
  canEdit,
  canReshare,
  canViewGrants,
  canRestore,
  permissionOf,
} from '@/components/entity-list/permission'

describe('the permission ladder', () => {
  it('lets a read-only viewer do nothing but look', () => {
    expect(canEdit('read')).toBe(false)
    expect(canReshare('read')).toBe(false)
    expect(canDelete('read')).toBe(false)
    expect(canRestore('read')).toBe(false)
  })

  it('lets a write grantee edit, but not share or delete', () => {
    expect(canEdit('write')).toBe(true)
    expect(canReshare('write')).toBe(false)
    expect(canDelete('write')).toBe(false)
  })

  it('lets a share grantee edit and reshare, but not delete', () => {
    expect(canEdit('share')).toBe(true)
    expect(canReshare('share')).toBe(true)
    expect(canDelete('share')).toBe(false)
  })

  it('reserves delete and restore for admin, which is not implied by write', () => {
    expect(canDelete('admin')).toBe(true)
    expect(canRestore('admin')).toBe(true)
    // The route guard on DELETE is `admin`; treating it as a write would offer the control to
    // every write grantee and 403 each one.
    expect(canDelete('write')).toBe(false)
    expect(canRestore('write')).toBe(false)
  })

  it('offers everything when the node sent no verdict', () => {
    // A node predating the field omits it. Hiding the controls then would read as a total
    // regression on the viewer's OWN rows; the node still refuses anything they may not do.
    expect(canEdit(undefined)).toBe(true)
    expect(canDelete(undefined)).toBe(true)
  })
})

describe('permissionOf', () => {
  it('prefers the verdict from the node over any local guess', () => {
    expect(permissionOf({ permission: 'read', createdBy: 'me' }, 'me')).toBe(
      'read'
    )
  })

  it('treats the author as admin, since author is owner here', () => {
    expect(permissionOf({ createdBy: 'me' }, 'me')).toBe('admin')
  })

  it('says nothing about a row it cannot place', () => {
    expect(permissionOf({ createdBy: 'them' }, 'me')).toBeUndefined()
    expect(permissionOf({ createdBy: 'me' }, undefined)).toBeUndefined()
  })

  it('composes with the ladder so an owner keeps every control', () => {
    const mine = permissionOf({ createdBy: 'me' }, 'me')
    expect(canDelete(mine)).toBe(true)
    expect(canReshare(mine)).toBe(true)
  })
})

/**
 * Reading WHO ELSE can reach a resource is the strictest of the node's three sharing bars:
 * granting needs `share`, reading the grant list needs `admin`, revoking needs `admin` or having
 * granted it yourself. The sheet used to gate the list on `createdBy === userId`, which refused an
 * `admin` grantee something the node would have answered, and promised a `share` grantee a list
 * they could never get.
 */
describe('canViewGrants', () => {
  it('answers only at admin', () => {
    expect(canViewGrants('admin')).toBe(true)
    expect(canViewGrants('share')).toBe(false)
    expect(canViewGrants('write')).toBe(false)
    expect(canViewGrants('read')).toBe(false)
  })

  // One rung above `canReshare`, on purpose: granting adds your own access, reading the list
  // exposes everyone else's. A `share` grantee may do the first and not the second.
  it('is stricter than resharing', () => {
    expect(canReshare('share')).toBe(true)
    expect(canViewGrants('share')).toBe(false)
  })

  // Absent means the node does not send the field — an older deployment, not a denial. Losing
  // every control on a version skew is the worse failure, and the node still enforces.
  it('treats an absent permission as unrestricted, like every other rung', () => {
    expect(canViewGrants(undefined)).toBe(true)
    expect(canDelete(undefined)).toBe(true)
  })
})
