import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { HuishoudenWord } from './DutchWord';

const STEPS = ['intro.step1', 'intro.step2', 'intro.step3'] as const;

/** Signed out: what Huishouden is and how to start, kept short so the tiles stay the main thing. */
export function Intro({ onSignIn, error }: { onSignIn: () => void; error?: string }) {
  const t = useT();
  // The sentence is translated whole; the suite's name in it explains itself (the Dutch word).
  const [before, after = ''] = t('intro.about', { name: '\u0000' }).split('\u0000');
  return (
    <section id="household" aria-label={t('intro.label')} className={`${cardClass} grid gap-x-12 gap-y-4 p-6 md:grid-cols-2`}>
      <div>
        <h2 className="mb-3 text-xl font-semibold text-link">{t('intro.title')}</h2>
        <p className="mb-3">
          {before}
          <HuishoudenWord />
          {after}
        </p>
        <p className="mb-3 text-sm text-muted">{t('intro.private')}</p>
        <button type="button" className={primaryButton} onClick={onSignIn}>
          {t('intro.signIn')}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-error">
            {error}
          </p>
        )}
      </div>
      <div>
        <h3 className="mb-3 font-semibold">{t('intro.howItWorks')}</h3>
        <ol className="grid gap-3 [counter-reset:step]">
          {STEPS.map((step) => (
            <li
              key={step}
              className="flex items-baseline gap-3 [counter-increment:step] before:inline-flex before:h-7 before:w-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-tint before:text-sm before:font-semibold before:text-link before:content-[counter(step)]"
            >
              {t(step)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
