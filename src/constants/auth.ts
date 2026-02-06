import {
  KeyRound,
  Shield,
  ArrowRight,
  Boxes,
  ArrowLeftRight,
  Layers,
  FileUp,
} from 'lucide-react'

export const AUTH_FEATURES = [
  { icon: Boxes, key: 'featureObjects' },
  { icon: ArrowLeftRight, key: 'featureProcesses' },
  { icon: Layers, key: 'featureModels' },
  { icon: FileUp, key: 'featureImport' },
] as const

export const AUTH_STEPS = [
  {
    num: '1',
    icon: KeyRound,
    titleKey: 'infoStep1Title',
    descKey: 'infoStep1',
  },
  {
    num: '2',
    icon: Shield,
    titleKey: 'infoStep2Title',
    descKey: 'infoStep2',
  },
  {
    num: '3',
    icon: ArrowRight,
    titleKey: 'infoStep3Title',
    descKey: 'infoStep3',
  },
] as const
