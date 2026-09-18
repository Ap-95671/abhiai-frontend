/* eslint-disable @typescript-eslint/no-require-imports -- Local API smoke test uses Node built-ins. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=process.env.ASSISTANT_API_TEST_URL||'http://127.0.0.1:8088/api/v1';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname))throw new Error('Use an isolated local QA backend, never production.');
async function api(path,method='GET',body,token){const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{result=raw}return {status:response.status,body:result};}
async function user(){const identity=crypto.randomUUID();const account={displayName:'Local V3 QA',email:`v3-${identity}@example.test`,password:crypto.randomBytes(24).toString('hex')};assert.equal((await api('/auth/register','POST',account)).status,201);const login=await api('/auth/login','POST',account);assert.equal(login.status,200);return login.body.accessToken;}
(async()=>{
 assert.equal((await api('/assistant/tasks')).status,401);
 const owner=await user(),other=await user();
 const opened=await api('/assistant/conversation','POST',{fresh:false},owner);assert.equal(opened.status,200);const conversation=opened.body.id;
 const prefs={mode:'TUTOR',pageContext:false,agentActions:false,proactive:false,projectKey:'QA project',fallbackAllowed:false};
 assert.equal((await api('/assistant/preferences','PUT',prefs,owner)).status,200);assert.deepEqual((await api('/assistant/preferences','GET',undefined,owner)).body,prefs);
 const session=crypto.randomUUID();const created=await api('/assistant/tasks','POST',{conversationId:conversation,goal:'Summarize available sources',sessionId:session},owner);assert.equal(created.status,200,JSON.stringify(created.body));const id=created.body.id;assert.equal(created.body.status,'READY');
 assert.equal((await api('/assistant/tasks/'+id,'GET',undefined,other)).status,404);
 assert.equal((await api(`/assistant/tasks/${id}/cancel`,'POST',{},other)).status,404);
 assert.equal((await api('/assistant/tasks','POST',{conversationId:conversation,goal:'Duplicate',sessionId:session},owner)).status,409);
 const failed=await api(`/assistant/tasks/${id}/advance`,'POST',{},owner);assert.equal(failed.status,200);assert.equal(failed.body.status,'FAILED');assert.equal(failed.body.stepsUsed,1);
 const resumed=await api(`/assistant/tasks/${id}/resume`,'POST',{sessionId:session},owner);assert.equal(resumed.status,200);assert.equal(resumed.body.status,'READY');assert.equal(resumed.body.retries,1);
 assert.equal((await api(`/assistant/tasks/${id}/cancel`,'POST',{},owner)).body.status,'CANCELLED');
 const history=await api('/assistant/tasks','GET',undefined,owner);assert.equal(history.body[0].id,id);
 await api('/memory','PATCH',{enabled:true},owner);
 const memory={content:'Prefer short answers',category:'PREFERENCE',scope:'PROJECT',scopeKey:'QA project',preferenceKey:'answer-length'};
 const saved=await api('/memory/items','POST',memory,owner);assert.equal(saved.status,201,JSON.stringify(saved.body));
 const updated=await api('/memory/items','POST',{...memory,content:'Prefer detailed answers'},owner);assert.equal(updated.status,201);assert.equal(updated.body.id,saved.body.id);
 assert.equal((await api(`/memory/items/${saved.body.id}`,'PATCH',{content:'Forged change'},other)).status,400);
 const edited=await api(`/memory/items/${saved.body.id}`,'PATCH',{content:'Prefer concise answers'},owner);assert.equal(edited.status,200);assert.equal(edited.body.content,'Prefer concise answers');
 assert.equal((await api(`/memory/items/${saved.body.id}`,'DELETE',undefined,owner)).status,204);
 assert.equal((await api('/memory','PATCH',{enabled:false},owner)).body.enabled,false);
 console.log(JSON.stringify({passed:true,checks:['authentication','saved preferences','task persistence','cross-user task denial','duplicate task conflict','provider failure checkpoint','resume','cancel','scoped memory create/update/edit/delete','cross-user memory denial','memory disable']}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
