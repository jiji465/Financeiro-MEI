import { Link } from 'react-router';

import { cn } from '@/lib/utils/cn';

/** Logotipo textual do MEI Financeiro (link para o início). */
export function BrandMark({ compacto, className }: { compacto?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2 rounded-md font-bold tracking-tight text-primary-800',
        className,
      )}
      aria-label="MEI Financeiro — início"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white"
      >
        M
      </span>
      {compacto ? null : <span className="text-base">MEI Financeiro</span>}
    </Link>
  );
}
