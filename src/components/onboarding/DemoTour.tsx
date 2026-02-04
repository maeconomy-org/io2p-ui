'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver } from 'driver.js'

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
          allowClose: true,
          allowKeyboardControl: true,
          onDestroyed: () => {
            driverRef.current = null
            isStartingRef.current = false
          },
          steps: [
            {
              element: FILTERS_SELECTOR,
              popover: {
                title: 'Filters',
                description:
                  'Use filters to refine your view and find exactly what you need. You can filter by various criteria including showing or hiding deleted objects, status, categories, and more. Filters help you focus on the most relevant data for your current task.',
              },
            },
            {
              element: VIEW_SELECTOR_SELECTOR,
              popover: {
                title: 'View Options',
                description:
                  'Switch between different view modes to see your data in the format that works best for you. Choose from table view for detailed listings or column view for a more visual, card-based layout. Your preference is automatically saved.',
              },
            },
            {
              element: CREATE_OBJECT_SELECTOR,
              popover: {
                title: 'Create New Objects',
                description:
                  'This is where your object creation journey begins. Click this button anytime you want to add a new object to your IoM system. Objects can represent anything from physical items to digital assets, processes, or concepts.',
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
                title: 'Model Templates',
                description:
                  "Choose from predefined templates that automatically populate relevant fields based on the type of object you're creating. Models ensure consistency and save time by providing structured blueprints for common object types in your organization.",
              },
            },
            {
              element: PARENTS_SELECTOR,
              popover: {
                title: 'Parent Relationships',
                description:
                  'Establish hierarchical connections by linking this object to its parent objects. This creates a structured tree that helps organize your data and enables powerful filtering and navigation through related objects.',
              },
            },
            {
              element: METADATA_CONTAINER_SELECTOR,
              popover: {
                title: 'Object Metadata',
                description:
                  "These core fields define your object's identity: Name (the primary identifier), Abbreviation (optional short code for quick reference), Version (for tracking changes over time), and Description (detailed explanation for team understanding). Fill these thoughtfully as they're used throughout the system for search and identification.",
              },
            },
            {
              element: ADDRESS_SELECTOR,
              popover: {
                title: 'Location Information',
                description:
                  'Associate a physical address or location with your object when relevant. This is particularly useful for tracking assets, facilities, or any objects that have a geographic component to their identity.',
              },
            },
            {
              element: FILES_SELECTOR,
              popover: {
                title: 'File Attachments',
                description:
                  "Upload supporting documents, images, specifications, or any files that provide additional context about your object. These attachments become part of the object's permanent record and are searchable within the system.",
              },
            },
            {
              element: ADD_PROPERTY_SELECTOR,
              popover: {
                title: 'Custom Properties',
                description:
                  'Add specialized data fields unique to your object. Each property has a name and value, and you can attach files to individual properties for detailed documentation. This flexibility allows you to capture any specific information your object needs.',
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
                title: 'Property File Attachments',
                description:
                  'Properties support file attachments at multiple levels - you can attach files to the property name itself (for documentation about what the property represents) and to individual property values (for evidence or supporting documents). This granular file system creates comprehensive documentation for your objects.',
              },
            },
            {
              element: SUBMIT_SELECTOR,
              disableActiveInteraction: true,
              popover: {
                title: 'Complete Object Creation',
                description:
                  "When you've filled in all the necessary information, click Create to save your new object to the system. The object will then be available for searching, linking, and use in processes throughout your IoM workspace.",
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
