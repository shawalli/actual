import type { SVGProps } from 'react';

export function GiftCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 32 32"
      style={{
        color: 'inherit',
        ...props.style,
      }}
    >
      <path
        d="M5 14h22v14H5zM3 9h26v5H3zM16 9v19M16 9h-5a3 3 0 1 1 3-5l2 5Zm0 0h5a3 3 0 1 0-3-5l-2 5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </svg>
  );
}
