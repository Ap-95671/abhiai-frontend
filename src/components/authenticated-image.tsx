"use client";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
export function AuthenticatedImage({accessToken,mediaId,alt,className,thumbnail=false,fallback=null}:{accessToken:string;mediaId:string;alt:string;className?:string;thumbnail?:boolean;fallback?:ReactNode}){
 const [loaded,setLoaded]=useState({mediaId:"",src:""});
 const [failedMediaId,setFailedMediaId]=useState("");
 useEffect(()=>{let active=true;let url="";void api.getMediaBlob(accessToken,mediaId,thumbnail).then(blob=>{if(!active)return;url=URL.createObjectURL(blob);setLoaded({mediaId,src:url});}).catch(()=>{if(active)setFailedMediaId(mediaId);});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[accessToken,mediaId,thumbnail]);
 if(failedMediaId===mediaId)return <>{fallback}</>;
 if(loaded.mediaId!==mediaId||!loaded.src)return <div className={`${className ?? ""} media-placeholder`} aria-label={`Loading ${alt}`} />;
 // Protected blob URLs cannot use the Next image optimizer.
 // eslint-disable-next-line @next/next/no-img-element
 return <img alt={alt} className={className} loading="lazy" onError={()=>setFailedMediaId(mediaId)} src={loaded.src}/>;
}
