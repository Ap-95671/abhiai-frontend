"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
export function AuthenticatedImage({accessToken,mediaId,alt,className,thumbnail=false}:{accessToken:string;mediaId:string;alt:string;className?:string;thumbnail?:boolean}){
 const [src,setSrc]=useState("");
 useEffect(()=>{let active=true;let url="";void api.getMediaBlob(accessToken,mediaId,thumbnail).then(blob=>{if(!active)return;url=URL.createObjectURL(blob);setSrc(url);}).catch(()=>setSrc(""));return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[accessToken,mediaId,thumbnail]);
 if(!src)return <div className={`${className ?? ""} media-placeholder`} aria-label={`Loading ${alt}`} />;
 // Protected blob URLs cannot use the Next image optimizer.
 // eslint-disable-next-line @next/next/no-img-element
 return <img alt={alt} className={className} loading="lazy" src={src}/>;
}
