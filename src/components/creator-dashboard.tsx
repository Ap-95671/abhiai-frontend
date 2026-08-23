"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, CreatorAnalytics } from "@/lib/api";
import styles from "./creator-dashboard.module.css";
type Props={accessToken:string;onUnauthorized:()=>void};
const compact=(value:number)=>new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(value);
const shortDate=(value:string)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(`${value}T00:00:00Z`));
export function CreatorDashboard({accessToken,onUnauthorized}:Props){
 const [days,setDays]=useState(30);const [data,setData]=useState<CreatorAnalytics|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{setData(await api.getCreatorAnalytics(accessToken,days));}catch(e){if(e instanceof ApiError&&e.status===401)return onUnauthorized();setError(e instanceof Error?e.message:"Analytics could not be loaded.");}finally{setLoading(false);}},[accessToken,days,onUnauthorized]);
 useEffect(()=>{queueMicrotask(()=>void load());},[load]);
 const max=useMemo(()=>Math.max(1,...(data?.daily.map(item=>Math.max(item.impressions,item.profileViews))??[])),[data]);
 return <section className={styles.workspace} aria-label="Creator analytics">
  <header className={styles.header}><div><p className="eyebrow">Creator Studio</p><h1>Your impact, clearly measured.</h1><p>Daily aggregates help you understand reach without collecting unnecessary personal data.</p></div><label>Time range<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></header>
  {error&&<p className="form-error">{error}</p>}{loading&&!data&&<p className={styles.empty}>Preparing your analytics…</p>}
  {data&&<><div className={styles.metrics}>
   <article><span>Post impressions</span><strong>{compact(data.impressions)}</strong><small>{compact(data.uniquePostViewers)} daily unique viewers</small></article>
   <article><span>Profile views</span><strong>{compact(data.profileViews)}</strong><small>{compact(data.uniqueProfileViewers)} unique views</small></article>
   <article><span>Engagement rate</span><strong>{data.engagementRate.toFixed(2)}%</strong><small>{compact(data.engagements)} interactions</small></article>
   <article><span>Follower growth</span><strong>{data.followerGrowth>=0?"+":""}{compact(data.followerGrowth)}</strong><small>{compact(data.totalFollowers)} total followers</small></article>
  </div>
  <article className={styles.panel}><div className={styles.panelHead}><div><p className="eyebrow">Reach over time</p><h2>Content and profile discovery</h2></div><div className={styles.legend}><span><i className={styles.blue}/>Impressions</span><span><i className={styles.violet}/>Profile views</span></div></div>
   <div className={styles.chart}>{data.daily.map((item,index)=><div className={styles.day} key={item.date} title={`${item.date}: ${item.impressions} impressions, ${item.profileViews} profile views`}><div className={styles.bars}><i className={styles.impressions} style={{height:`${Math.max(2,item.impressions/max*100)}%`}}/><i className={styles.profiles} style={{height:`${Math.max(2,item.profileViews/max*100)}%`}}/></div>{(data.days<=7||index%Math.ceil(data.days/7)===0)&&<small>{shortDate(item.date)}</small>}</div>)}</div>
  </article>
  <div className={styles.columns}><article className={styles.panel}><p className="eyebrow">Performance</p><h2>Top posts</h2><div className={styles.list}>{data.topPosts.map((post,index)=><div key={post.postId}><b>{index+1}</b><span><strong>{post.textContent}</strong><small>{compact(post.impressions)} impressions · {post.engagementRate.toFixed(1)}% engagement</small></span></div>)}{!data.topPosts.length&&<p className={styles.empty}>Post insights appear after your content is viewed.</p>}</div></article>
   <article className={styles.panel}><p className="eyebrow">Audience</p><h2>Top locations</h2><div className={styles.locations}>{data.audienceLocations.map(item=><div key={item.location}><span>{item.location}<small>{compact(item.count)} followers</small></span><strong>{item.percentage.toFixed(1)}%</strong><i><b style={{width:`${item.percentage}%`}}/></i></div>)}{!data.audienceLocations.length&&<p className={styles.empty}>Audience insights appear as your community grows.</p>}</div></article></div></>}
 </section>;
}
