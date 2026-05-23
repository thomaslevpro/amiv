import { useId } from 'react'

export default function AmivHeartIcon({ size = 16, strokeWidth = 1.8, ...props }) {
  const reactId = useId().replace(/:/g, '')
  const gradientId = `amivHeartGrad-${reactId}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e055aa" />
          <stop offset="100%" stopColor="#f5a623" />
        </linearGradient>
      </defs>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
      />
    </svg>
  )
}
