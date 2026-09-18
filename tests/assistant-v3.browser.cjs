/* eslint-disable @typescript-eslint/no-require-imports -- Browser acceptance tests use the installed test runtime. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {setup,open,id}=require('./assistant.browser.cjs');
const output='/tmp/abhiai-v3-qa';fs.mkdirSync(output,{recursive:true});
const date=new Date().toISOString();
async function fixtures(f){
 const state={tasks:[],resume:0,confirmed:[],cancelled:0,uploads:0,mode:'normal'};
 await f.context.route('**/api/v1/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname.replace(/^.*\/api\/v1/,'');
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(p==='/assistant/tasks'){
   if(req.method()==='GET')return json(state.tasks);
   const body=req.postDataJSON();const task={id:crypto.randomUUID(),conversationId:id,goal:body.goal,status:'READY',createdAt:date,updatedAt:date,stepsUsed:0,toolCalls:0,retries:0,
    state:{plan:['Search sources','Prepare a draft'],steps:[],context:body.context,projectKey:'',sessionId:body.sessionId,result:'',notice:'',pending:null}};
   state.tasks.unshift(task);return json(task);
  }
  const m=p.match(/^\/assistant\/tasks\/([^/]+)\/(advance|resume|cancel|confirm)$/);
  if(m){
   const task=state.tasks.find(t=>t.id===m[1]);assert(task);const action=m[2];
   if(action==='cancel'){state.cancelled++;task.status='CANCELLED';return json(task);}
   if(action==='resume'){state.resume++;task.status='READY';task.retries++;task.state.sessionId=req.postDataJSON().sessionId;task.state.pending=null;return json(task);}
   if(action==='confirm'){state.confirmed.push(req.postDataJSON());assert.equal(req.postDataJSON().payloadHash,task.state.pending.payloadHash);task.state.pending.status='EXECUTED';task.status='READY';return json(task);}
   task.stepsUsed++;
   if(state.mode==='cancel'){await new Promise(resolve=>setTimeout(resolve,1500));return json(task);}
   if(state.mode==='confirmation' && !state.confirmed.length){task.status='WAITING_CONFIRMATION';task.state.pending={id:crypto.randomUUID(),actionType:'SAVE_POST',label:'Save this post to your saved posts?',exactPayload:JSON.stringify({postId:'reviewed-post',text:'Reviewed exact post'}),payloadHash:'a'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),status:'PENDING'};return json(task);}
   if(!task.state.steps.length){task.state.steps.push({id:'step1',description:'search news',tool:'SEARCH_NEWS',arguments:{query:'AI'},status:'COMPLETED',result:{tool:'SEARCH_NEWS',kind:'cards',title:'News results',text:'Three sources',cards:[]}});task.toolCalls++;}
   if(state.mode==='retry' && !state.resume){task.status='FAILED';task.state.notice='Provider unavailable; saved results retained.';return json(task);}
   task.status='COMPLETED';task.state.result='Prepared a grounded post draft. Nothing was published.';
   f.state.history.push({id:crypto.randomUUID(),role:'ASSISTANT',content:task.state.result,createdAt:date});return json(task);
  }
  if(p.endsWith('/attachments') && req.method()==='POST'){state.uploads++;return json({id:'55555555-5555-4555-8555-555555555555',mediaId:'66666666-6666-4666-8666-666666666666',filename:'notes.txt',kind:'DOCUMENT',contentType:'text/plain',processingStatus:'READY',byteSize:21,createdAt:date});}
  return route.fallback();
 });return state;
}
async function send(page,text){await page.getByLabel('Message AbhiAI Assistant').fill(text);await page.getByLabel('Message AbhiAI Assistant').press('Enter');}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
 try{
  const f=await setup(browser,{width:1440,height:1000}),state=await fixtures(f),{page}=f;page.setDefaultTimeout(12000);await open(page);const panel=page.getByRole('dialog');
  await panel.getByLabel('Multi-step task').check();state.mode='retry';await send(page,'Find three AI news stories and prepare a post');
  await panel.getByText('Provider unavailable; saved results retained.').waitFor();assert.equal(state.tasks[0].state.steps.length,1);
  await panel.getByRole('button',{name:'Resume from checkpoint'}).click();await panel.getByText('Prepared a grounded post draft. Nothing was published.').first().waitFor();assert.equal(state.resume,1);assert.equal(state.tasks[0].state.steps.length,1);
  state.mode='confirmation';await send(page,'Save the reviewed post');await panel.getByText('Save this post to your saved posts?',{exact:true}).waitFor();assert.equal(state.confirmed.length,0);
  await panel.getByRole('button',{name:'Confirm: save this post'}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Assistant task progress"]')?.textContent.includes('waiting confirmation'));assert.equal(state.confirmed.length,1);
  state.mode='cancel';await send(page,'A longer task');await panel.getByRole('button',{name:'Cancel task',exact:true}).waitFor();await panel.getByRole('button',{name:'Cancel task',exact:true}).click();await panel.getByText('cancelled',{exact:true}).waitFor();assert.equal(state.cancelled,1);
  await panel.getByRole('button',{name:'Assistant settings and memory'}).click();await panel.getByLabel('Assistant mode').selectOption('TUTOR');await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);assert.equal(f.state.preferences.mode,'TUTOR');
  await panel.getByLabel('Project name').fill('Project A');await panel.getByRole('button',{name:'Use this project'}).click();await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  await panel.getByRole('checkbox',{name:'Use current page context',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);assert.equal(f.state.preferences.pageContext,false);
  assert.equal(await panel.getByLabel('Suggest unfinished tasks (at most once per day)').isChecked(),false);
  await panel.getByRole('button',{name:'Back to assistant conversation'}).click();await panel.getByLabel('Multi-step task').uncheck();
  page.once('dialog',d=>d.accept());await panel.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Study notes for arrays')});await panel.getByText('notes.txt',{exact:true}).waitFor();await send(page,'Summarize these notes');await panel.getByText('Hello! Let’s explore that together.',{exact:true}).waitFor();assert.equal(state.uploads,1);assert.match(f.state.textRequests.at(-1).body.assistantSessionId,/^[0-9a-f-]{36}$/);assert.deepEqual(f.state.textRequests.at(-1).body.attachmentIds,['55555555-5555-4555-8555-555555555555']);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await panel.locator('[data-state][data-animations="off"]').waitFor();await page.screenshot({path:output+'/desktop.png'});assert.deepEqual(f.errors,[]);await f.context.close();
  for(const [width,height] of [[390,844],[390,420]]){
   const m=await setup(browser,{width,height});await fixtures(m);await open(m.page);const dialog=m.page.getByRole('dialog');assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   const input=await m.page.getByLabel('Message AbhiAI Assistant').boundingBox();assert(input.y+input.height<=height,'composer stays inside viewport');
   await dialog.getByRole('button',{name:'Assistant settings and memory'}).click();await dialog.getByRole('heading',{name:'Memory & personalization'}).waitFor();assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await m.page.screenshot({path:`${output}/privacy-${width}x${height}.png`});assert.deepEqual(m.errors,[]);await m.context.close();
  }
  console.log(JSON.stringify({passed:true,checks:['multi-step checkpoint','retry preserves completed results','exact confirmation before action','cancel','mode and project settings','page privacy','proactive off','multimodal upload','background animation stop','mobile privacy'],screenshots:output}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
