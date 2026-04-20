type LogoProps = {
  size?: number
  className?: string
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 320"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Cookmate"
    >
      <circle cx="160" cy="160" r="128" fill="none" stroke="currentColor" strokeWidth="14" />
      <g transform="rotate(45 160 160)" fill="currentColor">
        <rect x="118" y="60" width="6" height="44" rx="3" />
        <rect x="130" y="60" width="6" height="44" rx="3" />
        <rect x="142" y="60" width="6" height="44" rx="3" />
        <rect x="116" y="100" width="34" height="12" rx="6" />
        <rect x="127" y="108" width="12" height="152" rx="6" />
        <ellipse cx="195" cy="88" rx="22" ry="32" />
        <rect x="189" y="116" width="12" height="144" rx="6" />
      </g>
    </svg>
  )
}
