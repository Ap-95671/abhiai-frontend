"use client";

import { SelectControl } from "@/components/chat/tool-menu";

import { useCallback, useEffect, useMemo, useState, useId, useRef } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { api, ApiError, CreatorAnalytics, CreatorDailyMetric } from "@/lib/api";
import styles from "./creator-dashboard.module.css";

type Props = { accessToken: string; onUnauthorized: () => void };

const compact = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00Z`));

function chartPoints(items: CreatorDailyMetric[], key: "impressions" | "profileViews", max: number, width: number) {
  return items.map((item, index) => ({
    x: items.length === 1 ? (width + 28) / 2 : 44 + index * ((width - 60) / (items.length - 1)),
    y: 322 - (item[key] / max) * 290,
    value: item[key],
    item,
  }));
}

function AnalyticsChart({ data }: { data: CreatorAnalytics }) {
  const [active, setActive] = useState<number | null>(null);
  const tooltipId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [data.daily.length]);
  const activeIndex = active === null ? null : Math.min(active, data.daily.length - 1);
  const max = Math.max(1, ...data.daily.flatMap((item) => [item.impressions, item.profileViews]));
  const impressions = chartPoints(data.daily, "impressions", max, width);
  const profiles = chartPoints(data.daily, "profileViews", max, width);
  const line = (points: typeof impressions) => points.map((point, index) => {
    if (!index) return `M${point.x},${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
  }).join(" ");
  const labelStep = Math.max(1, Math.ceil(data.daily.length / Math.max(2, Math.floor(width / 95))));

  if (!data.daily.length) return <p className={styles.empty}>Daily analytics appear after your content receives activity.</p>;

  return <div className={styles.chartWrap} ref={container}>
    <svg aria-label="Line chart of impressions and profile views" className={styles.chart} role="img" tabIndex={0} aria-describedby={tooltipId} viewBox={`0 0 ${width} 360`}
      onPointerMove={event => { const rect=event.currentTarget.getBoundingClientRect(); const x=(event.clientX-rect.left)/rect.width*width; setActive(Math.max(0,Math.min(data.daily.length-1,Math.round((x-44)/(width-60)*(data.daily.length-1))))); }}
      onPointerDown={event => { const rect=event.currentTarget.getBoundingClientRect(); const x=(event.clientX-rect.left)/rect.width*width; setActive(Math.max(0,Math.min(data.daily.length-1,Math.round((x-44)/(width-60)*(data.daily.length-1))))); }}
      onPointerLeave={() => setActive(null)} onFocus={() => setActive(0)} onBlur={() => setActive(null)}
      onKeyDown={event => { if(event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setActive(Math.max(0,Math.min(data.daily.length-1,(activeIndex??0)+(event.key === "ArrowRight"?1:-1)))); } }}>
      {[0, 1, 2, 3, 4].map((index) => { const y = 32 + index * 72.5; return <g className={styles.gridLine} key={index}><line x1="44" x2={width - 16} y1={y} y2={y}/><text x="36" y={y + 4}>{compact(Math.round(max * (1 - index / 4)))}</text></g>; })}
      {<><path className={styles.impressionLine} d={line(impressions)}/><path className={styles.profileLine} d={line(profiles)}/>{activeIndex !== null && impressions[activeIndex] && <g><line className={styles.cursorLine} x1={impressions[activeIndex].x} x2={impressions[activeIndex].x} y1="24" y2="322"/><circle className={styles.impressionPoint} cx={impressions[activeIndex].x} cy={impressions[activeIndex].y} r="4"/><circle className={styles.profilePoint} cx={profiles[activeIndex].x} cy={profiles[activeIndex].y} r="4"/></g>}</>}
      {data.daily.map((item, index) => (index % labelStep === 0 || (index === data.daily.length - 1 && index % labelStep > labelStep / 2)) && <text className={styles.axisLabel} key={item.date} textAnchor="middle" x={impressions[index].x} y="350">{shortDate(item.date)}</text>)}
    </svg>
    <div id={tooltipId} className={activeIndex !== null ? styles.chartTooltip : styles.chartHint} aria-live="polite">{activeIndex !== null && data.daily[activeIndex]
      ? <><strong>{shortDate(data.daily[activeIndex].date)}</strong><span>{data.daily[activeIndex].impressions.toLocaleString()} impressions</span><span>{data.daily[activeIndex].profileViews.toLocaleString()} profile views</span></>
      : "Hover, tap, or use arrow keys to explore daily values."}</div>
  </div>;
}

export function CreatorDashboard({ accessToken, onUnauthorized }: Props) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await api.getCreatorAnalytics(accessToken, days)); } catch (loadError) { if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized(); setError(loadError instanceof Error ? loadError.message : "Analytics could not be loaded."); } finally { setLoading(false); } }, [accessToken, days, onUnauthorized]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const trendLabel = useMemo(() => data ? `${shortDate(data.from)} – ${shortDate(data.to)}` : "Loading range", [data]);

  return <section aria-label="Creator analytics" className={styles.workspace}>
    <header className={styles.header}><div><p className="eyebrow">Overview</p><h1>Creator Studio</h1><p>Track your reach, engagement, and audience.</p></div><label>Time range<SelectControl aria-label="Analytics time range" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></SelectControl></label></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !data && <div aria-label="Loading creator analytics" className={styles.loading} role="status"><span/><span/><span/><span/></div>}
    {data && <>
      <div aria-busy={loading} className={styles.metrics}><article><span><i><AppIcon name="eye" /></i>Post impressions</span><strong>{compact(data.impressions)}</strong><small>{compact(data.uniquePostViewers)} daily unique viewers</small></article><article><span><i><AppIcon name="profile" /></i>Profile views</span><strong>{compact(data.profileViews)}</strong><small>{compact(data.uniqueProfileViewers)} unique views</small></article><article><span><i><AppIcon name="heart" /></i>Engagement rate</span><strong>{data.engagementRate.toFixed(2)}%</strong><small>{compact(data.engagements)} interactions</small></article><article><span><i><AppIcon name="community" /></i>Follower growth</span><strong>{data.followerGrowth >= 0 ? "+" : ""}{compact(data.followerGrowth)}</strong><small>{compact(data.totalFollowers)} total followers</small></article></div>
      <div className={styles.analyticsGrid} aria-busy={loading}>
      <article className={styles.panel}><div className={styles.panelHead}><div><p className="eyebrow">Reach over time</p><h2>Discovery over time</h2><small>{trendLabel}</small></div><div className={styles.chartControls}><div className={styles.legend}><span><i className={styles.blue}/>Impressions</span><span><i className={styles.violet}/>Profile views</span></div></div></div><AnalyticsChart data={data}/></article>
      <DiscoveryMix data={data} />
      </div>
      <div className={styles.columns}><article className={styles.panel}><p className="eyebrow">Performance</p><h2>Top posts</h2><div className={styles.list}>{data.topPosts.map((post, index) => <div key={post.postId}><b>{index + 1}</b><span><strong title={post.textContent}>{post.textContent || "Media post"}</strong><small>{compact(post.impressions)} impressions · {compact(post.engagements)} interactions · {post.engagementRate.toFixed(1)}% engagement</small><i className={styles.performanceTrack}><i style={{ width: `${Math.max(0, Math.min(100, post.impressions / Math.max(1, ...data.topPosts.map(item => item.impressions)) * 100))}%` }} /></i></span></div>)}{!data.topPosts.length && <p className={styles.empty}>Post insights appear after your content is viewed.</p>}</div></article><article className={styles.panel}><p className="eyebrow">Audience</p><h2>Top locations</h2><div className={styles.locations}>{data.audienceLocations.map((item) => <div key={item.location}><span>{item.location}<small>{compact(item.count)} followers</small></span><strong>{item.percentage.toFixed(1)}%</strong><i><b style={{ width: `${Math.max(0, Math.min(100, item.percentage))}%` }}/></i></div>)}{!data.audienceLocations.length && <p className={styles.empty}>Audience insights appear as your community grows.</p>}</div></article></div>
    </>}
  </section>;
}

function DiscoveryMix({ data }: { data: CreatorAnalytics }) {
  const total = data.impressions + data.profileViews;
  const impressionShare = total > 0 ? data.impressions / total * 100 : 0;
  const profileShare = total > 0 ? data.profileViews / total * 100 : 0;
  return <article className={`${styles.panel} ${styles.mixPanel}`}>
    <p className="eyebrow">Breakdown</p><h2>Discovery mix</h2>
    {total > 0 ? <>
      <div className={styles.ringWrap}>
        <svg viewBox="0 0 200 200" role="img" aria-label={`${data.impressions.toLocaleString()} post impressions and ${data.profileViews.toLocaleString()} profile views`}>
          <circle className={styles.ringTrack} cx="100" cy="100" r="78" />
          <circle className={styles.ringImpressions} cx="100" cy="100" r="78" pathLength="100" strokeDasharray={`${impressionShare} ${100 - impressionShare}`} transform="rotate(-90 100 100)" />
          <circle className={styles.ringProfiles} cx="100" cy="100" r="78" pathLength="100" strokeDasharray={`${profileShare} ${100 - profileShare}`} strokeDashoffset={-impressionShare} transform="rotate(-90 100 100)" />
        </svg>
        <div><strong>{compact(total)}</strong><span>discovery events</span></div>
      </div>
      <dl className={styles.mixLegend}>
        <div><dt><i className={styles.blue}/>Post impressions</dt><dd>{compact(data.impressions)}<small>{impressionShare.toFixed(1)}%</small></dd></div>
        <div><dt><i className={styles.violet}/>Profile views</dt><dd>{compact(data.profileViews)}<small>{profileShare.toFixed(1)}%</small></dd></div>
      </dl>
      <p className={styles.mixNote}>Impressions and profile visits, not unique people.</p>
    </> : <p className={styles.empty}>Discovery insights appear when your posts or profile receive views.</p>}
  </article>;
}
