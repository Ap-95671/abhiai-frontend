"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError, CreatorAnalytics, CreatorDailyMetric } from "@/lib/api";
import styles from "./creator-dashboard.module.css";

type Props = { accessToken: string; onUnauthorized: () => void };
type ChartType = "line" | "bar" | "area";

const compact = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00Z`));

function chartPoints(items: CreatorDailyMetric[], key: "impressions" | "profileViews", max: number) {
  return items.map((item, index) => ({
    x: items.length === 1 ? 380 : 24 + index * (712 / (items.length - 1)),
    y: 222 - (item[key] / max) * 190,
    value: item[key],
    item,
  }));
}

function AnalyticsChart({ data, type }: { data: CreatorAnalytics; type: ChartType }) {
  const max = Math.max(1, ...data.daily.flatMap((item) => [item.impressions, item.profileViews]));
  const impressions = chartPoints(data.daily, "impressions", max);
  const profiles = chartPoints(data.daily, "profileViews", max);
  const line = (points: typeof impressions) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = (points: typeof impressions) => points.length ? `${line(points)} L${points.at(-1)?.x},222 L${points[0].x},222 Z` : "";
  const labelStep = Math.max(1, Math.ceil(data.daily.length / 7));

  if (!data.daily.length) return <p className={styles.empty}>Daily analytics appear after your content receives activity.</p>;

  return <div className={styles.chartWrap}>
    <svg aria-label={`${type} chart of impressions and profile views`} className={styles.chart} role="img" viewBox="0 0 760 260">
      {[0, 1, 2, 3, 4].map((index) => { const y = 32 + index * 47.5; return <g className={styles.gridLine} key={index}><line x1="24" x2="736" y1={y} y2={y}/><text x="18" y={y + 4}>{compact(Math.round(max * (1 - index / 4)))}</text></g>; })}
      {type === "bar" && impressions.map((point, index) => { const width = Math.max(5, Math.min(20, 610 / data.daily.length)); const profile = profiles[index]; return <g key={point.item.date}><rect className={styles.impressionBar} height={222 - point.y} rx="3" width={width / 2} x={point.x - width / 2} y={point.y}><title>{`${shortDate(point.item.date)}: ${point.value} impressions`}</title></rect><rect className={styles.profileBar} height={222 - profile.y} rx="3" width={width / 2} x={point.x} y={profile.y}><title>{`${shortDate(profile.item.date)}: ${profile.value} profile views`}</title></rect></g>; })}
      {type === "area" && <><path className={styles.impressionArea} d={area(impressions)}/><path className={styles.profileArea} d={area(profiles)}/></>}
      {type !== "bar" && <><path className={styles.impressionLine} d={line(impressions)}/><path className={styles.profileLine} d={line(profiles)}/>{impressions.map((point, index) => <g key={point.item.date}><circle className={styles.impressionPoint} cx={point.x} cy={point.y} r="4"><title>{`${shortDate(point.item.date)}: ${point.value} impressions`}</title></circle><circle className={styles.profilePoint} cx={profiles[index].x} cy={profiles[index].y} r="4"><title>{`${shortDate(point.item.date)}: ${profiles[index].value} profile views`}</title></circle></g>)}</>}
      {data.daily.map((item, index) => (index % labelStep === 0 || index === data.daily.length - 1) && <text className={styles.axisLabel} key={item.date} textAnchor="middle" x={impressions[index].x} y="250">{shortDate(item.date)}</text>)}
    </svg>
  </div>;
}

export function CreatorDashboard({ accessToken, onUnauthorized }: Props) {
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [data, setData] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await api.getCreatorAnalytics(accessToken, days)); } catch (loadError) { if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized(); setError(loadError instanceof Error ? loadError.message : "Analytics could not be loaded."); } finally { setLoading(false); } }, [accessToken, days, onUnauthorized]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const trendLabel = useMemo(() => data ? `${shortDate(data.from)} – ${shortDate(data.to)}` : "Loading range", [data]);

  return <section aria-label="Creator analytics" className={styles.workspace}>
    <header className={styles.header}><div><p className="eyebrow">Creator Studio</p><h1>Your impact, clearly measured.</h1><p>Understand reach, engagement, and audience growth from real activity on AbhiAI.</p></div><label>Time range<select aria-label="Analytics time range" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !data && <div aria-label="Loading creator analytics" className={styles.loading} role="status"><span/><span/><span/><span/></div>}
    {data && <>
      <div aria-busy={loading} className={styles.metrics}><article><span>Post impressions</span><strong>{compact(data.impressions)}</strong><small>{compact(data.uniquePostViewers)} daily unique viewers</small></article><article><span>Profile views</span><strong>{compact(data.profileViews)}</strong><small>{compact(data.uniqueProfileViewers)} unique views</small></article><article><span>Engagement rate</span><strong>{data.engagementRate.toFixed(2)}%</strong><small>{compact(data.engagements)} interactions</small></article><article><span>Follower growth</span><strong>{data.followerGrowth >= 0 ? "+" : ""}{compact(data.followerGrowth)}</strong><small>{compact(data.totalFollowers)} total followers</small></article></div>
      <article className={styles.panel}><div className={styles.panelHead}><div><p className="eyebrow">Reach over time</p><h2>Content and profile discovery</h2><small>{trendLabel}</small></div><div className={styles.chartControls}><div aria-label="Chart type" className={styles.segmented} role="group">{(["line", "bar", "area"] as ChartType[]).map((type) => <button aria-pressed={chartType === type} key={type} onClick={() => setChartType(type)} type="button">{type}</button>)}</div><div className={styles.legend}><span><i className={styles.blue}/>Impressions</span><span><i className={styles.violet}/>Profile views</span></div></div></div><AnalyticsChart data={data} type={chartType}/></article>
      <div className={styles.columns}><article className={styles.panel}><p className="eyebrow">Performance</p><h2>Top posts</h2><div className={styles.list}>{data.topPosts.map((post, index) => <div key={post.postId}><b>{index + 1}</b><span><strong>{post.textContent}</strong><small>{compact(post.impressions)} impressions · {post.engagementRate.toFixed(1)}% engagement</small></span></div>)}{!data.topPosts.length && <p className={styles.empty}>Post insights appear after your content is viewed.</p>}</div></article><article className={styles.panel}><p className="eyebrow">Audience</p><h2>Top locations</h2><div className={styles.locations}>{data.audienceLocations.map((item) => <div key={item.location}><span>{item.location}<small>{compact(item.count)} followers</small></span><strong>{item.percentage.toFixed(1)}%</strong><i><b style={{ width: `${item.percentage}%` }}/></i></div>)}{!data.audienceLocations.length && <p className={styles.empty}>Audience insights appear as your community grows.</p>}</div></article></div>
    </>}
  </section>;
}
