import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** A value to copy (an address, a settings snippet) with its Copy button. */
export function CopyField({ value, label, multiline = false }: { value: string; label: string; multiline?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-page p-3 font-mono text-sm text-ink" aria-label={label}>
          {value}
        </pre>
      ) : (
        <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-page px-3 font-mono text-sm text-ink" />
      )}
      <button type="button" className={secondaryButton} onClick={() => void copy()} aria-live="polite">
        {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
        {copied ? t('assistant.copied') : t('assistant.copy')}
      </button>
    </div>
  );
}
