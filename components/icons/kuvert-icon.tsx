type KuvertIconProps = {
  className?: string;
};

export function KuvertIcon({ className }: KuvertIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(12 12) scale(1.14) translate(-12 -12)">
        <path
          d="M3.75 8.25c0-1.24 1.01-2.25 2.25-2.25h9.75c1.24 0 2.25 1.01 2.25 2.25v7.5c0 1.24-1.01 2.25-2.25 2.25H6c-1.24 0-2.25-1.01-2.25-2.25v-7.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m4.5 7.5 6.38 4.65c.67.49 1.58.49 2.24 0l4.13-3.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="17.25"
          cy="16.75"
          r="3.25"
          fill="var(--nav-icon-coin-fill, currentColor)"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M17.25 14.95v3.6M15.95 16.75h2.6"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
