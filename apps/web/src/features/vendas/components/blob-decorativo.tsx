/** Forma orgânica decorativa atrás do mockup do hero — só um acabamento visual (aria-hidden). */
export function BlobDecorativo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      className={className}
      style={{ filter: 'blur(40px)' }}
    >
      <defs>
        <linearGradient id="blob-gradiente" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary-200)" />
          <stop offset="100%" stopColor="var(--color-acento-200)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#blob-gradiente)"
        d="M321.5 63.5Q368 127 351.5 199.5Q335 272 271 315Q207 358 137.5 335Q68 312 41 243.5Q14 175 55 111.5Q96 48 168 35Q240 22 275 42.5Q310 63 321.5 63.5Z"
      />
    </svg>
  );
}
