/* eslint-disable @typescript-eslint/no-require-imports -- Uses existing fixture/runtime. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const {setup,normal}=require('./assistant.browser.cjs');
const output='/tmp/abhiai-product-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];try{
 for(const width of [1440,768,390])for(const theme of ['dark','light']){
 const height=width===390?844:1000;
 const f=await setup(browser,{width,height});const {page,context}=f;let selection=null;
 await context.addInitScript(theme=>localStorage.setItem('abhiai.theme',theme),theme);
 await context.route('**/api/v1/models',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{id:'gemini:test',provider:'gemini',displayName:'Gemini',configured:true,status:'AVAILABLE',capabilities:['TEXT']},{id:'openai:test',provider:'openai',displayName:'OpenAI',configured:false,status:'UNAVAILABLE',capabilities:['TEXT']}])}));
 await context.route('**/api/v1/conversations/*/model',r=>{selection=r.request().postDataJSON();return r.fulfill({contentType:'application/json',body:JSON.stringify({...normal,modelSelectionMode:selection.selectionMode,preferredModelId:selection.selectedModelId})});});
 await page.reload();const model=page.getByRole('combobox',{name:'AI model',exact:true});await model.waitFor(); assert.equal(await model.innerText(),'AbhiAI Auto'); await model.click();
 const list=page.getByRole('listbox',{name:'AI model'});await list.waitFor();await list.getByText('Smart routing',{exact:true}).waitFor();assert(await page.getByRole('option',{name:/OpenAI/}).isDisabled());
 const b=await list.boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,'model dropdown fits');
 await page.getByRole('option',{name:/Gemini/}).click();await page.waitForFunction(()=>document.querySelector('[role="combobox"]')?.textContent.includes('Gemini'));
 assert.equal(selection.selectedModelId,'gemini:test');assert.equal(selection.selectionMode,'MANUAL');
 const toggle=page.getByRole('button',{name:'Web search',exact:true});await toggle.focus();await toggle.press("Space");assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.conversation-item small').count(),0);assert(await page.locator('.ai-welcome-mark img').count());
 await model.focus();await model.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');assert.equal(selection.selectionMode,'AUTO');
 await page.getByRole('button',{name:'Open AI tools'}).click();await page.getByRole('menuitem',{name:/Upload PDF/}).waitFor();await page.keyboard.press('Escape');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${output}/chat-${width}-${theme}.png`});assert.deepEqual(f.errors,[]);
 assert.equal(await page.locator('.ai-conversation-title').count(),0);
 assert.equal(await page.getByRole('button',{name:'AI Chat',exact:true}).count(),0);
 assert.equal(await page.locator('.quick-actions button svg').count(),3);
 assert.equal(await page.getByRole('button',{name:'Talk to AbhiAI',exact:true}).locator(':scope > svg').count(),1);
 const send=page.getByRole('button',{name:'Send message',exact:true});
 assert(await send.isDisabled());
 const emptySendColor=await send.evaluate(el=>getComputedStyle(el).backgroundColor);
 // Suggestions use the current conversation, and the welcome layout yields to messages.
 await page.getByRole('button',{name:/^Research Explore/}).click();
 assert.equal(await page.getByLabel('Message AbhiAI',{exact:true}).inputValue(),'Research the latest information about ');
 await page.getByLabel('Message AbhiAI',{exact:true}).fill('Explain arrays simply.');
 assert(await send.isEnabled());
 await page.waitForFunction(color=>getComputedStyle(document.querySelector('button[aria-label="Send message"]')).backgroundColor!==color,emptySendColor);
 await send.click();
 await page.getByText('Hello! Let’s explore that together.',{exact:true}).waitFor();
 assert.equal(f.state.textRequests.at(-1).body.webSearchAllowed,true);
 assert.equal(await page.locator('.ai-welcome').count(),0);
 assert.equal(await page.getByRole('button',{name:/^Research Explore/}).count(),0);
 const composer=await page.locator('form.composer').boundingBox();
 assert(composer.y>=0&&composer.y+composer.height<=height,'active composer remains visible');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:`${output}/chat-active-${width}-${theme}.png`});
 // Existing history and header actions remain available after the layout transition.
 await page.getByRole('button',{name:'Conversation options',exact:true}).click();
 await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Conversation options',exact:true}).click();
 await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 if(width===390){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Open account menu',exact:true}).waitFor({state:'visible'});await page.locator('.mobile-sidebar-trigger').click();}
 else {await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();}
 if(theme==='light'&&width!==768){
   await context.addInitScript(()=>localStorage.removeItem('abhiai.active-conversation-id'));
   await context.route('**/api/v1/conversations',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(r.request().method()==='POST'?normal:[])}));
   await page.reload();
   await page.getByLabel('Start a conversation with AbhiAI').waitFor();
   await page.screenshot({path:`${output}/chat-home-${width}-${theme}.png`});
   await page.getByLabel('Start a conversation with AbhiAI').fill('Start a fresh chat.');
   await page.getByRole('button',{name:'Start chat',exact:true}).click();
   await page.getByText('Hello! Let’s explore that together.',{exact:true}).waitFor();
   assert.equal(f.state.textRequests.at(-1).content,'Start a fresh chat.');
 }
 assert.deepEqual(f.errors,[]);
 results.push({width,theme,passed:true});await context.close();}
 console.log(JSON.stringify(results));fs.writeFileSync(`${output}/chat-results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
