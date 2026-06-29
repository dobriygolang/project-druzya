import { Link } from 'react-router-dom'
import { LegalLayout, LegalNavLink, LegalSection } from '@/components/legal/LegalLayout'
import { useI18n } from '@/lib/i18n'

export default function LegalPrivacyPage() {
  const { t } = useI18n()

  return (
    <LegalLayout
      eyebrow={t('legal.privacy.eyebrow')}
      title={t('legal.privacy.title')}
      updated={t('legal.privacy.updated')}
      nav={<LegalNavLink to="/legal/terms">{t('legal.privacy.navTerms')}</LegalNavLink>}
      footer={t('legal.privacy.footer')}
    >
      <LegalSection title={t('legal.privacy.s1Title')}>
        <p>{t('legal.privacy.s1Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s2Title')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('legal.privacy.s2Li1')}</li>
          <li>{t('legal.privacy.s2Li2')}</li>
          <li>{t('legal.privacy.s2Li3')}</li>
          <li>{t('legal.privacy.s2Li4')}</li>
          <li>{t('legal.privacy.s2Li5')}</li>
          <li>{t('legal.privacy.s2Li6')}</li>
          <li>{t('legal.privacy.s2Li7')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s3Title')}>
        <p>{t('legal.privacy.s3Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s4Title')}>
        <p>{t('legal.privacy.s4Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s5Title')}>
        <p>{t('legal.privacy.s5Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s6Title')}>
        <p>
          {t('legal.privacy.s6BodyBefore')}{' '}
          <a href="mailto:privacy@druz9.ru" className="underline">
            privacy@druz9.ru
          </a>
          {t('legal.privacy.s6BodyAfter')}
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s7Title')}>
        <p>
          {t('legal.privacy.s7BodyBefore')}{' '}
          <Link to="/legal/terms" className="underline">
            {t('legal.privacy.s7TermsLink')}
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.s8Title')}>
        <p>
          {t('legal.privacy.s8BodyBefore')}{' '}
          <a href="mailto:privacy@druz9.ru" className="underline">
            privacy@druz9.ru
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
