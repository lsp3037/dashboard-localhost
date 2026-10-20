import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const BASE: IconProps = {
  'aria-hidden': true,
  focusable: false,
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function SearchIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ScanIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <rect x="9" y="9" width="10" height="10" />
      <path d="M15 9V5H5v10h4" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M4 6h5l2 2h9v10H4V6Z" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M14 5h5v5M19 5l-7 7" />
      <path d="M18 14v5H5V6h5" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M5 7h9M18 7h1M5 17h4M13 17h6" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="11" cy="17" r="2" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17.5v.5" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M4 4l16 16" />
      <path d="M9.5 5.6A9.6 9.6 0 0 1 12 5c5 0 9 5.5 9 7a12 12 0 0 1-2.4 3.3M6.2 7.4C3.9 9.1 3 11.4 3 12c0 1.5 4 7 9 7a9 9 0 0 0 3.4-.7" />
      <path d="M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 12c0-1.5 4-7 9-7s9 5.5 9 7-4 7-9 7-9-5.5-9-7Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...BASE} {...props} className={`animate-spin ${props.className ?? ''}`}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
