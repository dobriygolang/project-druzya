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
    updated: 'June 29, 2026',
    navPrivacy: 'Privacy',
    footer: '© druz9.online',
    s1Title: '1. Service and operator',
    s1Body:
      'druz9.online (the “Service”) is a platform for technical interview preparation: mock interviews, code execution and checks, AI scoring, a task tracker, learning materials, and collaborative live coding. The operator is the druz9.online administration. By using the Service, you confirm that you have read and accept these Terms and the Privacy Policy.',
    s2Title: '2. Registration and account',
    s2Body:
      'Access requires sign-in via Telegram or Yandex ID. You must provide accurate information, keep your identity-provider account secure, and not share credentials with third parties. One person — one account unless otherwise agreed in writing with support.',
    s3Title: '3. Acceptable use',
    s3Li1: 'Do not abuse APIs, plan quotas, or automated scripts without the operator’s written consent.',
    s3Li2: 'Do not upload malicious code or disrupt sandbox or live rooms.',
    s3Li3: 'Do not publish or share third parties’ personal data without their consent.',
    s3Li4: 'Do not attempt to bypass technical limits, plan quotas, or security measures.',
    s4Title: '4. Content, IP, and AI scoring',
    s4Body:
      'Tasks, interview templates, and learning materials belong to the operator or rights holders and are provided for personal preparation. Code and text you submit remain yours; you grant the operator a non-exclusive license to process that content as needed to run the Service. AI scoring is automated and advisory — not a hiring decision. The operator does not guarantee outcomes in real interviews.',
    s5Title: '5. Plans, trial, and payment',
    s5BodyBefore: 'Free and Pro plan details, usage limits, and trial terms are on the',
    s5PricingLink: 'pricing page',
    s5BodyAfter:
      '. Pro subscriptions are paid via our payment partner Tribute (web or Telegram). Billing, renewal, and cancellation follow Tribute’s rules and your payment method. Pro trial is one-time per account unless stated otherwise on the pricing page. If you do not subscribe after trial, limits revert to Free. Refunds for an already provided subscription period are not offered except where required by applicable law.',
    s6Title: '6. Limitation of liability',
    s6Body:
      'The Service is provided “as is”. The operator is not liable for indirect damages, lost profits, data loss caused by third parties, failures of connectivity, hosting, payment providers, or force majeure. Total liability is limited to Pro fees you actually paid in the last 12 months (if applicable).',
    s7Title: '7. Suspension and termination',
    s7Body:
      'You may stop using the Service at any time. The operator may restrict or terminate access for violations of these Terms, legal requirements, or security threats, with notice via account contacts or email when reasonably possible.',
    s8Title: '8. Changes and contact',
    s8BodyBefore:
      'The operator may update these Terms; the current version is published on this page with the update date. Continued use after changes means acceptance. Questions about the Terms:',
    s8AbuseBefore: 'Abuse and violation reports:',
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    updated: 'June 29, 2026',
    navTerms: 'Terms',
    footer: '© druz9.online',
    s1Title: '1. Operator and scope',
    s1Body:
      'This Policy describes how druz9.online (operator: druz9.online administration) processes users’ personal data under applicable data-protection law. It applies to all information the operator receives when you use the Service.',
    s2Title: '2. Data we process',
    s2Li1: 'Account data: username, avatar, Telegram and/or Yandex ID, registration date.',
    s2Li2: 'Preparation data: mock sessions, answers, attempt code, scores, and recommendations.',
    s2Li3: 'Code-run data: source code, stdout/stderr, sandbox test results.',
    s2Li4: 'Live room data: editor and board content synced between participants.',
    s2Li5: 'Tracker data: tasks, sprints, statuses, and daily plan.',
    s2Li6:
      'Subscription data: plan, trial status, usage counters, payment reference at Tribute (full card details are not stored by the operator).',
    s2Li7:
      'Technical data: IP address, user-agent, error and security logs — as needed to operate and protect the Service.',
    s3Title: '3. Purposes and legal bases',
    s3Body:
      'We process data to register and authenticate you, provide Service features, AI scoring, plan quotas, collaborative sync, user support, and contract performance. Legal bases include consent, contract performance, and legitimate interests (security, abuse prevention). We do not sell personal data.',
    s4Title: '4. Third parties and AI processing',
    s4Body:
      'Data may be shared with: identity providers (Telegram, Yandex), payment partner Tribute (as needed for billing), hosting/infrastructure providers, and AI model providers — only attempt content required for scoring (not passwords or OAuth tokens). Transfers are governed by confidentiality and data-protection obligations.',
    s5Title: '5. Storage, location, and retention',
    s5Body:
      'Data is stored on servers located in the Russian Federation. Retention is for the life of the account and up to 3 years after deletion (for legal compliance and dispute resolution), unless a longer period is required by law. The access token (JWT) is stored in browser localStorage; refresh sessions are stored on the operator’s servers.',
    s6Title: '6. Your rights',
    s6BodyBefore:
      'You may request information about processing, correction, blocking, or deletion, withdraw consent where processing is consent-based, and lodge a complaint with your supervisory authority. Contact',
    s6BodyAfter:
      '. The operator will respond within applicable legal timeframes. Account and related data deletion is handled on request via support.',
    s7Title: '7. Cookies and similar technologies',
    s7BodyBefore:
      'The Service uses technical cookies and tokens required for authentication and the UI. We do not use advertising cookies or third-party web analytics. See also the',
    s7TermsLink: 'Terms of Service',
    s8Title: '8. Children and policy updates',
    s8BodyBefore:
      'The Service is not intended for users under 14. The operator may update this Policy; the current date is at the top of the document. Privacy questions:',
  },
}
