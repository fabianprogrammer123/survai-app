'use client';

export function AxiomMark({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: 'text-[15px]',
    md: 'text-lg',
    lg: 'text-xl',
  };
  const svgH = { sm: 'h-[0.9em]', md: 'h-[0.88em]', lg: 'h-[0.88em]' };
  return (
    <span className={`inline-flex items-baseline font-semibold tracking-tight font-survey-space-grotesk ${sizeMap[size]}`}>
      <svg
        className={`${svgH[size]} w-auto inline-block align-baseline mr-[-0.04em]`}
        viewBox="3 1 18 22"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      >
        <path d="M6 21L12 3L18 21" />
        <circle cx="12" cy="3" r="1.6" fill="rgba(129,140,248,0.55)" stroke="none" />
      </svg>
      <span>xiom</span>
    </span>
  );
}
