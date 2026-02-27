'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Home as HomeIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  TruncateWithTooltip,
} from '@/components/ui'

interface Ancestor {
  uuid: string
  name: string
}

interface ObjectBreadcrumbProps {
  /** Current object name and UUID */
  currentObject: {
    uuid: string
    name: string
  }
  /** List of ancestors from root to parent (not including current) */
  ancestors: Ancestor[]
  /** Callback when navigating to an ancestor */
  onNavigateToAncestor?: (uuid: string) => void
  /** Callback when navigating to root */
  onNavigateToRoot?: () => void
  /** Maximum characters for truncating names */
  maxNameLength?: number
  /** Maximum visible ancestors before truncation */
  maxVisible?: number
}

/**
 * Breadcrumb navigation for object hierarchy.
 * Shows: Objects > Ancestor1 > ... > AncestorN > Current
 */
export function ObjectBreadcrumb({
  currentObject,
  ancestors,
  onNavigateToAncestor,
  onNavigateToRoot,
  maxNameLength = 25,
  maxVisible = 4,
}: ObjectBreadcrumbProps) {
  const t = useTranslations()
  const edgeCount = 2

  const truncatedAncestors = useMemo(() => {
    if (ancestors.length <= maxVisible) {
      return { leading: ancestors, trailing: [], truncated: false }
    }
    return {
      leading: ancestors.slice(0, edgeCount),
      trailing: ancestors.slice(-1),
      truncated: true,
    }
  }, [ancestors, maxVisible])

  const handleRootClick = () => {
    onNavigateToRoot?.()
  }

  const handleAncestorClick = (uuid: string) => {
    onNavigateToAncestor?.(uuid)
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Root link */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link
              href="/objects"
              className="flex items-center gap-2"
              onClick={handleRootClick}
            >
              <HomeIcon className="size-4" />
              {t('objects.childrenPage.breadcrumbRoot')}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Leading ancestors */}
        {truncatedAncestors.leading.map((ancestor) => (
          <span key={ancestor.uuid} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href={`/objects/${ancestor.uuid}`}
                  onClick={() => handleAncestorClick(ancestor.uuid)}
                >
                  <TruncateWithTooltip
                    text={ancestor.name}
                    maxLength={maxNameLength}
                  />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </span>
        ))}

        {/* Ellipsis and trailing ancestors when truncated */}
        {truncatedAncestors.truncated && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            {truncatedAncestors.trailing.map((ancestor) => (
              <span key={ancestor.uuid} className="contents">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/objects/${ancestor.uuid}`}
                      onClick={() => handleAncestorClick(ancestor.uuid)}
                    >
                      <TruncateWithTooltip
                        text={ancestor.name}
                        maxLength={maxNameLength}
                      />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </span>
            ))}
          </>
        )}

        {/* Current page */}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            <TruncateWithTooltip
              text={currentObject.name || currentObject.uuid}
              maxLength={maxNameLength}
            />
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
