"use client";

import { useEffect, useState } from "react";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { api, MediaAsset } from "@/lib/api";
import { ImageLightbox } from "@/components/ui/image-lightbox";

export function PostAttachment({ accessToken, asset }: { accessToken: string; asset: MediaAsset }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  useEffect(() => {
    if (asset.kind !== "VIDEO") return;
    let active = true; let url = "";
    void api.getMediaBlob(accessToken, asset.id).then((blob) => { if (!active) return; url = URL.createObjectURL(blob); setVideoUrl(url); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [accessToken, asset.id, asset.kind]);
  async function download() {
    setBusy(true);
    try { const blob = await api.getMediaBlob(accessToken, asset.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = asset.originalFilename; anchor.click(); URL.revokeObjectURL(url); }
    finally { setBusy(false); }
  }
  if (asset.kind === "IMAGE") return <><button aria-label={`Enlarge ${asset.originalFilename}`} className="post-media-open" onClick={() => setImageOpen(true)} type="button"><AuthenticatedImage accessToken={accessToken} alt={asset.originalFilename} className="post-media-image" mediaId={asset.id} thumbnail/></button><ImageLightbox onClose={() => setImageOpen(false)} open={imageOpen} title={asset.originalFilename}><AuthenticatedImage accessToken={accessToken} alt={asset.originalFilename} mediaId={asset.id}/></ImageLightbox></>;
  if (asset.kind === "VIDEO") return videoUrl ? <video className="post-media-video" controls playsInline preload="metadata" src={videoUrl}/> : <div className="post-media-video media-placeholder">Loading video…</div>;
  return <button className="document-attachment" disabled={busy} onClick={() => void download()} type="button"><span>PDF</span><strong>{asset.originalFilename}</strong><small>{(asset.byteSize / 1024 / 1024).toFixed(1)} MB · {busy ? "Preparing…" : "Download"}</small></button>;
}
