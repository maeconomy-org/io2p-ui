'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/styles/driver-custom.css'
import { useLocale, useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import {
  DEMO_TOUR_START_EVENT,
  USER_MENU_TOGGLE_EVENT,
} from '@/components/onboarding/constants'
import { loadTourMessages, tourText } from './tour-messages'

const MAX_ATTEMPTS = 20
const ATTEMPT_DELAY_MS = 300

const FILTERS_SELECTOR = '[data-tour="filters"]'
const VIEW_SELECTOR_SELECTOR = '[data-tour="view-selector"]'
const CREATE_OBJECT_SELECTOR = '[data-tour="create-object"]'
const MODEL_SELECTOR = '[data-tour="object-model"]'
const PARENTS_SELECTOR = '[data-tour="object-parents"]'
const METADATA_CONTAINER_SELECTOR = '[data-tour="object-metadata"]'
const ADDRESS_SELECTOR = '[data-tour="object-address"]'
const FILES_SELECTOR = '[data-tour="object-files"]'
const ADD_PROPERTY_SELECTOR = '[data-tour="add-property-button"]'
const PROPERTY_NAME_UPLOAD_SELECTOR = '[data-tour="property-name-upload"]'
const SUBMIT_SELECTOR = '[data-tour="object-create-submit"]'

export default function DemoTour() {
  const { isAuthenticated, authLoading } = useAuth()
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const isStartingRef = useRef(false)

  useEffect(() => {
    if (authLoading) {
      return
    }

    // Guards the await in startTour: if the effect tears down while the tour
    // copy is still loading, do not open a tour over a page that has moved on.
    let cancelled = false

    const waitForElement = (
      selector: string,
      onReady: () => void,
      attempts = 0
    ) => {
      if (document.querySelector(selector)) {
        onReady()
        return
      }

      if (attempts < MAX_ATTEMPTS) {
        setTimeout(() => {
          waitForElement(selector, onReady, attempts + 1)
        }, ATTEMPT_DELAY_MS)
      }
    }

    const startTour = async () => {
      // Tour copy fetched on launch rather than bundled into every page — see
      // tour-messages.
      const m = await loadTourMessages(locale)
      if (cancelled) return

      if (!isAuthenticated || isStartingRef.current) {
        return
      }

      isStartingRef.current = true
      window.dispatchEvent(
        new CustomEvent(USER_MENU_TOGGLE_EVENT, { detail: { open: false } })
      )

      if (pathname !== '/objects') {
        router.push('/objects')
      }

      waitForElement(CREATE_OBJECT_SELECTOR, () => {
        const driverObj = driver({
          nextBtnText: t('common.next'),
          prevBtnText: t('common.previous'),
          showProgress: true,
          allowClose: false,
          allowKeyboardControl: true,
          onDestroyed: () => {
            driverRef.current = null
            isStartingRef.current = false
          },
          steps: [
            {
              element: FILTERS_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'filters'),
                description: tourText(m, 'demo', 'filtersDescription'),
              },
            },
            {
              element: VIEW_SELECTOR_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'viewOptions'),
                description: tourText(m, 'demo', 'viewOptionsDescription'),
              },
            },
            {
              element: CREATE_OBJECT_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'createObjects'),
                description: tourText(m, 'demo', 'createObjectsDescription'),
                onNextClick: () => {
                  const trigger = document.querySelector(
                    CREATE_OBJECT_SELECTOR
                  ) as HTMLElement | null
                  trigger?.click()

                  waitForElement(MODEL_SELECTOR, () => {
                    driverObj.moveNext()
                  })
                },
              },
            },
            {
              element: MODEL_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'modelTemplates'),
                description: tourText(m, 'demo', 'modelTemplatesDescription'),
              },
            },
            {
              element: PARENTS_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'parentRelationships'),
                description: tourText(
                  m,
                  'demo',
                  'parentRelationshipsDescription'
                ),
              },
            },
            {
              element: METADATA_CONTAINER_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'objectMetadata'),
                description: tourText(m, 'demo', 'objectMetadataDescription'),
              },
            },
            {
              element: ADDRESS_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'locationInfo'),
                description: tourText(m, 'demo', 'locationInfoDescription'),
              },
            },
            {
              element: FILES_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'fileAttachments'),
                description: tourText(m, 'demo', 'fileAttachmentsDescription'),
              },
            },
            {
              element: ADD_PROPERTY_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'customProperties'),
                description: tourText(m, 'demo', 'customPropertiesDescription'),
                onNextClick: () => {
                  const addButton = document.querySelector(
                    ADD_PROPERTY_SELECTOR
                  ) as HTMLElement | null
                  addButton?.click()

                  // Wait for the property fields to appear, then move to next step
                  waitForElement(PROPERTY_NAME_UPLOAD_SELECTOR, () => {
                    driverObj.moveNext()
                  })
                },
              },
            },
            {
              element: PROPERTY_NAME_UPLOAD_SELECTOR,
              popover: {
                title: tourText(m, 'demo', 'propertyFiles'),
                description: tourText(m, 'demo', 'propertyFilesDescription'),
              },
            },
            {
              element: SUBMIT_SELECTOR,
              disableActiveInteraction: true,
              popover: {
                title: tourText(m, 'demo', 'completeCreation'),
                description: tourText(m, 'demo', 'completeCreationDescription'),
              },
            },
          ],
        })

        driverRef.current = driverObj
        driverObj.drive()
      })
    }

    const handleStart = () => {
      if (driverRef.current) {
        driverRef.current.destroy()
      }
      void startTour()
    }

    window.addEventListener(DEMO_TOUR_START_EVENT, handleStart)

    return () => {
      cancelled = true
      window.removeEventListener(DEMO_TOUR_START_EVENT, handleStart)
    }
    // `locale` and `t` omitted deliberately: both are read only inside
    // startTour, which runs on an explicit user action, and re-registering the
    // listener on a language change would tear down a tour mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, pathname, router])

  return null
}
