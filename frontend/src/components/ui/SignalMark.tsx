export function SignalMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Signal-style message mark"
    >
      <path
        d="M24 5C13.507 5 5 12.832 5 22.5c0 5.403 2.711 10.22 6.98 13.44L10.5 43l8.5-3.17c1.61.435 3.284.67 5 .67 10.493 0 19-7.832 19-17.5S34.493 5 24 5Z"
        fill="currentColor"
      />
      <path
        d="M15 23.5h18M18 17.5h12M18 29.5h8"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
