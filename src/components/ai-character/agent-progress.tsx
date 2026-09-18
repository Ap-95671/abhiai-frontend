"use client";
import type { AgentTask } from "./agent-types";
import { AssistantToolResults } from "./assistant-tool-results";
import styles from "./assistant.module.css";
export function AgentProgress({task,running,token,onStop,onResume,onConfirm,onNavigate}: {
  task?:AgentTask;running:boolean;token:string;onStop(task:AgentTask):void;onResume(task:AgentTask):void;onConfirm(task:AgentTask):void;onNavigate():void;
}) {
  if(!task)return null;
  const pending=task.state.pending;
  return <section className={styles.agentProgress} aria-label="Assistant task progress">
    <strong>{task.goal}</strong><p role="status">{running?"Working on it…":task.status.toLowerCase().replaceAll("_"," ")}</p>
    <ol>{task.state.plan.map((step,index)=><li key={index}>{step}</li>)}</ol>
    <ul>{task.state.steps.map(step=><li key={step.id}>{step.status==="COMPLETED"?"✓":"○"} {step.description}</li>)}</ul>
    {task.state.notice && <p>{task.state.notice}</p>}
    <AssistantToolResults token={token} results={task.state.steps.flatMap(step=>step.result?[step.result]:[])} onNavigate={onNavigate}/>
    {task.state.result && <pre className={styles.artifact}>{task.state.result}</pre>}
    {pending?.status==="PENDING" && task.status==="WAITING_CONFIRMATION" && <section className={styles.confirmation}>
      <strong>{pending.label}</strong><pre className={styles.artifact}>{pending.exactPayload}</pre>
      <p>Expires {new Date(pending.expiresAt).toLocaleTimeString()}. If the post changes before you confirm, you must review it again.</p>
      <button type="button" disabled={running} onClick={()=>onConfirm(task)}>Confirm: save this post</button>
      <button type="button" onClick={()=>onResume(task)}>Discard approval and review again</button>
    </section>}
    {!running && task.status!=="COMPLETED" && task.status!=="CANCELLED" && <button type="button" onClick={()=>onStop(task)}>Cancel task</button>}
    {running?<button type="button" onClick={()=>onStop(task)}>Cancel task</button>:task.status!=="COMPLETED" && task.status!=="WAITING_CONFIRMATION" && <button type="button" onClick={()=>onResume(task)}>Resume from checkpoint</button>}
  </section>;
}
