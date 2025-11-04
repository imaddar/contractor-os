import React from 'react';

export type IconName =
  | 'home'
  | 'projects'
  | 'calendar'
  | 'budget'
  | 'team'
  | 'ai'
  | 'plus'
  | 'document'
  | 'upload'
  | 'chat'
  | 'progress'
  | 'timeline'
  | 'handshake'
  | 'warning'
  | 'close'
  | 'arrow-left'
  | 'arrow-right'
  | 'clock'
  | 'tasks'
  | 'info';

type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps: Partial<IconProps> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

const icons: Record<IconName, (props: IconProps) => React.JSX.Element> = {
  home: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5V19h12v-8.5" />
      <path d="M10 19v-4.5h4V19" />
    </svg>
  ),
  projects: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <rect x="4.5" y="4" width="15" height="16" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h5" />
      <path d="M8 16h3" />
    </svg>
  ),
  calendar: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
      <path d="M3.5 9.5h17" />
      <rect x="8" y="12" width="3" height="3" rx="0.5" />
      <rect x="13" y="12" width="3" height="3" rx="0.5" />
    </svg>
  ),
  budget: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8v8" />
      <path d="M9.5 9.75C10.25 9 11 8.5 12.25 8.5c2 0 2.75 2.5.5 3.5l-2.5 1c-2.25 0.75-1.5 3.5.75 3.5 1.25 0 2-.5 2.75-1.25" />
    </svg>
  ),
  team: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="10.5" r="2.5" />
      <path d="M4.5 19c.75-3 2.75-5 5-5s4.25 2 5 5" />
      <path d="M14.5 18.75c.5-1.75 1.75-3.25 3.75-3.25 1 0 1.75.25 2.5.75" />
    </svg>
  ),
  ai: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M8.75 5.75 12 3l3.25 2.75" />
      <path d="M5.75 8.75 3 12l2.75 3.25" />
      <path d="M18.25 8.75 21 12l-2.75 3.25" />
      <path d="M8.75 18.25 12 21l3.25-2.75" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  plus: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </svg>
  ),
  document: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M7 3.5h7.5L20 9v11.5H7z" />
      <path d="M14.5 3.5v5.5H20" />
      <path d="M10 12.5h5" />
      <path d="M10 16h5" />
    </svg>
  ),
  upload: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 19a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5v1.5H4.5z" />
    </svg>
  ),
  chat: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M6.5 18.5 3 21l.5-4A7.5 7.5 0 0 1 10.5 5h3a7.5 7.5 0 0 1 6.5 11.5" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14h4" />
    </svg>
  ),
  progress: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 11.5 11 14l4-4.5" />
    </svg>
  ),
  timeline: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="8" cy="6" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="16" cy="18" r="1.5" />
    </svg>
  ),
  handshake: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="m5 9 5-3 3.5 2.5L18 6l3 3.5-5 4.5" />
      <path d="M8 13.5 5 11l-2 4.5L7 19h5l2.5-2.5" />
      <path d="m11 14 2 2 3.5-3.5" />
    </svg>
  ),
  warning: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 4 3 19h18z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  ),
  close: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  ),
  'arrow-left': (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="m11 6-6 6 6 6" />
      <path d="M20 12H6" />
    </svg>
  ),
  'arrow-right': (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="m13 6 6 6-6 6" />
      <path d="M4 12h14" />
    </svg>
  ),
  clock: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  ),
  tasks: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <rect x="4.5" y="4" width="15" height="16" rx="2" />
      <path d="m8 9 1.5 1.5L13 7" />
      <path d="M8 13h8" />
      <path d="M8 16h5" />
    </svg>
  ),
  info: (props) => (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r=".5" fill="currentColor" stroke="none" />
    </svg>
  )
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<Props> = ({
  name,
  size = 18,
  className,
  strokeWidth = 1.6
}) => {
  const Component = icons[name];
  if (!Component) {
    return null;
  }

  return (
    <Component
      width={size}
      height={size}
      className={className}
      strokeWidth={strokeWidth}
      role="img"
      aria-hidden="true"
      focusable="false"
    />
  );
};
