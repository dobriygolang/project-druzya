// SHARED EVENT TAXONOMY — keep synced with:
//   frontend/src/lib/analytics-events.ts
//   cue/src/renderer/lib/analytics-events.ts
// Convention: snake_case, dotted namespaces. Names live here as constants
// so call sites get rename safety. Server stores raw string — no proto
// enum drift if we add an event mid-week.

export const ANALYTICS_EVENTS = {
  // Onboarding
  onboarding_step_started: 'onboarding.step.started',
  onboarding_step_completed: 'onboarding.step.completed',
  onboarding_completed: 'onboarding.completed',
  install_recorded: 'install.recorded',

  // Focus (Hone)
  focus_session_started: 'focus_session.started',
  focus_session_completed: 'focus_session.completed',
  reflection_submitted: 'reflection.submitted',

  // Coach
  coach_next_action_viewed: 'coach.next_action.viewed',
  coach_next_action_consumed: 'coach.next_action.consumed',
  coach_chat_message_sent: 'coach.chat.message_sent',

  // Cue session
  cue_session_started: 'cue_session.started',
  cue_session_completed: 'cue_session.completed',
  cue_suggestion_received: 'cue.suggestion.received',
  cue_suggestion_acted_upon: 'cue.suggestion.acted_upon',

  // Mock pipeline (web)
  mock_pipeline_started: 'mock_pipeline.started',
  mock_pipeline_stage_completed: 'mock_pipeline.stage.completed',
  mock_pipeline_completed: 'mock_pipeline.completed',

  // Monetization
  upgrade_modal_shown: 'upgrade_modal.shown',
  upgrade_modal_clicked: 'upgrade_modal.clicked',
  trial_pro_granted: 'trial_pro.granted',
  byok_unlocked: 'byok.unlocked',

  // Notes (Hone)
  note_created: 'note.created',
  note_link_clicked: 'note.link.clicked',

  // TaskBoard
  task_auto_categorised: 'task.auto_categorised',
  task_kind_manually_overridden: 'task.kind.manually_overridden',


  // Cross-app handoff
  cross_app_opened: 'cross_app.opened',
  deep_link_received: 'deep_link.received',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
