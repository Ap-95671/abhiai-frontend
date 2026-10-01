/* eslint-disable @typescript-eslint/no-require-imports -- Focused Creator Studio browser check. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = '/tmp/abhiai-creator-qa';
fs.mkdirSync(output, { recursive: true });
// Fixtures are used only in intercepted test responses, never in the product.
const fixture = {
  days: 30, from: '2026-09-01', to: '2026-09-30', impressions: 12000, profileViews: 3000,
  uniquePostViewers: 8200, uniqueProfileViewers: 2400, engagements: 860,
  engagementRate: 7.17, followerGrowth: 124, totalFollowers: 1620,
  daily: Array.from({length: 30}, (_, i) => ({date: `2026-09-${String(i+1).padStart(2,'0')}`, impressions: Math.round(200 + i*12 + Math.sin(i)*90), profileViews: Math.round(60 + i*3 + Math.sin(i)*30), engagements: 20, followerGrowth: 4, uniquePostViewers: 150, uniqueProfileViewers: 40})),
  topPosts: [{postId:'one', textContent:'A closer look at the creative process', impressions:4200, uniqueViewers:3100, engagements:350, engagementRate:8.33}, {postId:'two',textContent:'Small moments from a weekend outdoors',impressions:2700,uniqueViewers:2100,engagements:190,engagementRate:7.04}],
  audienceLocations: [{location:'Mumbai',count:200,percentage:40}, {location:'Delhi',count:120,percentage:24}]
};
(async () => {
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 for(const width of [1440,768,390]) for(const theme of ['light','dark']) {
 const context=await browser.newContext({viewport:{width,height:1100},reducedMotion:'reduce'});
 await context.addInitScript(theme=>{localStorage.setItem('abhiai.access-token','test-token');localStorage.setItem('abhiai.theme',theme);},theme);
 const requests=[]; let empty=false, fail=false;
 await context.route('**/api/v1/**', async route=>{
 const url=new URL(route.request().url()),p=url.pathname.replace(/^.*\/api\/v1/,'');
 const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 if(route.request().method()==='OPTIONS') return route.fulfill({status:204});
 if(p==='/users/me') return json({id:'viewer',username:'testuser',displayName:'Test User',profilePicture:null});
 if(p==='/creator/analytics') { requests.push(url.searchParams.get('days')); if(fail)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Analytics unavailable'})}); return json(empty ? {...fixture,impressions:0,profileViews:0,daily:[],topPosts:[],audienceLocations:[]} : fixture); }
 if(p==='/assistant/config') return json({enabled:false,voiceAvailable:false});
 if(p==='/assistant/preferences')return json({mode:'STANDARD',pageContext:false,agentActions:false,proactive:false});
 if(p==='/notifications/unread-count')return json({unreadCount:0});
 if(['/assistant/tasks','/models','/conversations'].includes(p))return json([]);
 return json({content:[],last:true,totalElements:0});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3100/social?view=creator',{waitUntil:'domcontentloaded'});
 const workspace=page.getByRole('region',{name:'Creator analytics'});
 await workspace.getByRole('heading',{name:'Discovery mix'}).waitFor();
 assert.equal(await workspace.locator('article').count(),8);
 await page.getByRole('img',{name:'12,000 post impressions and 3,000 profile views'}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert(await workspace.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:`${output}/creator-${width}-${theme}.png`});
 let chart=workspace.getByRole('img',{name:'line chart of impressions and profile views'});
 await chart.focus();await chart.press('ArrowRight');await workspace.getByText(`${fixture.daily[1].impressions} impressions`,{exact:true}).waitFor();
 for(const type of ['bar','area','line']) {await workspace.getByRole('button',{name:type,exact:true}).click();await workspace.getByRole('img',{name:`${type} chart of impressions and profile views`}).waitFor();}
 await workspace.getByRole('combobox',{name:'Analytics time range'}).click();await page.getByRole('option',{name:'Last 7 days',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Creator analytics"] [aria-busy="true"]'));
 assert(requests.includes('7'));
 if(width===390 && theme==='dark') {
 empty=true;await page.reload();await workspace.getByText('Discovery insights appear when your posts or profile receive views.').waitFor();
 await workspace.getByText('Post insights appear after your content is viewed.').waitFor();
 fail=true;await page.reload();await workspace.getByRole('alert').waitFor();
 }
 assert.deepEqual(errors,[]);console.log('Passed Creator Studio:',width,theme);await context.close();
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
