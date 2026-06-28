import type { legalRu } from './legal.ru'

type LegalMessages = {
  [K in keyof typeof legalRu]: {
    [P in keyof (typeof legalRu)[K]]: string
  }
}

export const legalEn: LegalMessages = {
  layout: {
    updated: 'Last updated:',
  },
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    updated: 'June 28, 2026',
    navPrivacy: 'Privacy',
    footer: 'Draft for druz9.online MVP. Final legal review before public launch.',
    s1Title: '1. Service',
    s1Body:
      'druz9.online is a platform for technical interview prep: mock interviews, code execution, AI scoring, and skill recommendations. By using the service, you agree to these terms.',
    s2Title: '2. Account',
    s2Body:
      'Sign-up is via Telegram or Yandex ID. You are responsible for access to your account at the identity provider. One person — one account unless agreed otherwise with support.',
    s3Title: '3. Acceptable use',
    s3Li1: 'Do not abuse APIs, quotas, or automated scripts.',
    s3Li2: 'Do not upload malicious code to sandbox or live rooms.',
    s3Li3: 'Do not publish others’ personal data without consent.',
    s3Li4: 'Do not attempt to bypass plan limits.',
    s4Title: '4. Content and AI scoring',
    s4Body:
      'Tasks and rubrics come from the catalog service. AI scoring is automated and advisory — not a hiring decision. We do not guarantee passing a real interview.',
    s5Title: '5. Pricing',
    s5BodyBefore: 'Free/Pro limits are on the',
    s5PricingLink: 'pricing page',
    s5BodyAfter: 'and enforced by billing-service. Pro payment when checkout is available in the UI.',
    s6Title: '6. Limitation of liability',
    s6Body:
      'The service is provided “as is”. We are not liable for indirect damages, data loss due to third parties, or force majeure. Maximum liability is limited to Pro fees paid in the last 12 months (if applicable).',
    s7Title: '7. Termination',
    s7Body:
      'You may stop using the service at any time. We may restrict or close an account for violations when notice is possible.',
    s8Title: '8. Contact',
    s8BodyBefore: 'Questions about terms:',
    s8AbuseBefore: 'Abuse reports:',
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    updated: 'June 28, 2026',
    navTerms: 'Terms',
    footer:
      'Draft for the current MVP (druz9.online microservices). Storage details in the production checklist.',
    s1Title: '1. Data we process',
    s1Account: 'Account — username, avatar, telegram_id and/or yandex_id (identity service).',
    s1Mock: 'Mock interviews — sessions, answers, attempt code, scores (interview + ai services).',
    s1Runs: 'Code runs — source, stdout/stderr, test results (sandbox service).',
    s1Live: 'Live rooms — editor content for sync (rooms service).',
    s1Rec: 'Recommendations — skill profile and learning plan (recommendation service).',
    s1Billing: 'Billing — plan and usage counters (billing service).',
    s2Title: '2. What we do not collect in MVP',
    s2Li1: 'Email/password — only OAuth/Telegram via identity.',
    s2Li2: 'Ad cookies and third-party web analytics.',
    s2Li3: 'Access to files on your device beyond code/text you enter.',
    s3Title: '3. Why we use it',
    s3Body:
      'For authentication, mock sessions, AI scoring, plan quotas, collab editor, and personalized recommendations. We do not sell data to third parties.',
    s4Title: '4. AI processing',
    s4Body:
      'Attempt text and code are sent to ai-service for scoring. We do not send your password or OAuth tokens — only attempt content needed for evaluation.',
    s5Title: '5. Storage and location',
    s5Body:
      'Data is stored in each service’s PostgreSQL and Redis. Production targets infrastructure in RF — see deploy checklist. JWT access token in client localStorage; refresh in backend Redis.',
    s6Title: '6. Your rights',
    s6BodyBefore: 'You may request information about processed data and account deletion at',
    s6BodyAfter: '. Self-service export/delete in the UI is on the roadmap; contact support for now.',
    s7Title: '7. Cookies',
    s7BodyBefore: 'Technical cookies/tokens for auth session. No marketing cookies. See also',
    s7TermsLink: 'terms of service',
    s8Title: '8. Contact',
    s8BodyBefore: 'DPO / privacy:',
  },
}
