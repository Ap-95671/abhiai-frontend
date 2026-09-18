"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AbhiAIPageContext } from "./context-types";
import type { AgentTask, AssistantSettings } from "./agent-types";

export function useAssistantAgent(token:string,userId:string,visible:boolean,onComplete:()=>Promise<void>) {
  const [settings,setSettings]=useState<AssistantSettings>();
  const [tasks,setTasks]=useState<AgentTask[]>([]);
  const [task,setTask]=useState<AgentTask>();
  const [running,setRunning]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const updating=useRef(false);
  const preferencesVersion=useRef(0);
  const [error,setError]=useState("");
  const [suggestion,setSuggestion]=useState<AgentTask>();
  const active=useRef<string | undefined>(undefined);
  const abort=useRef<AbortController | undefined>(undefined);
  const generation=useRef(0);
  const mounted=useRef(true);
  const completion=useRef(onComplete);
  const session=useRef("");
  const [sessionId,setSessionId]=useState("");
  useEffect(()=>{completion.current=onComplete;},[onComplete]);
  const load=useCallback(async()=>{
    try {
      const revision=preferencesVersion.current;
      const [prefs,history]=await Promise.all([api.assistantPreferences(token),api.assistantTasks(token)]);
      if(!mounted.current)return;
      if(!Array.isArray(history) || typeof prefs.mode!=="string")throw new Error("Task controls unavailable.");
      setTasks(history);setTask(current=>current?history.find(t=>t.id===current.id)??current:current);
      if(revision!==preferencesVersion.current)return;
      setSettings(prefs);
      const recent=history.find(t=>t.status!=="COMPLETED" && t.state.projectKey===prefs.projectKey);
      if(prefs.proactive && recent) {
        try {
          const key=`abhiai.assistant.suggestion.${userId}`;
          const last=JSON.parse(localStorage.getItem(key)??"{}");
          if(last.id!==recent.id && Date.now()-(last.time??0)>86400000) {
            setSuggestion(recent);localStorage.setItem(key,JSON.stringify({id:recent.id,time:Date.now()}));
          }
        } catch { /* Unavailable storage suppresses proactive suggestions. */ }
      } else setSuggestion(undefined);
    } catch {if(mounted.current)setError("Assistant task controls could not load. Text and voice remain available.");}
  },[token,userId]);
  const remember=useCallback((value:AgentTask)=>{
    if(!mounted.current)return;
    setTask(value);setTasks(items=>[value,...items.filter(t=>t.id!==value.id)].slice(0,20));
  },[]);
  const stop=useCallback(async(taskId?:string)=>{
    generation.current++;abort.current?.abort();
    const id=active.current??taskId;active.current=undefined;setRunning(false);
    if(id && id!=="creating")try {remember(await api.assistantTaskAction(token,id,"cancel"));}catch {if(mounted.current)setError("Cancellation could not be confirmed. The task cannot run further steps without Continue.");}
  },[token,remember]);
  useEffect(()=>{
    mounted.current=true;session.current=crypto.randomUUID();queueMicrotask(()=>{setSessionId(session.current);void load();});
    const hide=()=>{if(document.hidden)void stop();};document.addEventListener("visibilitychange",hide);
    const taskGeneration=generation;
    return ()=>{mounted.current=false;taskGeneration.current++;abort.current?.abort();document.removeEventListener("visibilitychange",hide);
      const id=active.current;if(id && id!=="creating")void api.assistantTaskAction(token,id,"cancel").catch(()=>{});};
  },[token,load,stop]);
  useEffect(()=>{if(!visible)queueMicrotask(()=>void stop());},[visible,stop]);
  async function run(initial:AgentTask) {
    if(active.current)return;
    const turn=++generation.current;active.current=initial.id;setRunning(true);setError("");remember(initial);
    let current=initial;
    try {
      while(current.status==="READY" && generation.current===turn && !document.hidden) {
        const controller=new AbortController();abort.current=controller;
        const timeout=setTimeout(()=>controller.abort(),95000);
        try { current=await api.assistantTaskAction(token,current.id,"advance",{},controller.signal); }
        finally {clearTimeout(timeout);}
        if(generation.current!==turn)return;
        remember(current);
      }
      if(current.status==="COMPLETED" && generation.current===turn)await completion.current();
    } catch(failure) {
      if(generation.current===turn)setError(failure instanceof Error?failure.message:"Task interrupted. Refresh task history, then resume safely.");
    } finally {if(generation.current===turn){active.current=undefined;setRunning(false);void load();}}
  }
  async function start(goal:string,conversationId:string,context:AbhiAIPageContext|null) {
    if(active.current)return false;
    setError("");
    // Reserve locally before creation, so double-clicks cannot create duplicate goals.
    active.current="creating";setRunning(true);
    const turn=generation.current;
    try {
      const created=await api.createAssistantTask(token,{goal,conversationId,context,sessionId:session.current});
      active.current=undefined;
      if(turn!==generation.current){await api.assistantTaskAction(token,created.id,"cancel");return false;}
      void run(created);return true;
    }catch(failure){active.current=undefined;setRunning(false);setError(failure instanceof Error?failure.message:"Task could not start.");return false;}
  }
  async function resume(value:AgentTask) {
    if(active.current)return;
    try {const next=await api.assistantTaskAction(token,value.id,"resume",{sessionId:session.current});void run(next);}
    catch(failure){setError(failure instanceof Error?failure.message:"Task could not resume.");}
  }
  async function confirm(value:AgentTask) {
    const pending=value.state.pending;if(!pending || active.current)return;
    try {const next=await api.assistantTaskAction(token,value.id,"confirm",{actionId:pending.id,payloadHash:pending.payloadHash,sessionId:session.current});void run(next);}
    catch(failure){setError(failure instanceof Error?failure.message:"Confirmation failed. Resume to review again.");}
  }
  async function update(next:AssistantSettings) {
    if(updating.current)return undefined;
    updating.current=true;setSavingSettings(true);preferencesVersion.current++;
    setError("");await stop();
    try {const saved=await api.updateAssistantPreferences(token,next);setSettings(saved);if(!saved.proactive)setSuggestion(undefined);return saved;}
    catch(failure){setError(failure instanceof Error?failure.message:"Privacy settings were not saved.");return undefined;}
    finally{updating.current=false;setSavingSettings(false);}
  }
  return {sessionId,savingSettings,settings,tasks,task,running,error,suggestion,start,stop,resume,confirm,update,load,select:setTask,dismissSuggestion:()=>setSuggestion(undefined)};
}
