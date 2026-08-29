"use client";

import { useState } from "react";

export function NewsImage({ alt, className, src }: { alt: string; className?: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div aria-hidden="true" className={`${className ?? ""} news-image-placeholder`}><span>ABHIAI NEWS</span></div>;
  return (
    // Third-party news hosts are dynamic; the backend has already restricted this to HTTP(S) URLs.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={src} />
  );
}
