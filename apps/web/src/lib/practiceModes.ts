import type { LucideIcon } from 'lucide-react'
import {
  Brain,
  Code2,
  Database,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react'
import type { SessionMode } from '@/lib/types'

export type PracticeLinkMode = {
  kind: 'link'
  id: string
  to: string
  title: string
  description: string
  icon: LucideIcon
  badge?: string
}

export type PracticeSessionMode = {
  kind: 'session'
  id: string
  mode: SessionMode
  title: string
  description: string
  icon: LucideIcon
  badge?: string
}

export type PracticeMode = PracticeLinkMode | PracticeSessionMode

/** Entry points for practice — collab room, full mock, or single-section training. */
export const PRACTICE_MODES: PracticeMode[] = [
  {
    kind: 'link',
    id: 'live-room',
    to: '/live/new',
    title: 'Live-комната',
    description:
      'Отдельный режим совместного coding: общий редактор, синхронизация в реальном времени. Создай комнату → «Пригласить» → отправь ссылку напарнику.',
    icon: Users,
    badge: 'Collab',
  },
  {
    kind: 'link',
    id: 'mock-interview',
    to: '/interview',
    title: 'Mock-интервью',
    description:
      'Полный флоу под компанию: несколько секций (алгоритмы, system design, behavioral) в одной сессии с AI-оценкой.',
    icon: Sparkles,
    badge: 'Full mock',
  },
  {
    kind: 'session',
    id: 'algorithms',
    mode: 'SESSION_MODE_ALGORITHMS_TRAINING',
    title: 'Алгоритмы',
    description: 'Solo-тренировка: задачи из каталога, запуск кода и AI-разбор без полного интервью.',
    icon: Code2,
  },
  {
    kind: 'session',
    id: 'system-design',
    mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING',
    title: 'System design',
    description: 'Архитектурные кейсы: масштабирование, trade-offs, устный разбор.',
    icon: Brain,
  },
  {
    kind: 'session',
    id: 'behavioral',
    mode: 'SESSION_MODE_BEHAVIORAL_TRAINING',
    title: 'Behavioral',
    description: 'STAR-ответы, soft skills и типовые вопросы рекрутеров.',
    icon: MessageSquare,
  },
  {
    kind: 'session',
    id: 'sql',
    mode: 'SESSION_MODE_SQL_TRAINING',
    title: 'SQL',
    description: 'Запросы и моделирование данных — отдельная секция без mock-шаблона.',
    icon: Database,
  },
  {
    kind: 'session',
    id: 'live-coding-solo',
    mode: 'SESSION_MODE_LIVE_CODING_TRAINING',
    title: 'Live coding (solo)',
    description: 'Парное решение задач в формате live coding — solo-сессия с AI-оценкой.',
    icon: Radio,
  },
]
