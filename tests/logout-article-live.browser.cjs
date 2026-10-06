/* eslint-disable @typescript-eslint/no-require-imports -- Opt-in local integration suite; requires a disposable backend database. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const origin=process.env.ASSISTANT_TEST_URL||'http://localhost:3102';
const backend=process.env.ASSISTANT_TEST_API||'http://localhost:8082/api/v1';
if(!['localhost','127.0.0.1'].includes(new URL(backend).hostname))throw Error('Use an isolated local test backend.');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];let automaticRefreshes=0;page.on('response',r=>{if(r.url().endsWith('/api/auth/refresh')&&r.status()===200)automaticRefreshes++;});page.on('pageerror',e=>errors.push(e.message));
  const email=`regression.${Date.now()}@example.test`,password='Local-QA-passphrase-2026!';
  const reg=await context.request.post(backend+'/auth/register',{data:{displayName:'Regression Test',email,password}});assert.equal(reg.status(),201);
  async function sessionToken(){const r=await context.request.post(origin+'/api/auth/refresh',{headers:{Origin:origin},data:{}});assert.equal(r.status(),200);return (await r.json()).accessToken;}
  await page.goto(origin+'/login');
  async function login(pw=password){await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(pw);await page.getByRole('button',{name:'Log in',exact:true}).click();}
  await login('wrong-password');await page.getByText('The email or password you entered is incorrect.',{exact:true}).waitFor();results.push('incorrect login rejected');
  await login();await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor();
  const cookie=(await context.cookies(origin+'/api/auth/refresh')).find(c=>c.name==='abhiai.refresh-session');assert.ok(cookie?.httpOnly);assert.ok(cookie.secure);assert.equal(cookie.path,'/api/auth');results.push('login and HttpOnly cookie');
  await page.reload();await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor();results.push('session restored after reload');
  async function send(text){
   const start=page.getByLabel('Start a conversation with AbhiAI',{exact:true});
   const field=await start.isVisible()?start:page.getByLabel('Message AbhiAI',{exact:true});
   await field.fill(text);
   const response=page.waitForResponse(r=>r.url().includes('/messages/stream')&&r.status()===200,{timeout:90000});
   await page.getByRole('button',{name:field===start?'Start chat':'Send message',exact:true}).click();
   const r=await response;assert.equal(r.status(),200);
   await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:120000});
   const id=r.url().split('/conversations/')[1].split('/')[0];
   const detail=await context.request.get(backend+'/conversations/'+id,{headers:{Authorization:'Bearer '+await sessionToken()}});
   const saved=await detail.json();assert.equal(saved.messages.at(-1)?.role,'ASSISTANT',JSON.stringify(saved));return saved.messages.at(-1).content;
  }
  await send('What is 7 plus 8? Answer briefly.');results.push('real normal AI response');
  for(const path of ['/social','/news','/social?view=explore','/social?view=videos','/social?view=profile','/social?view=memory','/chat']){
   await page.goto(origin+path);await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,new URL(origin+path).pathname);
  }results.push('major page navigation');
  const articles=[{id:'qa-solar',title:'Solar lab reaches 31 percent efficiency',description:'The Aurora laboratory achieved 31 percent solar-cell efficiency in a controlled experiment.',sourceName:'Solar Research Journal'},{id:'qa-reef',title:'Reef expedition maps 400 metre corals',description:'The Pelagic expedition mapped coral reefs at a depth of 400 metres in the Pacific.',sourceName:'Ocean Field Notes'}].map(a=>({...a,articleUrl:'https://example.test/'+a.id,publishedAt:'2026-10-05T10:00:00Z',category:'science',sources:[],relatedStoryCount:1}));
  // Only News delivery is deterministic; conversations, storage and AI generation are real.
  await context.route('**/api/v1/news?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({content:articles,page:0,limit:10,totalResults:2,hasMore:false,updatedAt:'2026-10-05T10:00:00Z',stale:false})}));
  await context.route('**/api/v1/news/qa-*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(articles.find(a=>r.request().url().endsWith(a.id)))}));
  const chats=[];
  async function article(index){
   await page.goto(origin+'/news');
   await page.getByRole('button',{name:index?'Preview '+articles[index].title:'Read Story',exact:true}).click();
   const response=page.waitForResponse(r=>r.url().includes('/messages/stream')&&r.status()===200,{timeout:90000});
   await page.getByRole('button',{name:'Talk about this article',exact:true}).click();
   const r=await response;await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:120000});const raw=await page.locator('.assistant-message').last().innerText();
   assert.ok(new RegExp(index?'Pelagic|400|coral':'Aurora|31|solar','i').test(raw));
   const request=r.request().postDataJSON();assert.ok(request.content.includes(articles[index].id));
   const id=r.url().split('/conversations/')[1].split('/')[0];chats.push(id);
   await send('What are the main points? Give the title and key measurement.');
   await page.reload();await page.getByText(articles[index].title,{exact:false}).first().waitFor();
   results.push('article '+index+' real answer, follow-up, saved reload');
  }
  await article(0);
  async function logout(){
   const revokedToken=await sessionToken();
   assert.equal((await context.request.get(backend+'/users/me',{headers:{Authorization:'Bearer '+revokedToken}})).status(),200);
   await page.getByRole('button',{name:'Open account menu',exact:true}).click();
   const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/logout'));
   await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();
   await page.getByRole('button',{name:'Log in',exact:true}).waitFor();assert.equal((await response).status(),200);
   assert.equal(await page.evaluate(()=>localStorage.getItem('abhiai.access-token')),null);
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('abhiai.session-access-token')),null);
   assert.ok(!(await context.cookies(origin+'/api/auth/refresh')).some(c=>c.name==='abhiai.refresh-session'));
   assert.equal((await context.request.get(backend+'/users/me',{headers:{Authorization:'Bearer '+revokedToken}})).status(),401);
   await page.reload();await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
   await page.goto(origin+'/social');await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
   await page.goBack();await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
   results.push('logout: cookie/token removal, revoked JWT, refresh, protected route, Back');
  }
  await logout();await login();await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor();await article(1);assert.notEqual(chats[0],chats[1]);
  await page.getByRole('button',{name:'New conversation',exact:true}).first().click();await send('What is 12 minus 3? Answer briefly.');results.push('normal AI after second article');
  await logout();await login();await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor();await logout();
  assert.deepEqual(errors,[]);assert.ok(automaticRefreshes>0,'expired access tokens should renew automatically');results.push(`${automaticRefreshes} automatic refreshes after access-token expiry`);console.log(JSON.stringify({passed:true,results}));await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
