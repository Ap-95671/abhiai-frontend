/* eslint-disable @typescript-eslint/no-require-imports -- Existing browser acceptance runtime. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');const assert=require('node:assert/strict');
const {setup}=require('./assistant.browser.cjs');const origin=process.env.ASSISTANT_TEST_URL||'http://localhost:3101';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
const f=await setup(browser,{width:390,height:844},true);const {context,page}=f;let fail=true,refreshes=0,logouts=0,release;
let gate=new Promise(resolve=>{release=resolve;});
await context.addCookies([{name:'abhiai.refresh-session',value:'test-refresh',url:origin+'/api/auth/refresh',httpOnly:true,sameSite:'Lax'}]);
await context.route('**/api/auth/**',async route=>{
 if(route.request().url().endsWith('/refresh')){refreshes++;return route.fulfill({contentType:'application/json',body:JSON.stringify({accessToken:'resurrected-token'})});}
 if(route.request().url().endsWith('/logout')){logouts++;await gate;return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{message:'Test service unavailable'}:{}),headers:fail?{}:{'Set-Cookie':'abhiai.refresh-session=; Path=/; Max-Age=0'}});}
 return route.fallback();
});
await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Open account menu',exact:true}).click();await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();
// The login UI must be available before the delayed logout response is released.
await page.getByRole('button',{name:'Log in',exact:true}).waitFor({timeout:3000});assert.equal(logouts,1);assert.equal(await page.evaluate(()=>localStorage.getItem('abhiai.access-token')),null);
release();await page.getByText(/Signed out on this device/).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('abhiai.logout-pending')),'true');
await page.reload();await page.getByRole('button',{name:'Retry session restoration',exact:true}).waitFor();assert.equal(refreshes,0);assert.equal(await page.getByRole('button',{name:'Open account menu',exact:true}).count(),0);
await page.goto(origin+'/social');await page.getByRole('button',{name:'Retry session restoration',exact:true}).waitFor();assert.equal(refreshes,0);
fail=false;gate=Promise.resolve();await page.getByRole('button',{name:'Retry session restoration',exact:true}).click();await page.getByRole('button',{name:'Log in',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('abhiai.logout-pending')),null);assert.equal(refreshes,0);assert.deepEqual(f.errors,[]);
console.log(JSON.stringify({passed:true,checks:['immediate logout before server response','503 shown honestly','refresh and protected route stay signed out with stale cookie','revocation retried successfully','no auth refresh resurrection']}));
await context.close();}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
