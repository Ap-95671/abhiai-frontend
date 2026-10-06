/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in local API regression suite. */
const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.ASSISTANT_TEST_API||'http://localhost:8082/api/v1';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated local database.');
const results=[];
async function account(label){const email=`${label}.${Date.now()}@example.test`,password='Local-test-2026!';let r=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,displayName:label})});assert.equal(r.status,201);r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.json();}
async function call(session,path,method='GET',body){const send=()=>fetch(base+path,{method,headers:{Authorization:'Bearer '+session.accessToken,...(body instanceof FormData?{}:body!==undefined?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});let r=await send();if(r.status===401){const refresh=await fetch(base+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:session.refreshToken})});assert.equal(refresh.status,200);Object.assign(session,await refresh.json());r=await send();}const text=await r.text();assert.ok(r.ok,`${method} ${path}: ${r.status} ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
function pdf(){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const stream='BT /F1 12 Tf 20 200 Td (Regression PDF: the project code is ORCHID-42.) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);let s='%PDF-1.4\n',offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=Buffer.byteLength(s);s+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(s);}
(async()=>{
const a=await account('RegressionAuthor'),b=await account('RegressionReader');
const me=await call(a,'/users/me');const other=await call(b,'/users/'+me.username);assert.equal(other.id,me.id);results.push('own and other profile');
const post=await call(a,'/posts','POST',{textContent:'Local regression test post',visibility:'PUBLIC'});
await call(b,`/posts/${post.id}/likes`,'POST');assert.equal((await call(b,`/posts/${post.id}/likes/status`)).liked,true);
await call(b,`/posts/${post.id}/replies`,'POST',{textContent:'Local regression reply'});
await call(b,`/posts/${post.id}/reposts`,'POST');
assert.equal((await call(b,`/posts/${post.id}`)).likeCount,1);assert.equal((await call(a,`/posts/${post.id}/replies`)).content.length,1);
assert.ok((await call(a,'/notifications')).content.length>=3);results.push('post, like, comment, repost, notifications');
for(const path of ['/feed','/explore','/videos/feed',`/users/${me.username}/posts`,'/memory','/models'])await call(a,path);results.push('feed, explore, videos, user posts, memory, models');
const article=await call(a,'/articles','POST',{title:'Local regression article',summary:'A local test of article publication and retrieval.',content:'This is a local test article with more than fifty characters. The measurement described in this article is 31 percent.',coverImageUrl:null});
assert.equal((await call(b,`/articles/${article.id}`)).title,article.title);await call(b,`/articles/${article.id}/likes`,'POST');await call(b,`/articles/${article.id}/comments`,'POST',{content:'Local article comment'});results.push('native articles: create, open, like, comment');
const chat=await call(a,'/conversations','POST',{title:'Upload regression'});
for(const [name,type,data] of [['notes.txt','text/plain',Buffer.from('The project code is ORCHID-42.')],['sample.pdf','application/pdf',pdf()],['sample.png','image/png',fs.readFileSync('public/abhiai-logo.png')]]){
const form=new FormData();form.append('file',new Blob([data],{type}),name);const attachment=await call(a,`/conversations/${chat.id}/attachments`,'POST',form);assert.ok(attachment.id);assert.equal(attachment.filename,name);results.push(`upload ${name}: ${attachment.processingStatus}`);
}
assert.equal((await call(a,`/conversations/${chat.id}/attachments`)).length,3);
const models=await call(a,'/models');const local=models.find(m=>m.provider==='ollama');assert.ok(local);await call(a,`/conversations/${chat.id}/model`,'PATCH',{selectionMode:'MANUAL',selectedModelId:local.id});assert.equal((await call(a,`/conversations/${chat.id}`)).modelSelectionMode,'MANUAL');await call(a,`/conversations/${chat.id}/model`,'PATCH',{selectionMode:'AUTO',selectedModelId:null});results.push('manual model selection and Auto restoration');
for(const s of [a,b]){const r=await fetch(base+'/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:s.refreshToken})});assert.equal(r.status,204);}
console.log(JSON.stringify({passed:true,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
