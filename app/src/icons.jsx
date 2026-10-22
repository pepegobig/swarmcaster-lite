// Stroke icons, 24-unit grid, drawn for this app. They inherit currentColor.
const Icon = ({ children, size = 22, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const HomeIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </Icon>
);
export const SeatsIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
);
export const AppsIcon = (p) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="2.6" />
    <circle cx="17" cy="7" r="2.6" />
    <circle cx="7" cy="17" r="2.6" />
    <path d="M17 13.5v7M13.5 17h7" />
  </Icon>
);
export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);
export const ExternalIcon = (p) => (
  <Icon size={16} {...p}>
    <path d="M14 5h5v5" />
    <path d="M19 5 11 13" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
);
export const LinkIcon = (p) => (
  <Icon size={16} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
