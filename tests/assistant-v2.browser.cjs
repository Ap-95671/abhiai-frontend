/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser acceptance suite. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert=require('node:assert/strict');
const {setup,open,profile,conversation,id,userId,date,empty}=require('./assistant.browser.cjs');
const origin=process.env.ASSISTANT_TEST_URL || 'http://localhost:3100';
const fs=require('node:fs');const output='/tmp/abhiai-v2-qa';fs.mkdirSync(output,{recursive:true});
const article=id=>({id,title:`Article ${id}`,description:`Visible excerpt of article ${id}.`,sourceName:'Publisher',publishedAt:date,category:'science',sources:[],relatedStoryCount:1});
const post={id:'44444444-4444-4444-8444-444444444444',author:{id:userId,username:profile.username,displayName:profile.displayName},textContent:'Learning Java with practical examples.',visibility:'PUBLIC',createdAt:date,updatedAt:date,media:[],likeCount:0,replyCount:0,repostCount:0,bookmarkCount:0,viewCount:0,pinned:false};
async function fixtures(f){
 const data={requests:[],tools:[],memories:[],enabled:false,published:0};
 await f.context.route('**/api/v1/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname.replace(/^.*\/api\/v1/,'');
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(p==='/news'||p==='/news/top')return json({content:[article('A'),article('B')],page:0,limit:10,totalResults:2,hasMore:false,updatedAt:date,stale:false});
  if(p.startsWith('/news/'))return json(article(p.split('/').at(-1)));
  if(p==='/feed')return json({...empty,content:[post]});
  if(p===`/posts/${post.id}`)return json(post);
  if(p==='/posts'&&req.method()==='POST'){data.published++;return json(post);}
  if(p==='/memory'){if(req.method()==='PATCH')data.enabled=req.postDataJSON().enabled;return json({enabled:data.enabled,memories:data.memories});}
  if(p==='/memory/items'&&req.method()==='POST'){const m={id:crypto.randomUUID(),...req.postDataJSON(),createdAt:date,updatedAt:date};data.memories.push(m);return json(m);}
  if(p.startsWith('/memory/items')&&req.method()==='DELETE'){data.memories=p==='/memory/items'?[]:data.memories.filter(m=>m.id!==p.split('/').at(-1));return route.fulfill({status:204});}
  if(p==='/assistant/tools'){const body=req.postDataJSON();data.tools.push(body);return json({tool:body.name,kind:body.name==='GET_ASSISTANT_CONTEXT'?'context':'cards',title:'Search results',text:'Found a post',expression:'happy',cards:[{title:'Java post',text:post.textContent,href:`/social#post-${post.id}`}]});}
  if(p.endsWith('/messages/stream')&&p.includes(id)){
   const body=req.postDataJSON();data.requests.push(body);
   const result=/draft/i.test(body.content)?{tool:'CREATE_POST_DRAFT',kind:'draft',title:'Post draft',text:'Review before publishing.',cards:[],draft:'A draft about this article.'}
    :/remember/i.test(body.content)?{tool:'PROPOSE_MEMORY',kind:'memory',title:'Suggested memory',text:'Not saved yet.',cards:[],draft:'I prefer concise explanations.',memoryCategory:'PREFERENCE'}
    :/search/i.test(body.content)?{tool:'SEARCH_ABHIAI',kind:'cards',title:'Search results',text:'One accessible post',cards:[{title:'Java post',text:post.textContent,href:`/social#post-${post.id}`}]}:null;
   const u={id:crypto.randomUUID(),role:'USER',content:body.content,createdAt:date},a={id:crypto.randomUUID(),role:'ASSISTANT',content:`Answer for ${body.assistantContext?.entityId ?? 'no current page'}.`,createdAt:date};f.state.history.push(u,a);
   let events=`event: assistant\ndata: ${JSON.stringify({expression:'supportive',status:'Reading current content…'})}\n\n`;
   if(result)events+=`event: assistant\ndata: ${JSON.stringify({result})}\n\n`;
   return route.fulfill({contentType:'text/event-stream',body:events+`event: chunk\ndata: ${a.content}\n\nevent: complete\ndata: ${JSON.stringify({userMessage:u,assistantMessage:a,conversation})}\n\n`});
  }
  return route.fallback();
 });return data;
}
async function send(page,text){await page.getByLabel('Message AbhiAI Assistant').fill(text);await page.getByLabel('Message AbhiAI Assistant').press('Enter');await page.waitForFunction(()=>document.querySelector('#assistant-message')?.value==='');}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
 try{
  const f=await setup(browser,{width:1600,height:1000}),{page}=f,data=await fixtures(f);page.setDefaultTimeout(12000);
  await page.goto(origin+'/news');await page.getByRole('button',{name:'Read Story',exact:true}).click();
  await page.locator('.news-detail-description').evaluate(el=>{const s=getSelection(),r=document.createRange();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new MouseEvent('mouseup'));});
  await page.getByRole('button',{name:'Talk about this article',exact:true}).click();const panel=page.locator('dialog[data-assistant-panel]');await panel.waitFor();
  await send(page,'Summarize this');assert.equal(data.requests.at(-1).assistantContext.entityId,'A');assert(data.requests.at(-1).assistantContext.selectedText.includes('article A'));
  await page.getByRole('button',{name:'Close article',exact:true}).click();await page.locator('.news-detail').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Preview Article B',exact:true}).click();await send(page,'Explain this instead');assert.equal(data.requests.at(-1).assistantContext.entityId,'B');assert(!data.requests.at(-1).assistantContext.selectedText);
  await panel.getByRole('button',{name:'Use current page context',exact:true}).click();await send(page,'Explain without context');assert.equal(data.requests.at(-1).assistantContext,null);
  await panel.getByRole('button',{name:'Use current page context',exact:true}).click();await send(page,'Search AbhiAI for Java');await panel.getByRole('link',{name:'Java post'}).waitFor();
  await send(page,'Write a post draft');await panel.getByLabel('Review post draft').fill('Edited draft from article B.');await panel.getByRole('button',{name:'Edit in post composer'}).click();await page.getByLabel('Create a social post').waitFor().catch(async e=>{console.log('Draft navigation',page.url(),f.errors,(await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:output+'/draft-failure.png'});throw e;});assert.equal(await page.getByLabel('Create a social post').inputValue().catch(async e=>{console.log('Lost composer',page.url(),f.errors,(await page.locator('body').innerText()).slice(-3000));throw e;}),'Edited draft from article B.');assert.equal(data.published,0);
  await page.goto(origin+`/social#post-${post.id}`);await page.getByRole('button',{name:'Talk about this post',exact:true}).click();await send(page,'What does this post mean?');assert.equal(data.requests.at(-1).assistantContext.entityId,post.id);
  await send(page,'Remember that I prefer concise explanations.');assert.equal(data.memories.length,0);await panel.getByRole('button',{name:'Save memory',exact:true}).click();await panel.getByRole('button',{name:'Memory saved'}).waitFor();assert.equal(data.memories.length,1);
  await panel.getByRole('button',{name:'Assistant settings and memory'}).click();await panel.getByRole('switch').click();assert.equal(data.enabled,true);
  page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Delete memory: I prefer concise explanations.'}).click();await panel.getByText('No saved memories',{exact:true}).waitFor();assert.equal(data.memories.length,0);
  await panel.getByRole('button',{name:'Back to assistant conversation'}).click();await page.evaluate(()=>{window.__micDenied=false;});await panel.getByRole('button',{name:'Start live microphone'}).click();await panel.getByText('Live voice connected',{exact:true}).waitFor();
  await page.evaluate(()=>{window.__emit({serverContent:{inputTranscription:{text:'Find posts about Java',finished:true}}});window.__emit({toolCall:{functionCalls:[{id:'voice-search',name:'SEARCH_ABHIAI',args:{query:'Java'}}]}});});
  await page.waitForFunction(()=>window.__sent.some(e=>e.toolResponse?.functionResponses?.[0]?.id==='voice-search'));assert.equal(data.tools.at(-1).context.entityId,post.id);await panel.getByRole('link',{name:'Java post'}).waitFor();
  await page.evaluate(()=>window.__emit({serverContent:{outputTranscription:{text:'Here is a Java post.'},turnComplete:true}}));await panel.getByText('Here is a Java post.',{exact:true}).waitFor();await panel.getByRole('button',{name:'Use current page context',exact:true}).click();await page.waitForFunction(()=>window.__tracks.every(t=>t.readyState==='ended'));
  await page.screenshot({path:output+'/desktop.png'});assert.equal(f.errors.length,0,f.errors.join('\n'));await f.context.close();
  for(const [width,height] of [[360,640],[390,844],[390,420]]){const m=await setup(browser,{width,height});await fixtures(m);await open(m.page);const dialog=m.page.locator('dialog[data-assistant-panel]');await send(m.page,'Write a post draft');await dialog.getByLabel('Review post draft').waitFor();assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await dialog.getByRole('button',{name:'Assistant settings and memory'}).click();await dialog.getByRole('heading',{name:'Memory & personalization'}).waitFor();await dialog.getByRole('switch').waitFor();assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await m.page.screenshot({path:`${output}/memory-${width}x${height}.png`});assert.equal(m.errors.length,0,m.errors.join('\n'));await m.context.close();}
  console.log(JSON.stringify({passed:true,checks:['article A to B while open','safe selection','context off','search cards','draft composer without publication','current post','explicit memory save/delete','memory toggle','voice tool and page context','voice cleanup','mobile drafts and settings'],screenshots:output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
