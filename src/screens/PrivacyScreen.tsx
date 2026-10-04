import { cardClass } from '@huishouden/pwa-kit/react/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../i18n';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const SECTIONS = [
  { title: 'privacy.dataTitle', paragraphs: ['privacy.dataBody'] },
  { title: 'privacy.homeTitle', paragraphs: ['privacy.homeBody'] },
  { title: 'privacy.sendTitle', items: ['privacy.sendErrors', 'privacy.sendSpeed', 'privacy.sendUsage', 'privacy.sendRegion'] },
  { title: 'privacy.neverTitle', paragraphs: ['privacy.neverBody'] },
  { title: 'privacy.gpcTitle', paragraphs: ['privacy.gpcBody'] },
  { title: 'privacy.providersTitle', items: ['privacy.providerFirebase', 'privacy.providerNewRelic', 'privacy.providerCloudflare', 'privacy.providerGoogle', 'privacy.providerOsm'] },
] as const;

/** What the apps collect and why, in plain words. Linked from every app's account menu. */
export function PrivacyScreen() {
  const t = useT();
  // A new page in the same document: name it and move focus to it, so screen readers announce it.
  const heading = useRef<HTMLHeadingElement>(null);
  const title = t('privacy.documentTitle');
  useEffect(() => {
    const before = document.title;
    document.title = title;
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, [title]);
  // The sentence is translated whole; the link sits where the language puts it.
  const [before, after = ''] = t('privacy.code', { link: '\u0000' }).split('\u0000');
  return (
    <article className={`${cardClass} mx-auto max-w-[720px] space-y-6 p-6 text-base leading-relaxed text-ink sm:p-8`}>
      <header className="space-y-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold text-ink outline-none">
          {t('privacy.title')}
        </h1>
        <p>{t('privacy.intro')}</p>
      </header>

      {SECTIONS.map((section) => (
        <Section key={section.title} title={t(section.title)}>
          {'paragraphs' in section &&
            section.paragraphs.map((p) => <p key={p}>{t(p)}</p>)}
          {'items' in section && (
            <ul className="list-disc space-y-1 pl-6">
              {section.items.map((item) => (
                <li key={item}>{t(item)}</li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      <p className="text-muted">
        {before}
        <a className="font-medium text-link underline underline-offset-4" href="https://github.com/huishouden/pwa-kit/blob/main/docs/observability.md">
          {t('privacy.codeLink')}
        </a>
        {after}
      </p>
    </article>
  );
}
