/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing browser fixture. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const {setup}=require('./assistant.browser.cjs');
const output='/tmp/abhiai-product-qa';const origin=process.env.ASSISTANT_TEST_URL||'http://localhost:3100';fs.mkdirSync(output,{recursive:true});
const post={id:'44444444-4444-4444-8444-444444444444',author:{id:'55555555-5555-4555-8555-555555555555',username:'maya',displayName:'Maya Shah',profilePicture:null,profileMediaId:null},textContent:'A small idea: keep useful notes beside the conversation that inspired them.',visibility:'PUBLIC',replyCount:0,likeCount:0,repostCount:0,bookmarkCount:0,viewCount:0,pinned:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),media:[],poll:null};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];try{
 for(const width of [1440,768,390])for(const theme of ['dark','light']){
 const f=await setup(browser,{width,height:1000});const {page,context}=f;let region='global';let statuses=0;
 await context.addInitScript(theme=>localStorage.setItem('abhiai.theme',theme),theme);
 await context.route('**/api/v1/stories/feed?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({content:[],last:true})}));
 await context.route('**/api/v1/feed?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({content:[post],page:0,size:20,totalElements:1,totalPages:1,first:true,last:true})}));
 await context.route('**/api/v1/posts/*/**',r=>{if(r.request().method()==='GET')statuses++;return r.fulfill({contentType:'application/json',body:JSON.stringify({liked:r.request().method()==='POST',reposted:false,bookmarked:false})});});
 await context.route('**/api/v1/news/top?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({content:[],page:0,limit:5,totalResults:0,hasMore:false,updatedAt:new Date().toISOString(),stale:false})}));
 await context.route('**/api/v1/news?*',r=>{region=new URL(r.request().url()).searchParams.get('region');return r.fulfill({contentType:'application/json',body:JSON.stringify({content:[],limit:10,page:0,hasMore:false,totalResults:0,updatedAt:new Date().toISOString(),stale:false,available:true})});});
 await page.goto(origin+'/social');await page.getByLabel('Create a social post',{exact:true}).waitFor();
 const visibility=page.getByRole('combobox',{name:'Post visibility',exact:true});await visibility.click();await page.getByRole('option',{name:'Only me',exact:true}).click();assert((await visibility.innerText()).includes('Only me'));
 await page.waitForTimeout(200);assert(statuses>=3);await page.getByRole('button',{name:'Like post',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:'Unlike post',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.social-post').evaluate(el=>getComputedStyle(el).borderRadius),'12px');assert(await page.locator('.user-avatar-fallback[data-tone]').count());
 await page.screenshot({path:`${output}/social-feed-${width}-${theme}.png`});
 const nav=page.getByRole('navigation',{name:'Workspace',exact:true});
 async function showNav(){if(await page.getByRole('button',{name:'Open navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();}
 await showNav();assert.equal(await nav.getByRole('button',{name:'Articles',exact:true}).isVisible(),false);
 for(const name of ['Feed','Explore','News','Communities','Messages','Notifications','Profile'])assert(await nav.getByRole('button',{name,exact:true}).isVisible(),name);
 await nav.getByRole('button',{name:'More',exact:true}).click();for(const name of ['Articles','Creator Studio','Stories','Videos','Tags','Search'])assert(await nav.getByRole('button',{name,exact:true}).isVisible(),name);
 await page.screenshot({path:`${output}/social-nav-${width}-${theme}.png`});
 await nav.getByRole('button',{name:'News',exact:true}).click();const regionControl=page.getByRole('combobox',{name:'News region',exact:true});await regionControl.waitFor();await regionControl.click();const list=page.getByRole('listbox',{name:'News region'});const box=await list.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);await page.getByRole('option',{name:'India',exact:true}).click();await page.waitForTimeout(450);assert.equal(region,'india');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${output}/social-news-${width}-${theme}.png`});
 await showNav();if(await nav.getByRole('button',{name:'More',exact:true}).getAttribute('aria-expanded')==='false')await nav.getByRole('button',{name:'More',exact:true}).click();await nav.getByRole('button',{name:'Stories',exact:true}).click();await page.locator('.empty-media-preview').waitFor();await page.screenshot({path:`${output}/social-stories-${width}-${theme}.png`});
 await showNav();if(await nav.getByRole('button',{name:'More',exact:true}).getAttribute('aria-expanded')==='false')await nav.getByRole('button',{name:'More',exact:true}).click();await nav.getByRole('button',{name:'Videos',exact:true}).click();await page.locator('.empty-video-preview').waitFor();
 await showNav();await nav.getByRole('button',{name:'Communities',exact:true}).click();await page.getByRole('heading',{name:'Find a space for your interests.'}).waitFor();await page.screenshot({path:`${output}/social-communities-${width}-${theme}.png`});
 assert.deepEqual(f.errors,[]);results.push({width,theme,passed:true});console.log('Passed',width,theme);await context.close();}
 fs.writeFileSync(`${output}/social-results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
