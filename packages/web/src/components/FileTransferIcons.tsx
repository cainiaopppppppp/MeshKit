interface IconProps {
  className?: string;
}

interface FileTypeIconProps extends IconProps {
  type: string;
}

interface TransferStatusIconProps extends IconProps {
  status: string;
}

function createIconProps(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true as const,
  };
}

export function TransferInboxIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M5 15.75V17a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.25" />
      <path d="M12 4.5v10.5" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    </svg>
  );
}

export function QueueListIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="5" cy="6.75" r="0.75" />
      <circle cx="5" cy="12" r="0.75" />
      <circle cx="5" cy="17.25" r="0.75" />
      <path d="M8 6.75h11" />
      <path d="M8 12h11" />
      <path d="M8 17.25h11" />
    </svg>
  );
}

export function UserCircleIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path d="M7.5 18a5.5 5.5 0 0 1 9 0" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <rect x="6.75" y="10.25" width="10.5" height="8" rx="2" />
      <path d="M9 10.25v-2.5a3 3 0 1 1 6 0v2.5" />
      <path d="M12 13.5v1.75" />
    </svg>
  );
}

export function ShieldLockIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M12 3.5 18.25 6v5.25c0 4.2-2.55 7.46-6.25 9.25-3.7-1.79-6.25-5.05-6.25-9.25V6L12 3.5Z" />
      <path d="M9.75 10.75V9.5a2.25 2.25 0 1 1 4.5 0v1.25" />
      <rect x="8.75" y="10.75" width="6.5" height="4.75" rx="1.25" />
      <path d="M12 12.75v.75" />
    </svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="m12 4.75 8 14a1 1 0 0 1-.86 1.5H4.86a1 1 0 0 1-.86-1.5l8-14a1 1 0 0 1 1.74 0Z" />
      <path d="M12 9v4.25" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.25v5" />
      <circle cx="12" cy="7.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BanIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.25 15.75 7.5-7.5" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.25l3 1.75" />
    </svg>
  );
}

export function DeviceIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <rect x="7.25" y="3.5" width="9.5" height="17" rx="2.25" />
      <path d="M10.25 6.75h3.5" />
      <circle cx="12" cy="17.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M4.75 7.25h14.5" />
      <path d="M9.25 7.25V5.5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1.75" />
      <path d="m7.5 7.25.85 11a1.75 1.75 0 0 0 1.74 1.62h3.82a1.75 1.75 0 0 0 1.74-1.62l.85-11" />
      <path d="M10.25 11v5" />
      <path d="M13.75 11v5" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.75 12.25 2.25 2.25 4.75-5" />
    </svg>
  );
}

export function XCircleIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  );
}

export function MinusCircleIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

export function PackageIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M3.5 7.5 12 3.75l8.5 3.75L12 11.25 3.5 7.5Z" />
      <path d="M3.5 7.5v9L12 20.25l8.5-3.75v-9" />
      <path d="M12 11.25v9" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M8.25 3.75H14l4 4V18a2 2 0 0 1-2 2H8.25a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
      <path d="M14 3.75V8h4" />
      <path d="M9 12h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="m9.5 13.75 5.97-5.97a2.75 2.75 0 1 1 3.89 3.89l-7.74 7.74a4.25 4.25 0 0 1-6.01-6.01l8.1-8.1" />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.25" />
      <path d="m6.5 17 4.25-4.5 3 3 2.75-2.75L19.5 17" />
    </svg>
  );
}

export function VideoIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <rect x="4" y="6" width="12.5" height="12" rx="2" />
      <path d="m12.25 12-3 1.75v-3.5L12.25 12Z" fill="currentColor" stroke="none" />
      <path d="m16.5 10 3-2v8l-3-2" />
    </svg>
  );
}

export function AudioIcon({ className }: IconProps) {
  return (
    <svg {...createIconProps(className)}>
      <path d="M14.5 5.5v9.25" />
      <path d="m14.5 5.5 4.25-1.25v9.25" />
      <circle cx="11.25" cy="16.75" r="2.25" />
      <circle cx="18.75" cy="15.5" r="2" />
    </svg>
  );
}

export function FileTypeIcon({ type, className }: FileTypeIconProps) {
  if (type.startsWith('image/')) {
    return <ImageIcon className={className} />;
  }

  if (type.startsWith('video/')) {
    return <VideoIcon className={className} />;
  }

  if (type.startsWith('audio/')) {
    return <AudioIcon className={className} />;
  }

  if (type.includes('zip') || type.includes('rar')) {
    return <PackageIcon className={className} />;
  }

  return <DocumentIcon className={className} />;
}

export function TransferStatusIcon({ status, className }: TransferStatusIconProps) {
  switch (status) {
    case 'pending':
      return <ClockIcon className={className} />;
    case 'transferring':
      return <TransferInboxIcon className={className} />;
    case 'completed':
      return <CheckCircleIcon className={className} />;
    case 'skipped':
      return <MinusCircleIcon className={className} />;
    case 'failed':
      return <XCircleIcon className={className} />;
    default:
      return <DocumentIcon className={className} />;
  }
}
