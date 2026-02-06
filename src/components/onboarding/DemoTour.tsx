'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import { useTranslations } from 'next-intl'

import { useAuth } from '@/contexts'
import {
  DEMO_TOUR_START_EVENT,
  USER_MENU_TOGGLE_EVENT,
} from '@/components/onboarding/constants'

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
const PROPERTIES_SELECTOR = '[data-tour="object-properties"]'
const ADD_PROPERTY_SELECTOR = '[data-tour="add-property-button"]'
const PROPERTY_NAME_UPLOAD_SELECTOR = '[data-tour="property-name-upload"]'
const PROPERTY_VALUE_UPLOAD_SELECTOR = '[data-tour="property-value-upload"]'
const SUBMIT_SELECTOR = '[data-tour="object-create-submit"]'

export default function DemoTour() {
  const { isAuthenticated, authLoading } = useAuth()
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const isStartingRef = useRef(false)

  useEffect(() => {
    if (authLoading) {
      return
    }

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

    const startTour = () => {
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
                title: t('onboarding.demo.filters'),
                description: t('onboarding.demo.filtersDescription'),
              },
            },
            {
              element: VIEW_SELECTOR_SELECTOR,
              popover: {
                title: t('onboarding.demo.viewOptions'),
                description: t('onboarding.demo.viewOptionsDescription'),
              },
            },
            {
              element: CREATE_OBJECT_SELECTOR,
              popover: {
                title: t('onboarding.demo.createObjects'),
                description: t('onboarding.demo.createObjectsDescription'),
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
                title: t('onboarding.demo.modelTemplates'),
                description: t('onboarding.demo.modelTemplatesDescription'),
              },
            },
            {
              element: PARENTS_SELECTOR,
              popover: {
                title: t('onboarding.demo.parentRelationships'),
                description: t(
                  'onboarding.demo.parentRelationshipsDescription'
                ),
              },
            },
            {
              element: METADATA_CONTAINER_SELECTOR,
              popover: {
                title: t('onboarding.demo.objectMetadata'),
                description: t('onboarding.demo.objectMetadataDescription'),
              },
            },
            {
              element: ADDRESS_SELECTOR,
              popover: {
                title: t('onboarding.demo.locationInfo'),
                description: t('onboarding.demo.locationInfoDescription'),
              },
            },
            {
              element: FILES_SELECTOR,
              popover: {
                title: t('onboarding.demo.fileAttachments'),
                description: t('onboarding.demo.fileAttachmentsDescription'),
              },
            },
            {
              element: ADD_PROPERTY_SELECTOR,
              popover: {
                title: t('onboarding.demo.customProperties'),
                description: t('onboarding.demo.customPropertiesDescription'),
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
                title: t('onboarding.demo.propertyFiles'),
                description: t('onboarding.demo.propertyFilesDescription'),
              },
            },
            {
              element: SUBMIT_SELECTOR,
              disableActiveInteraction: true,
              popover: {
                title: t('onboarding.demo.completeCreation'),
                description: t('onboarding.demo.completeCreationDescription'),
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
      startTour()
    }

    window.addEventListener(DEMO_TOUR_START_EVENT, handleStart)

    return () => {
      window.removeEventListener(DEMO_TOUR_START_EVENT, handleStart)
    }
  }, [authLoading, isAuthenticated, pathname, router])

  return null
}
