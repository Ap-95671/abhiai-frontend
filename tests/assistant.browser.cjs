/* eslint-disable @typescript-eslint/no-require-imports -- Optional browser acceptance script uses the installed Playwright runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.ASSISTANT_TEST_URL || 'http://localhost:3100';
const output = process.env.ASSISTANT_QA_DIR || '/tmp/abhiai-assistant-qa';
fs.mkdirSync(output, {recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';
const normalId='33333333-3333-4333-8333-333333333333';
const date='2026-09-09T00:00:00Z';
const empty={content:[],page:0,size:20,totalElements:0,totalPages:0,first:true,last:true};
const profile={id:userId,username:'testuser',displayName:'Test User',profilePicture:null,avatarMediaId:null,bio:null,coverPicture:null,location:null,website:null,createdAt:date,updatedAt:date,followerCount:0,followingCount:0,postCount:0,showLikesOnProfile:true,accountPrivacy:'PUBLIC'};
const conversation={id,title:'AbhiAI Assistant',createdAt:date,updatedAt:date,modelSelectionMode:'AUTO',preferredModelId:null,messages:[]};
const normal={...conversation,id:normalId,title:'Existing AI chat',messages:[]};

async function setup(browser, viewport) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const state={history:[],created:0,closed:0,textRequests:[],transcripts:[],sessionFailure:false,saveFailure:false};
  await context.addInitScript(({userId,normalId})=>{
    localStorage.setItem('abhiai.access-token','mock-jwt');
    localStorage.setItem('abhiai.active-conversation-id',normalId);
    localStorage.setItem(`abhiai.assistant.auto-speak.${userId}`,'off');
    window.__micDenied=true; window.__tracks=[]; window.__sent=[];
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      if(window.__micDenied) throw new DOMException('denied','NotAllowedError');
      const context=new AudioContext(), destination=context.createMediaStreamDestination();
      const track=destination.stream.getAudioTracks()[0];window.__tracks.push(track);
      track.addEventListener('ended',()=>context.close());
      return destination.stream;
    }});
    const NativeSocket=window.WebSocket;
    class Socket {
      static OPEN=1;
      constructor(url){
        if(!String(url).includes('BidiGenerateContentConstrained'))return new NativeSocket(url);
        window.__socket=this;this.readyState=1;this.bufferedAmount=0;
        setTimeout(()=>this.onopen?.(),20);
      }
      send(raw){const event=JSON.parse(raw);if(!event.realtimeInput?.audio)window.__sent.push(event);
        if(event.setup)setTimeout(()=>window.__emit({setupComplete:{}}),20);
      }
      close(){this.closed=true;this.readyState=3;}
    }
    window.WebSocket=Socket;
    window.__emit=event=>window.__socket.onmessage?.({data:JSON.stringify(event)});
  },{userId,normalId});
  await context.route('**/api/v1/**',async route=>{
    const req=route.request(), url=new URL(req.url()), p=url.pathname.replace(/^.*\/api\/v1/,'');
    const json=async(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(p==='/assistant/config') return json({enabled:true,voiceAvailable:true});
    if(p==='/assistant/conversation') return json({...conversation,messages:state.history});
    if(p==='/assistant/sessions') {
      state.created++; if(state.sessionFailure)return json({message:'Unavailable'},503);
      return json({id:req.postDataJSON().id,token:'auth_tokens/browser-test',model:'gemini-live',expiresAt:new Date(Date.now()+900000).toISOString(),idleSeconds:120},201);
    }
    if(p.startsWith('/assistant/sessions/')) {state.closed++;return route.fulfill({status:204});}
    if(p.includes('/transcript')) {
      if(state.saveFailure)return json({message:'Try again'},503);
      const messages=req.postDataJSON().messages;state.transcripts.push(...messages);
      messages.forEach(m=>{if(!state.history.some(old=>old.id===m.id))state.history.push({...m,createdAt:date});});
      return route.fulfill({status:204});
    }
    if(p.endsWith('/messages/stream')) {
      const content=req.postDataJSON().content;state.textRequests.push({path:p,content,body:req.postDataJSON(),history:[...state.history]});
      const user={id:crypto.randomUUID(),role:'USER',content,createdAt:date};
      const reply={id:crypto.randomUUID(),role:'ASSISTANT',content:'Hello! Let’s explore that together.',createdAt:date};
      if(p.includes(id))state.history.push(user,reply);
      return route.fulfill({contentType:'text/event-stream',body:`event: chunk\ndata: Hello! \n\nevent: complete\ndata: ${JSON.stringify({userMessage:user,assistantMessage:reply,conversation})}\n\n`});
    }
    if(p==='/users/me'||p==='/users/testuser')return json(profile);
    if(p==='/conversations')return json(req.method()==='POST'?normal:[normal]);
    if(p===`/conversations/${normalId}`)return json(normal);
    if(p.includes('/attachments'))return json([]);
    if(p==='/models')return json([]);
    if(p==='/memory')return json({enabled:false,memories:[]});
    if(p==='/notifications/unread-count')return json({unreadCount:0});
    if(p.includes('/news'))return json({...empty,articles:[],items:[],stale:false,available:true});
    if(p.includes('/stories'))return json([]);
    if(p.includes('follow-status'))return json({following:false});
    if(p.includes('block-status'))return json({blockedByMe:false,blockedMe:false});
    return json(empty);
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/chat');
  try { await page.getByRole('button',{name:'Talk to AbhiAI',exact:true}).waitFor(); }
  catch (error) { console.error('Page errors:',errors); console.error((await page.locator('body').innerText()).slice(0,1400)); throw error; }
  return {context,page,state,errors};
}
async function open(page){await page.getByRole('button',{name:'Talk to AbhiAI',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByLabel('Message AbhiAI Assistant').waitFor();await page.getByRole('button',{name:'Start live microphone'}).waitFor({state:'visible'});}
async function bounds(page){return page.getByRole('dialog').evaluate(el=>{
  const box=el.getBoundingClientRect(), input=el.querySelector('textarea').getBoundingClientRect();
  return {width:box.width,height:box.height,left:box.left,right:box.right,bottom:box.bottom,inputBottom:input.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:el.scrollWidth>el.clientWidth+1};
});}
async function run(){
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
  try {
    const f=await setup(browser,{width:1440,height:1000}); const {page,state}=f;
    const launcher=await page.getByRole('button',{name:'Talk to AbhiAI',exact:true}).boundingBox();
    const composer=await page.locator('form.composer').boundingBox();
    assert(launcher.y+launcher.height<=composer.y,'launcher must clear the original composer');
    await open(page);
    await page.getByLabel('Message AbhiAI Assistant').fill('Hello.');await page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await page.getByRole('dialog').getByText('Hello! Let’s explore that together.',{exact:true}).waitFor();
    assert.equal(state.textRequests[0].path,`/conversations/${id}/messages/stream`);
    await page.getByRole('button',{name:'Minimize assistant and stop microphone'}).click();await open(page);
    assert.equal(await page.getByRole('dialog').getByText('Hello.',{exact:true}).count(),1);
    await page.getByRole('button',{name:'Start live microphone'}).click();
    await page.getByRole('alert').getByText(/Microphone access is disabled/).waitFor();assert.equal(state.created,0);
    await page.getByLabel('Message AbhiAI Assistant').fill('Text after denied microphone');await page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#assistant-message').value==='');
    await page.evaluate(()=>{window.__micDenied=false;});await page.getByRole('button',{name:'Start live microphone'}).click();
    await page.getByText('Live voice connected',{exact:true}).waitFor();
    assert((await page.evaluate(()=>window.__sent)).some(e=>e.clientContent?.turns?.some(t=>t.parts?.[0]?.text==='Hello.')));
    await page.evaluate(()=>{
      window.__emit({serverContent:{inputTranscription:{text:'Explain arrays.',finished:true}}});
      window.__emit({serverContent:{outputTranscription:{text:'Arrays hold ordered elements.'}}});
      window.__emit({serverContent:{turnComplete:true}});
    });
    await page.getByRole('dialog').getByText('Explain arrays.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Minimize assistant and stop microphone'}).click();
    await page.waitForFunction(()=>window.__tracks.every(t=>t.readyState==='ended'));
    await open(page);
    await page.getByLabel('Message AbhiAI Assistant').fill('How are linked lists different?');await page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#assistant-message').value==='');
    assert(state.textRequests.at(-1).history.some(m=>m.content==='Explain arrays.'));
    const tail=state.transcripts.slice(-2);assert.equal(tail[0].role,'USER');assert.equal(tail[1].role,'ASSISTANT');
    // Real Web Audio oscillator as a deterministic test signal (no microphone/audio API billing).
    await page.getByRole('button',{name:'Auto Speak off'}).click();
    await page.getByRole('button',{name:'Start live microphone'}).click();
    await page.getByText('Live voice connected',{exact:true}).waitFor();
    await page.evaluate(()=>{
      const bytes=new Uint8Array(24000*2*3),view=new DataView(bytes.buffer);
      for(let i=0;i<bytes.length/2;i++)view.setInt16(i*2,Math.sin(i*2*Math.PI*440/24000)*6000,true);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      window.__emit({serverContent:{inputTranscription:{text:'Explain stacks.',finished:true}}});
      window.__emit({serverContent:{outputTranscription:{text:'A stack is last in, first out.'},modelTurn:{parts:[{inlineData:{data:btoa(binary),mimeType:'audio/pcm;rate=24000'}}]}}});
    });
    await page.getByRole('dialog').getByText('Speaking…',{exact:true}).waitFor();
    await page.waitForFunction(()=>{
      const avatar=document.querySelector('dialog [data-state="speaking"]');
      return avatar&&Number(avatar.style.getPropertyValue('--mouth-open'))>0.05;
    });
    await page.getByRole('button',{name:'Interrupt AbhiAI speech'}).click();
    assert((await page.evaluate(()=>window.__sent)).some(e=>e.clientContent?.turnComplete===false));
    await page.evaluate(()=>{window.__socket.onerror?.();});
    await page.getByRole('alert').getByText(/Gemini Live could not connect/).waitFor();
    await page.waitForFunction(()=>window.__tracks.every(t=>t.readyState==='ended'));
    await page.getByRole('button',{name:'Auto Speak on'}).click();
    await page.getByLabel('Message AbhiAI Assistant').fill('Continue after the network interruption');
    await page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#assistant-message').value==='');
    await page.screenshot({path:path.join(output,'desktop-dark.png')});
    await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
    await page.screenshot({path:path.join(output,'desktop-light.png')});
    await page.getByRole('button',{name:'Close assistant and end voice session'}).click();
    await page.getByLabel('Message AbhiAI',{exact:true}).fill('Existing chat still works');await page.getByLabel('Message AbhiAI',{exact:true}).press('Enter');
    await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Message AbhiAI"]').value==='');
    assert(state.textRequests.at(-1).path.includes(normalId));
    // Reload restores server history; normal app routes still render with the launcher.
    await page.reload();await open(page);
    await page.getByRole('dialog').getByText('Explain arrays.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Close assistant and end voice session'}).click();
    for (const route of ['/social','/news','/social?view=profile&username=testuser','/social?view=notifications','/social?view=search','/chat']) {
      await page.goto(origin+route);
      await page.getByRole('button',{name:'Talk to AbhiAI',exact:true}).waitFor();
      assert.equal(await page.locator('main.app-shell').count(),1);
    }
    assert.equal(f.errors.length,0,f.errors.join('\\n'));
    await f.context.close();
    for(const [name,width,height] of [['android',360,640],['iphone',390,844],['tablet',768,1024],['laptop',1366,768],['desktop',1920,1080],['landscape',844,390],['keyboard',390,420]]) {
      const f=await setup(browser,{width,height});await open(f.page);
      const b=await bounds(f.page);assert(!b.overflow,`${name}: overflow`);assert(b.left>=0&&b.right<=width+1,`${name}: panel clipped`);assert(b.inputBottom<=height,`${name}: input below viewport`);
      const animation=await f.page.locator('dialog svg g').first().evaluate(el=>getComputedStyle(el).animationName);assert.equal(animation,'none');
      await f.page.screenshot({path:path.join(output,`${name}.png`)});
      if(width<=700){await f.page.goBack();await f.page.getByRole('dialog').waitFor({state:'hidden'});}
      assert.equal(f.errors.length,0,f.errors.join('\n'));await f.context.close();
    }
    const failure=await setup(browser,{width:1000,height:800});await open(failure.page);
    await failure.page.evaluate(()=>{window.__micDenied=false;});
    await failure.page.getByRole('button',{name:'Start live microphone'}).click();
    await failure.page.getByText('Live voice connected',{exact:true}).waitFor();
    failure.state.saveFailure=true;
    await failure.page.evaluate(()=>{
      window.__emit({serverContent:{inputTranscription:{text:'Keep this context.',finished:true}}});
    });
    await failure.page.getByRole('button',{name:'Minimize assistant and stop microphone'}).click();await open(failure.page);
    await failure.page.getByRole('button',{name:'Retry saving'}).waitFor();
    await failure.page.getByLabel('Message AbhiAI Assistant').fill('Continue from that.');
    await failure.page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await failure.page.getByRole('alert').getByText(/Check the conversation/).waitFor();
    assert.equal(failure.state.textRequests.length,0,'text cannot silently omit unsaved voice context');
    assert.equal(await failure.page.getByLabel('Message AbhiAI Assistant').inputValue(),'Continue from that.');
    failure.state.saveFailure=false;await failure.page.getByRole('button',{name:'Retry saving'}).click();
    await failure.page.getByRole('button',{name:'Retry saving'}).waitFor({state:'hidden'});
    await failure.page.getByRole('dialog').getByRole('button',{name:'Send message',exact:true}).click();
    await failure.page.waitForFunction(()=>document.querySelector('#assistant-message').value==='');
    assert(failure.state.textRequests[0].history.some(m=>m.content==='Keep this context.'));
    await failure.context.close();
    console.log(JSON.stringify({passed:true,checks:['text','minimize/reopen','permission denied','text fallback','text to voice context','voice to text context','transcript order','microphone cleanup','audio-driven mouth','barge-in','network failure/text fallback','existing chat','reload persistence','social/news/profile/notifications/search navigation','dark/light','reduced motion','mobile back','seven viewports','failed persistence blocks context loss and retries'],screenshots:output},null,2));
  } finally {await browser.close();}
}
module.exports={setup,open,bounds,profile,conversation,normal,id,userId,empty,date};
if(require.main===module) run().catch(error=>{console.error(error);process.exitCode=1;});
