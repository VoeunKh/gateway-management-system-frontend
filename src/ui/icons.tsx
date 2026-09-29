import type { ComponentChildren } from 'preact';

export interface IconProps {
  size?: number;
  /** Gives the icon an accessible name; without it the icon is decorative. */
  title?: string;
}

function makeIcon(shapes: ComponentChildren) {
  return function Icon({ size = 16, title }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : 'true'}
        focusable="false"
      >
        {title && <title>{title}</title>}
        {shapes}
      </svg>
    );
  };
}

export const IconGateway = makeIcon(
  <>
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 16.5h.01M11 16.5h.01M12 13V9M8.5 6.5a5 5 0 0 1 7 0M6 4a8.5 8.5 0 0 1 12 0" />
  </>,
);

export const IconSearch = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </>,
);

export const IconRefresh = makeIcon(
  <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />,
);

export const IconUpload = makeIcon(
  <path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
);

export const IconPlay = makeIcon(<path d="M7 4.5v15l12-7.5z" />);

export const IconPause = makeIcon(<path d="M9 5v14M15 5v14" />);

export const IconStop = makeIcon(<rect x="6" y="6" width="12" height="12" rx="1.5" />);

export const IconCheck = makeIcon(<path d="m5 12.5 4.5 4.5L19 7.5" />);

export const IconWarning = makeIcon(
  <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01" />,
);

export const IconClock = makeIcon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const IconUser = makeIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </>,
);

export const IconChevron = makeIcon(<path d="m9 6 6 6-6 6" />);

export const ICONS = {
  gateway: IconGateway,
  search: IconSearch,
  refresh: IconRefresh,
  upload: IconUpload,
  play: IconPlay,
  pause: IconPause,
  stop: IconStop,
  check: IconCheck,
  warning: IconWarning,
  clock: IconClock,
  user: IconUser,
  chevron: IconChevron,
} as const;
