"use client";
/* eslint-disable @next/next/no-img-element -- article covers are user-provided remote URLs */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError, Article, ArticleComment, ArticleDraft } from "@/lib/api";
import styles from "./articles-panel.module.css";
import { ReportButton } from "./report-button";

type Props={accessToken:string;onUnauthorized:()=>void;onViewProfile:(username?:string)=>void};
const emptyDraft:ArticleDraft={title:"",summary:"",coverImageUrl:null,content:""};
const message=(error:unknown)=>error instanceof Error?error.message:"Something went wrong.";
const date=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(value));

function FormattedArticle({content}:{content:string}){
  return <div className={styles.prose}>{content.split("\n").map((line,index)=>{
    if(line.startsWith("## "))return <h3 key={index}>{line.slice(3)}</h3>;
    if(line.startsWith("# "))return <h2 key={index}>{line.slice(2)}</h2>;
    if(line.startsWith("- "))return <div className={styles.bullet} key={index}>• {line.slice(2)}</div>;
    return line?<p key={index}>{line}</p>:<br key={index}/>;
  })}</div>;
}

export function ArticlesPanel({accessToken,onUnauthorized,onViewProfile}:Props){
  const [articles,setArticles]=useState<Article[]>([]); const [selected,setSelected]=useState<Article|null>(null);
  const [comments,setComments]=useState<ArticleComment[]>([]); const [draft,setDraft]=useState<ArticleDraft>(emptyDraft);
  const [currentUserId,setCurrentUserId]=useState("");
  const [comment,setComment]=useState(""); const [writing,setWriting]=useState(false); const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [page,setPage]=useState(0); const [last,setLast]=useState(true);

  const handleError=useCallback((value:unknown)=>{if(value instanceof ApiError&&value.status===401){onUnauthorized();return;}setError(message(value));},[onUnauthorized]);
  const load=useCallback(async(target=0,append=false)=>{setLoading(true);setError("");try{const [result,profile]=await Promise.all([api.getArticles(accessToken,target),api.getCurrentProfile(accessToken)]);setCurrentUserId(profile.id);setArticles(current=>append?[...current,...result.content]:result.content);setPage(result.page);setLast(result.last);}catch(e){handleError(e);}finally{setLoading(false);}},[accessToken,handleError]);
  useEffect(()=>{queueMicrotask(()=>void load());},[load]);

  async function open(article:Article){setError("");try{const [detail,replies]=await Promise.all([api.getArticle(accessToken,article.id),api.getArticleComments(accessToken,article.id)]);setSelected(detail);setComments(replies.content);}catch(e){handleError(e);}}
  async function publish(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const created=await api.createArticle(accessToken,{...draft,coverImageUrl:draft.coverImageUrl?.trim()||null});setArticles(current=>[created,...current]);setDraft(emptyDraft);setWriting(false);await open(created);}catch(e){handleError(e);}finally{setSaving(false);}}
  async function toggleLike(){if(!selected)return;try{const updated=await api.setArticleLike(accessToken,selected.id,!selected.likedByCurrentUser);setSelected(updated);setArticles(items=>items.map(item=>item.id===updated.id?updated:item));}catch(e){handleError(e);}}
  async function addComment(event:FormEvent){event.preventDefault();if(!selected||!comment.trim())return;try{const created=await api.createArticleComment(accessToken,selected.id,comment);setComments(items=>[...items,created]);setComment("");setSelected(item=>item?{...item,commentCount:item.commentCount+1}:item);setArticles(items=>items.map(item=>item.id===selected.id?{...item,commentCount:item.commentCount+1}:item));}catch(e){handleError(e);}}
  async function share(){if(!selected)return;try{const result=await api.shareArticle(accessToken,selected.id);const url=`${window.location.origin}/#article-${selected.id}`;await navigator.clipboard?.writeText(url);setSelected(item=>item?{...item,shareCount:result.shareCount}:item);setArticles(items=>items.map(item=>item.id===selected.id?{...item,shareCount:result.shareCount}:item));}catch(e){handleError(e);}}

  if(selected)return <section className={styles.workspace} aria-label="Article reader">
    <button className={styles.back} onClick={()=>setSelected(null)} type="button">← All articles</button>
    {selected.coverImageUrl&&<img className={styles.hero} src={selected.coverImageUrl} alt=""/>}
    <article className={styles.reader}>
      <p className="eyebrow">AbhiAI Article</p><h1>{selected.title}</h1><p className={styles.summary}>{selected.summary}</p>
      <button className={styles.author} onClick={()=>onViewProfile(selected.author.username)} type="button">{selected.author.displayName} · {date(selected.publishedAt)}</button>
      <FormattedArticle content={selected.content}/>
      <div className={styles.actions}>
        <button className={selected.likedByCurrentUser?styles.active:""} onClick={()=>void toggleLike()} type="button">♥ {selected.likeCount}</button>
        <span>💬 {selected.commentCount}</span><button onClick={()=>void share()} type="button">↗ Share · {selected.shareCount}</button>
      </div>
      <section className={styles.comments}><h2>Discussion</h2><form onSubmit={addComment}><textarea maxLength={2000} onChange={e=>setComment(e.target.value)} placeholder="Add a thoughtful comment…" value={comment}/><button disabled={!comment.trim()} type="submit">Comment</button></form>
        {comments.map(item=><article key={item.id}><button onClick={()=>onViewProfile(item.author.username)} type="button"><strong>{item.author.displayName}</strong> @{item.author.username}</button>{currentUserId!==item.author.id&&<ReportButton accessToken={accessToken} onUnauthorized={onUnauthorized} targetContext="ARTICLE_COMMENT" targetId={item.id} targetType="COMMENT"/>}<p>{item.content}</p></article>)}
        {!comments.length&&<p className={styles.empty}>Start the discussion.</p>}
      </section>
    </article>
  </section>;

  return <section className={styles.workspace} aria-label="Articles">
    <header className={styles.header}><div><p className="eyebrow">Long-form thinking</p><h1>AbhiAI Articles</h1><p>Publish deeper ideas, tutorials, research, and stories.</p></div><button onClick={()=>setWriting(value=>!value)} type="button">{writing?"Cancel":"✎ Write article"}</button></header>
    {writing&&<form className={styles.editor} onSubmit={publish}>
      <label>Title<input minLength={3} maxLength={180} required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      <label>Summary<textarea maxLength={320} required rows={2} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})}/></label>
      <label>Cover image URL <small>optional HTTPS image</small><input maxLength={2048} type="url" value={draft.coverImageUrl??""} onChange={e=>setDraft({...draft,coverImageUrl:e.target.value})}/></label>
      <label>Article content <small>Use # headings, ## subheadings, and - lists</small><textarea minLength={50} maxLength={50000} required rows={14} value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})}/></label>
      <footer><span>{draft.content.length.toLocaleString()}/50,000</span><button disabled={saving} type="submit">{saving?"Publishing…":"Publish article"}</button></footer>
    </form>}
    {error&&<p className="form-error">{error}</p>}
    <div className={styles.grid}>{articles.map(article=><article className={styles.card} key={article.id}>
      {article.coverImageUrl?<img src={article.coverImageUrl} alt=""/>:<div className={styles.placeholder}>A</div>}
      <div><p className="eyebrow">{date(article.publishedAt)}</p><h2>{article.title}</h2><p>{article.summary}</p><button className={styles.author} onClick={()=>onViewProfile(article.author.username)} type="button">By {article.author.displayName}</button><footer><span>♥ {article.likeCount} · 💬 {article.commentCount} · ↗ {article.shareCount}</span><button onClick={()=>void open(article)} type="button">Read article →</button></footer></div>
    </article>)}</div>
    {loading&&<p className={styles.empty}>Loading articles…</p>}{!loading&&!articles.length&&<p className={styles.empty}>No articles yet. Publish the first one.</p>}
    {!last&&<button className={styles.more} onClick={()=>void load(page+1,true)} type="button">Load more</button>}
  </section>;
}
