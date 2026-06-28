import { Link } from 'react-router-dom'
import { LegalLayout, LegalNavLink, LegalSection } from '@/components/legal/LegalLayout'
import { useI18n } from '@/lib/i18n'

export default function LegalTermsPage() {
  const { t } = useI18n()

  return (
    <LegalLayout
      eyebrow={t('legal.terms.eyebrow')}
      title={t('legal.terms.title')}
      updated={t('legal.terms.updated')}
      nav={<LegalNavLink to="/legal/privacy">{t('legal.terms.navPrivacy')}</LegalNavLink>}
      footer={t('legal.terms.footer')}
    >
      <LegalSection title={t('legal.terms.s1Title')}>
        <p>{t('legal.terms.s1Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s2Title')}>
        <p>{t('legal.terms.s2Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s3Title')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('legal.terms.s3Li1')}</li>
          <li>{t('legal.terms.s3Li2')}</li>
          <li>{t('legal.terms.s3Li3')}</li>
          <li>{t('legal.terms.s3Li4')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.terms.s4Title')}>
        <p>{t('legal.terms.s4Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s5Title')}>
        <p>
          {t('legal.terms.s5BodyBefore')}{' '}
          <Link to="/pricing" className="underline">
            {t('legal.terms.s5PricingLink')}
          </Link>{' '}
          {t('legal.terms.s5BodyAfter')}
        </p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s6Title')}>
        <p>{t('legal.terms.s6Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s7Title')}>
        <p>{t('legal.terms.s7Body')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.s8Title')}>
        <p>
          {t('legal.terms.s8BodyBefore')}{' '}
          <a href="mailto:legal@druz9.ru" className="underline">
            legal@druz9.ru
          </a>
          . {t('legal.terms.s8AbuseBefore')}{' '}
          <a href="mailto:abuse@druz9.ru" className="underline">
            abuse@druz9.ru
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
