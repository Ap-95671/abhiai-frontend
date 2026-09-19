/* eslint-disable @typescript-eslint/no-require-imports -- Uses existing fixture/runtime. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const {setup,normal}=require('./assistant.browser.cjs');
const output='/tmp/abhiai-product-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];try{
 for(const width of [1440,768,390])for(const theme of ['dark','light']){
 const f=await setup(browser,{width,height:1000});const {page,context}=f;let selection=null;
 await context.addInitScript(theme=>localStorage.setItem('abhiai.theme',theme),theme);
 await context.route('**/api/v1/models',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{id:'gemini:test',provider:'gemini',displayName:'Gemini',configured:true,status:'AVAILABLE',capabilities:['TEXT']},{id:'openai:test',provider:'openai',displayName:'OpenAI',configured:false,status:'UNAVAILABLE',capabilities:['TEXT']}])}));
 await context.route('**/api/v1/conversations/*/model',r=>{selection=r.request().postDataJSON();return r.fulfill({contentType:'application/json',body:JSON.stringify({...normal,modelSelectionMode:selection.selectionMode,preferredModelId:selection.selectedModelId})});});
 await page.reload();const model=page.getByRole('combobox',{name:'AI model',exact:true});await model.waitFor(); await model.click();
 const list=page.getByRole('listbox',{name:'AI model'});await list.waitFor();assert(await page.getByRole('option',{name:/OpenAI/}).isDisabled());
 const b=await list.boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=1000,'model dropdown fits');
 await page.getByRole('option',{name:/Gemini/}).click();await page.waitForFunction(()=>document.querySelector('[role="combobox"]')?.textContent.includes('Gemini'));
 assert.equal(selection.selectedModelId,'gemini:test');assert.equal(selection.selectionMode,'MANUAL');
 const toggle=page.getByRole('switch',{name:'Allow web search for this message'});await toggle.focus();await toggle.press("Space");assert.equal(await toggle.getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('.conversation-item small').count(),0);assert(await page.locator('.assistant-home-avatar svg').count());
 await model.focus();await model.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');assert.equal(selection.selectionMode,'AUTO');
 await page.getByRole('button',{name:'Open AI tools'}).click();await page.getByRole('menuitem',{name:/Upload PDF/}).waitFor();await page.keyboard.press('Escape');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${output}/chat-${width}-${theme}.png`});assert.deepEqual(f.errors,[]);
 results.push({width,theme,passed:true});await context.close();}
 console.log(JSON.stringify(results));fs.writeFileSync(`${output}/chat-results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
