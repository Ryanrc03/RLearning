import type { SVGProps } from "react";

export type IconName = "book" | "home" | "code" | "layers" | "brain" | "cpu" | "arrow" | "chevron" | "calendar" | "clock" | "menu" | "close" | "leaf" | "github" | "sun";

const paths: Record<IconName, React.ReactNode> = {
  book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/></>,
  home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
  code: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-7-2 8"/></>,
  layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
  brain: <><path d="M9 18c-4 1-7-2-5-5-3-3-1-6 2-6-1-4 5-5 6-2 1-3 7-2 6 2 3 0 5 3 2 6 2 3-1 6-5 5-1 4-5 4-6 0Z"/><path d="M12 5v13M7 10c3 0 3 3 3 3m7-3c-3 0-3 3-3 3"/></>,
  cpu: <><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/><rect x="9" y="9" width="6" height="6" rx="1"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18M8 14h2m4 0h2m-8 3h2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  leaf: <><path d="M20 3c1 12-3 17-10 15-7-2-5-11 2-12 4 0 6-1 8-3Z"/><path d="M4 21c2-6 6-9 11-12"/></>,
  github: <><path d="M9 19c-5 2-5-3-7-3m14 6v-4c0-1-.3-2-1-2 4-.5 6-2 6-6 0-2-.6-3-2-4 .3-1 .3-2 0-3-2 0-3 1-4 2a15 15 0 0 0-6 0C8 4 7 3 5 3c-.3 1-.3 2 0 3-1.4 1-2 2-2 4 0 4 2 5.5 6 6-.7.6-1 1-1 2v4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
};

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
