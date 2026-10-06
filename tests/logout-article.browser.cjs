/* eslint-disable @typescript-eslint/no-require-imports -- Existing Playwright acceptance runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const { setup, date, normal } = require('./assistant.browser.cjs');
const origin = process.env.ASSISTANT_TEST_URL || 'http://localhost:3100';
const articles = [
  { id:'solar-a', title:'Solar cells reach new milestone', description:'Researchers improved solar cell efficiency to 31 percent.', sourceName:'Science A' },
  { id:'ocean-b', title:'Ocean expedition maps deep reefs', description:'A marine expedition mapped coral reefs at a depth of 400 metres. '.repeat(180), sourceName:'Ocean B' },
  { id:'short-c', title:'Local library reopens', description:'', sourceName:'' },
].map(a=>({...a,articleUrl:`https://example.test/${a.id}`,publishedAt:date,category:'science',sources:[],relatedStoryCount:1}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[];
 try { for(const width of [1440,390]) for(const theme of ['light','dark']) {
  const f=await setup(browser,{width,height:900},true);const {page,context}=f;page.setDefaultTimeout(15000);
  let created=0;const requests=[];const conversations=new Map([[normal.id,{...normal,messages:[]}]]);
  await context.addInitScript(theme=>{localStorage.setItem('abhiai.theme',theme);},theme);
  await context.route('**/api/v1/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname.replace(/^.*\/api\/v1/,'');
   const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   // Article chat must work even if the optional assistant is disabled.
   if(p==='/assistant/config')return json({enabled:false,voiceAvailable:false});
   if(p==='/stories/feed')return json({content:[],last:true});
   if(p==='/explore')return json({trendingHashtags:[],suggestedAccounts:[],trendingPosts:[],popularDiscussions:[],recommendedMedia:[]});
   if(p==='/news')return json({content:articles,page:0,limit:10,totalResults:3,hasMore:false,updatedAt:date,stale:false});
   if(p.startsWith('/news/'))return json(articles.find(a=>a.id===p.split('/').at(-1)));
   if(p==='/conversations'){
    if(req.method()==='POST'){created++;const c={...normal,id:crypto.randomUUID(),messages:[]};conversations.set(c.id,c);return json(c);}
    return json([...conversations.values()]);
   }
   if(p.endsWith('/messages/stream')) {
    const body=req.postDataJSON(),id=p.split('/')[2],c=conversations.get(id);requests.push({id,...body});
    const article=articles.find(a=>body.content.includes(`Article ID: ${a.id}`)) || articles.find(a=>c.messages.some(m=>m.content.includes(`Article ID: ${a.id}`)));
    const userMessage={id:crypto.randomUUID(),role:'USER',content:body.content,createdAt:date};
    const assistantMessage={id:crypto.randomUUID(),role:'ASSISTANT',content:article?`Discussion of ${article.title}.`:'Normal chat with no article context.',createdAt:date};
    c.messages.push(userMessage,assistantMessage);
    return route.fulfill({contentType:'text/event-stream',body:`event: complete\ndata: ${JSON.stringify({userMessage,assistantMessage,conversation:c})}\n\n`});
   }
   if(p.startsWith('/conversations/')&&conversations.has(p.split('/')[2]))return json(p.endsWith('/attachments')?[]:conversations.get(p.split('/')[2]));
   return route.fallback();
  });
  await page.goto(origin+'/news');
  for(const [index,a] of articles.entries()) {
   if(index)await page.goto(origin+'/news');
   if(index===0)await page.getByRole('button',{name:'Read Story',exact:true}).click();
   else await page.getByRole('button',{name:`Preview ${a.title}`,exact:true}).click();
   await page.getByRole('button',{name:'Talk about this article',exact:true}).dblclick();
   await page.getByText(`Discussion of ${a.title}.`,{exact:true}).waitFor();
   assert.equal(new URL(page.url()).pathname,'/chat');assert.equal(created,index+1);
   assert.ok(requests.at(-1).content.includes(`Article ID: ${a.id}`));assert.ok(requests.at(-1).content.length<=10000);
   assert.equal(requests.at(-1).assistantContext,undefined);
   await page.getByLabel('Message AbhiAI',{exact:true}).fill('What are the main points?');
   await page.getByRole('button',{name:'Send message',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Message AbhiAI"]')?.value==='');
   assert.ok(conversations.get(requests.at(-1).id).messages[0].content.includes(a.id));
   await page.reload();await page.getByText(`Discussion of ${a.title}.`,{exact:true}).first().waitFor();
  }
  assert.equal(new Set(requests.filter(r=>r.content.includes('Article ID:')).map(r=>r.id)).size,3);
  if(width===390)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.getByRole('button',{name:'New conversation',exact:true}).first().click();
  await page.getByLabel('Message AbhiAI',{exact:true}).fill('Hello normal chat');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText('Normal chat with no article context.',{exact:true}).waitFor();
  assert.equal(requests.at(-1).assistantContext,undefined);
  for(const path of ['/social','/news','/social?view=explore','/social?view=videos','/social?view=profile','/social?view=memory','/chat']) {
   await page.goto(origin+path);await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor({state:'attached'}).catch(async e=>{console.error('Navigation failed',path,f.errors,(await page.locator('body').innerText()).slice(-1200));throw e;});
   assert.equal(new URL(page.url()).pathname,new URL(origin+path).pathname);
  }
  assert.deepEqual(f.errors,[]);results.push({width,theme,articleConversations:3,normalChat:true,navigation:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
