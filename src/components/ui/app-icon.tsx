import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "ai"
  | "article"
  | "bell"
  | "chevron-left"
  | "chevron-right"
  | "community"
  | "create"
  | "explore"
  | "feed"
  | "hash"
  | "image"
  | "bookmark"
  | "globe"
  | "heart"
  | "menu"
  | "message"
  | "more"
  | "plus"
  | "profile"
  | "poll"
  | "reply"
  | "repost"
  | "search"
  | "share"
  | "send"
  | "social"
  | "story"
  | "sun"
  | "moon"
  | "video";

const paths: Record<AppIconName, ReactNode> = {
  ai: <><path d="M12 2.75 14.1 8l5.15 2.1L14.1 12.2 12 17.25 9.9 12.2 4.75 10.1 9.9 8 12 2.75Z"/><path d="m18.2 16 .8 2 .8-2 2-.8-2-.8-.8-2-.8 2-2 .8 2 .8Z"/></>,
  article: <><path d="M6 3.5h9.5L19 7v13.5H6z"/><path d="M15.5 3.5V7H19M9 11h7M9 14h7M9 17h5"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z"/><path d="M9.5 21h5"/></>,
  "chevron-left": <path d="m15 18-6-6 6-6"/>,
  "chevron-right": <path d="m9 18 6-6-6-6"/>,
  community: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2.5"/><path d="M2.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6M14 14c4.4-.5 6.8 1.5 7.5 5"/></>,
  create: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
  explore: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
  feed: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
  hash: <><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></>,
  bookmark: <path d="M6 4.5h12v16l-6-4-6 4v-16Z"/>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21"/></>,
  heart: <path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"/>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  message: <><path d="M4 5h16v12H8l-4 4V5Z"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.5-5 3-7 7.5-7s7 2 7.5 7"/></>,
  poll: <><path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/></>,
  reply: <path d="m9 8-5 4 5 4v-3h4.5c3 0 5 1.5 6.5 4.5-.5-5-2.7-7.5-6.5-7.5H9V8Z"/>,
  repost: <><path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></>,
  send: <><path d="m4 12 16-8-5 16-3-6-8-2Z"/><path d="m12 14 8-10"/></>,
  social: <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></>,
  story: <><circle cx="12" cy="12" r="8"/><path d="M9 9.5 15.5 12 9 14.5v-5Z"/></>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
  moon: <path d="M20.2 15.2A8.2 8.2 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"/>,
  video: <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2"/></>,
};

export function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AppIconName }) {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </g>
    </svg>
  );
}
