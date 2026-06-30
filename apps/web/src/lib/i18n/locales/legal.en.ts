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
    footer: '© Hone',
    s1Title: '1. Service and operator',
    s1Body:
      'Hone (the “Service”) is a productivity workspace: a desktop app for notes, daily planning, and focus, plus a web companion for account management, billing, and live collaboration rooms. The operator is the Hone project administration (druz9.online). By using the Service, you confirm that you have read and accept these Terms and the Privacy Policy.',
    s2Title: '2. Registration and account',
    s2Body:
      'Some features require sign-in via Telegram or Yandex ID. Live rooms can be created without an account (guest access). You must keep your identity-provider account secure and not share credentials. One person — one account unless otherwise agreed in writing with support.',
    s3Title: '3. Acceptable use',
    s3Li1: 'Do not abuse APIs, plan quotas, or automated scripts without the operator’s written consent.',
    s3Li2: 'Do not upload malicious code or disrupt sandbox runs or live rooms.',
    s3Li3: 'Do not publish or share third parties’ personal data without their consent.',
    s3Li4: 'Do not attempt to bypass technical limits, plan quotas, or security measures.',
    s4Title: '4. Content and intellectual property',
    s4Body:
      'Hone software, branding, and default materials belong to the operator or rights holders. Notes, tasks, and code you create remain yours; you grant the operator a non-exclusive license to process that content as needed to run the Service (sync, storage, collaboration). Optional encrypted vault content is processed according to your vault settings.',
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
      'You may stop using the Service at any time. The operator may restrict or terminate access for violations of these Terms, legal requirements, or security threats, with notice via account contacts when reasonably possible.',
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
    footer: '© Hone',
    s1Title: '1. Operator and scope',
    s1Body:
      'This Policy describes how Hone (operator: druz9.online administration) processes users’ personal data under applicable data-protection law. It applies to the web companion, account services, billing, and live collaboration features.',
    s2Title: '2. Data we process',
    s2Li1: 'Account data: username, avatar, Telegram and/or Yandex ID, registration date.',
    s2Li2: 'Workspace data (when synced): notes, tasks, focus sessions, and related metadata.',
    s2Li3: 'Code-run data: source code submitted in live rooms, stdout/stderr, sandbox test results.',
    s2Li4: 'Live room data: editor and whiteboard content synced between participants; guest display names for session-scoped tokens.',
    s2Li5: 'Optional vault data: encrypted note content when you enable E2EE — the operator stores ciphertext only.',
    s2Li6:
      'Subscription data: plan, trial status, usage counters, payment reference at Tribute (full card details are not stored by the operator).',
    s2Li7:
      'Technical data: IP address, user-agent, error and security logs — as needed to operate and protect the Service.',
    s3Title: '3. Purposes and legal bases',
    s3Body:
      'We process data to register and authenticate you, provide Service features, enforce plan quotas, enable collaboration, process payments, provide support, and protect the Service. Legal bases include consent, contract performance, and legitimate interests (security, abuse prevention). We do not sell personal data.',
    s4Title: '4. Third parties',
    s4Body:
      'Data may be shared with: identity providers (Telegram, Yandex), payment partner Tribute (as needed for billing), hosting/infrastructure providers, and sandbox/code-run infrastructure — only what is required to deliver the feature you use. Transfers are governed by confidentiality and data-protection obligations.',
    s5Title: '5. Storage, location, and retention',
    s5Body:
      'Data is stored on servers located in the Russian Federation. Retention is for the life of the account and up to 3 years after deletion (for legal compliance and dispute resolution), unless a longer period is required by law. The access token (JWT) is stored in browser localStorage; guest room tokens are stored in sessionStorage.',
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
