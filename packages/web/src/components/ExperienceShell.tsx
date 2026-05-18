import type { ReactNode } from 'react';

type AccentTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';

interface ExperiencePageProps {
  children: ReactNode;
  className?: string;
}

interface ExperienceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

interface ExperienceCardProps {
  children: ReactNode;
  className?: string;
}

interface ExperienceBadgeProps {
  children: ReactNode;
  tone?: AccentTone;
  className?: string;
}

const badgeToneClasses: Record<AccentTone, string> = {
  sky: 'bg-[#e8f0ff] text-[#1a6dff]',
  emerald: 'bg-[rgba(16,185,129,0.1)] text-[#059669]',
  amber: 'bg-[rgba(245,158,11,0.1)] text-[#d97706]',
  rose: 'bg-[rgba(239,68,68,0.1)] text-[#dc2626]',
  slate: 'bg-[#f8fafd] text-[#5e6687]',
};

export function ExperiencePage({ children, className = '' }: ExperiencePageProps) {
  return (
    <div
      className={`px-5 py-6 pb-14 sm:px-4 ${className}`.trim()}
    >
      <div className="mx-auto max-w-[480px] space-y-6">
        {children}
      </div>
    </div>
  );
}

export function ExperienceHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
}: ExperienceHeroProps) {
  return (
    <section
      className={`mb-7 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 font-['DM_Sans',_'Noto_Sans_SC',sans-serif] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a6dff]">
            {eyebrow}
          </p>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-[#1a1f36]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#5e6687]">
            {description}
          </p>
        </div>

        {actions && (
          <div className="flex flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="mt-6">
          {children}
        </div>
      )}
    </section>
  );
}

export function ExperienceCard({ children, className = '' }: ExperienceCardProps) {
  return (
    <section
      className={`rounded-[14px] border border-[#e8ecf2] bg-white p-6 shadow-[0_1px_3px_rgba(26,31,54,0.04)] transition hover:shadow-[0_4px_16px_rgba(26,31,54,0.06)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function ExperienceBadge({
  children,
  tone = 'slate',
  className = '',
}: ExperienceBadgeProps) {
  return (
    <div
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium ${badgeToneClasses[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
