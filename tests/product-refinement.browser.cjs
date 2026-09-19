/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing optional browser runtime. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin=process.env.ASSISTANT_TEST_URL||'http://127.0.0.1:3101';
const phase=process.env.UI_PHASE||'landing';
const output='/tmp/abhiai-product-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];try{
 for(const width of [1440,768,390])for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('abhiai.theme',theme),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(phase==='landing'){
   await page.goto(origin);await page.getByRole('heading',{name:/Think deeper/}).waitFor();
   await page.screenshot({path:`${output}/landing-${width}-${theme}.png`});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'landing width');
   assert.equal(await page.locator('[data-scroll-navbar]').evaluate(el=>getComputedStyle(el).position),'sticky');
   await page.evaluate(()=>scrollTo(0,600));await page.waitForFunction(()=>document.querySelector('[data-scroll-navbar]').hasAttribute('data-scrolled'));
   const nav=await page.locator('[data-scroll-navbar]').boundingBox();assert(Math.abs(nav.y)<1,'nav stays at viewport top');
   if(width<=900){await page.getByLabel('Toggle navigation').click();await page.getByRole('navigation',{name:'Public navigation'}).getByRole('link',{name:'Product',exact:true}).click();assert.equal(await page.getByLabel('Toggle navigation').getAttribute('aria-expanded'),'false');}
   assert.equal(await page.getByText(/18.4K|2,418|88%/).count(),0,'no unsupported metrics');
   assert(await page.getByText('User controlled',{exact:true}).count());
   await page.getByRole('button',{name:'Analyze',exact:true}).click();assert(await page.getByText('Understand files and discussions',{exact:true}).isVisible());
   await page.getByRole('heading',{name:'Meet the Creator'}).scrollIntoViewIfNeeded();
   assert(await page.getByAltText('Portrait of Abhishek Prajapati, creator of AbhiAI').isVisible());
   await page.screenshot({path:`${output}/creator-${width}-${theme}.png`});
  }
  if(phase==='auth'){
   await page.goto(origin+'/login');await page.getByLabel('Email address',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByLabel('Full name').waitFor();
   if(width>600){await page.locator('[data-character="orange"]').waitFor({state:'attached'});assert.equal(await page.locator('[data-character]').count(),4);}
   const input=page.getByLabel('Email address',{exact:true});await input.fill('test@example.com');await input.focus();
   assert(await input.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el;}),'illustration does not cover form');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`${output}/auth-${width}-${theme}.png`,fullPage:true});
   assert.equal(new URL(page.url()).pathname,'/login');
  }
  assert.deepEqual(errors,[]);results.push({phase,width,theme,passed:true});await context.close();
 }
 console.log(JSON.stringify(results));fs.writeFileSync(`${output}/${phase}-results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
