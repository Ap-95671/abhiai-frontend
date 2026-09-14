/* eslint-disable @typescript-eslint/no-require-imports -- This Node test harness loads production TS without another dependency. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise production TypeScript without adding a second test framework/runtime.
function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  const context = { module: compiledModule, exports: compiledModule.exports, console, setTimeout, clearTimeout,
    AbortController, btoa, atob, DataView, Float32Array, crypto: require('node:crypto').webcrypto, ...globals,
    require: name => mocks[name] ?? (name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts'), mocks, globals) : require(name)),
  };
  vm.runInNewContext(source, context, { filename: file });
  return compiledModule.exports;
}
const root = path.resolve(__dirname, '../src/components/ai-character');
const state = load(path.join(root, 'assistant-state.ts'));
test('character supports voice, typed, interruption, recovery transitions', () => {
  let current = 'idle';
  for (const [event, expected] of [['listen','listening'],['think','thinking'],['speak','speaking'],['listen','listening'],['fail','error'],['settle','idle'],['think','thinking'],['settle','idle']]) {
    current = state.transition(current, event); assert.equal(current, expected);
  }
});
test('voice and text messages form one ordered, bounded realtime context', () => {
  let messages = state.upsertMessage([], { id:'voice-1', role:'USER', content:'Explain arrays', final:false });
  messages = state.upsertMessage(messages, { id:'voice-1', role:'USER', content:'Explain arrays', final:true });
  messages = state.upsertMessage(messages, { id:'text-2', role:'USER', content:'How are linked lists different?', final:true });
  assert.equal(messages.length, 2);
  const seeded = state.realtimeHistory(messages);
  assert.equal(seeded[0].parts[0].text, 'Explain arrays');
  assert.equal(seeded[1].parts[0].text, 'How are linked lists different?');
  assert.equal(state.realtimeHistory(Array.from({length:100}, (_,i)=>({id:String(i),role:'USER',content:'message',final:true}))).length,40);
});
const activeVoices=[];
test.afterEach(()=>{activeVoices.splice(0).forEach(v=>v.close());});
function fixture({ permission, sessionError } = {}) {
  const calls = [], messages = [], statuses = [], errors = [];
  const track = { enabled:true, onended:null, stopped:false, stop() { this.stopped = true; } };
  const stream = { getTracks:()=>[track], getAudioTracks:()=>[track] };
  class Socket {
    static OPEN=1; static last;
    constructor(url) { Socket.last=this; this.url=url; this.readyState=1; this.bufferedAmount=0; }
    send(value) { calls.push(JSON.parse(value)); }
    close() { this.closed=true; }
  }
  const contexts=[];
  const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
  class Context {
    constructor() { contexts.push(this); this.currentTime=0; this.sampleRate=48000; this.destination={}; this.audioWorklet={addModule:async()=>{}};this.buffers=[]; }
    resume(){return Promise.resolve();} close(){this.closed=true;return Promise.resolve();}
    createMediaStreamSource(){return node();}
    createMediaStreamDestination(){return {...node(),stream};}
    createBuffer(channels,length,rate){return {duration:length/rate,copyToChannel(){}};}
    createBufferSource(){const n={...node(),start(){},stop(){this.stopped=true;}};this.buffers.push(n);return n;}
  }
  class Worklet { constructor(){this.port={close(){}};} connect(){} disconnect(){} }
  class Meter { attach(){} stop(){} }
  class ApiError extends Error {}
  const api={
    createAssistantSession:async(token,body)=>{calls.push({type:'backend',token,body});if(sessionError)throw new ApiError('Gemini quota reached');return {id:body.id,token:'auth_tokens/one-use',model:'gemini-live',idleSeconds:120,expiresAt:new Date(Date.now()+900000).toISOString()};},
    closeAssistantSession:async(token,id)=>calls.push({type:'close',token,id}),
  };
  const {RealtimeVoice}=load(path.join(root,'realtime-voice.ts'),{'@/lib/api':{api,ApiError},'./audio-meter':{AudioMeter:Meter}}, {
    WebSocket:Socket,AudioContext:Context,AudioWorkletNode:Worklet,navigator:{mediaDevices:{getUserMedia:()=>permission?permission():Promise.resolve(stream)}},window:{isSecureContext:true},
  });
  const voice=new RealtimeVoice('jwt-test',{
    connection:s=>statuses.push(s),character:s=>calls.push({type:'character',s}),microphone:v=>calls.push({type:'mic',v}),busy:v=>calls.push({type:'busy',v}),
    message:m=>messages.push(m),level(){},error:e=>errors.push(e),
  });
  activeVoices.push(voice);
  const event=async e=>{Socket.last.onmessage?.({data:JSON.stringify(e)});await new Promise(r=>setImmediate(r));};
  const ready=async history=>{await voice.connect('same-conversation',history??[],true);Socket.last.onopen();await event({setupComplete:{}});};
  return {voice,track,stream,Socket,contexts,calls,messages,statuses,errors,event,ready};
}
test('permission denial never requests a Gemini token and keeps text possible',async()=>{
  const f=fixture({permission:()=>Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}))});
  await f.voice.connect('conversation',[],true);
  assert.equal(f.voice.connected,false);assert.match(f.errors[0],/Microphone access is disabled/);
  assert.equal(f.calls.filter(c=>c.type==='backend').length,0);assert.equal(f.contexts[0].closed,true);
});
test('closing during pending permission releases the late microphone',async()=>{
  let resolve;const f=fixture({permission:()=>new Promise(r=>resolve=r)});
  const work=f.voice.connect('conversation',[],true);f.voice.close();resolve(f.stream);await work;
  assert.equal(f.track.stopped,true);assert.equal(f.calls.filter(c=>c.type==='backend').length,0);
});
test('Gemini provisioning failure releases audio resources and exposes safe quota feedback',async()=>{
  const f=fixture({sessionError:true});await f.voice.connect('conversation',[],true);
  assert.equal(f.track.stopped,true);assert.equal(f.contexts[0].closed,true);assert.match(f.errors[0],/Gemini quota/);
});
test('Gemini setup seeds history before microphone capture and preserves typed turns',async()=>{
  const f=fixture();await f.ready([{id:'earlier',role:'USER',content:'Explain arrays',final:true}]);
  assert.equal(f.voice.connected,true);assert.match(f.Socket.last.url,/access_token=auth_tokens%2Fone-use/);
  assert(!f.Socket.last.url.includes('jwt-test'));assert.equal(f.calls.find(c=>c.clientContent).clientContent.turns[0].parts[0].text,'Explain arrays');
  assert(!('sdp' in f.calls.find(c=>c.type==='backend').body));
  f.voice.sendText('How are linked lists different?');
  assert(f.calls.some(c=>c.clientContent?.turns?.[0]?.parts[0].text==='How are linked lists different?'));
  await f.event({serverContent:{outputTranscription:{text:'Linked lists use nodes.'},modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
  await f.event({serverContent:{turnComplete:true}});assert.equal(f.messages.at(-1).final,false);
  f.contexts[0].buffers[0].onended();assert.equal(f.messages.at(-1).final,true);
  f.voice.stopMicrophone();assert(f.track.stopped);assert(f.calls.some(c=>c.realtimeInput?.audioStreamEnd));
  f.voice.close();f.voice.close();assert(f.Socket.last.closed);assert.equal(f.calls.filter(c=>c.type==='close').length,1);
});
test('Gemini interruptions stop queued audio and omit unplayed transcript',async()=>{
  const f=fixture();await f.ready();
  await f.event({serverContent:{inputTranscription:{text:'Explain arrays',finished:true}}});
  await f.event({serverContent:{outputTranscription:{text:'Unplayed response'},modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
  f.voice.interrupt();assert(f.calls.some(c=>c.clientContent?.turnComplete===false));
  assert(f.contexts[0].buffers[0].stopped);assert.equal(f.messages.at(-1).interrupted,true);assert(!f.messages.at(-1).content.includes('Unplayed response'));
  f.voice.close();
});
test('automatic Gemini barge-in clears queued speech',async()=>{
  const f=fixture();await f.ready();f.voice.sendText('Hello');
  await f.event({serverContent:{outputTranscription:{text:'Long response'},modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
  await f.event({serverContent:{interrupted:true}});assert(f.contexts[0].buffers[0].stopped);assert(f.messages.some(m=>m.interrupted));f.voice.close();
});
test('Auto Speak off consumes transcription without playing Gemini audio',async()=>{
  const f=fixture();await f.ready();f.voice.setAutoSpeak(false);f.voice.sendText('Hello');
  await f.event({serverContent:{outputTranscription:{text:'Hello!'},modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]},}});
  await f.event({serverContent:{turnComplete:true}});assert.equal(f.contexts[0].buffers.length,0);assert.equal(f.messages.at(-1).content,'Hello!');assert(f.messages.at(-1).final);f.voice.close();
});
test('late input transcription stays ahead of the model and is not split by output chunks',async()=>{
  const f=fixture();await f.ready();f.voice.setAutoSpeak(false);
  await f.event({serverContent:{outputTranscription:{text:'Answer'}}});
  await f.event({serverContent:{inputTranscription:{text:'Explain '}}});
  await f.event({serverContent:{outputTranscription:{text:' continued'}}});
  await f.event({serverContent:{inputTranscription:{text:'arrays.',finished:true}}});
  await f.event({serverContent:{turnComplete:true}});
  const final=f.messages.reduce((items,m)=>state.upsertMessage(items,m),[]);
  assert.equal(final.length,2);assert.equal(final[0].role,'USER');assert.equal(final[0].content,'Explain arrays.');
  assert(final.every(m=>m.final));assert.equal(final[1].content,'Answer continued');f.voice.close();
});
test('PCM conversion handles resampling, clipping and little-endian signed audio',()=>{
  const pcm=load(path.join(root,'pcm-audio.ts'));
  const encoded=pcm.encodePcm(new Float32Array([-2,-2,-2,1,1,1,0,0,0]),48000);
  const decoded=pcm.decodePcm(encoded);assert.equal(decoded.length,3);assert.equal(decoded[0],-1);assert(decoded[1]>.99);assert.equal(decoded[2],0);
  assert.throws(()=>pcm.decodePcm('AA=='),/Invalid PCM/);
});
test('audio-driven meter samples real signal values, smooths them, and releases its animation loop', () => {
  let frame, cancelled=false, disconnected=0;
  const levels=[];
  const context={
    createMediaStreamSource:()=>({connect(){},disconnect(){disconnected++;}}),
    createAnalyser:()=>({fftSize:256,getByteTimeDomainData:values=>values.fill(150),disconnect(){disconnected++;}}),
  };
  const { AudioMeter }=load(path.join(root,'audio-meter.ts'),{}, {
    requestAnimationFrame:callback=>{frame=callback;return 1;},cancelAnimationFrame:()=>{cancelled=true;},
  });
  const meter=new AudioMeter(context,value=>levels.push(value));meter.attach({});frame(34);
  assert(levels.at(-1)>0&&levels.at(-1)<1);const previous=levels.at(-1);frame(68);assert(levels.at(-1)>previous);
  meter.stop();assert(cancelled);assert.equal(disconnected,2);assert.equal(levels.at(-1),0);
});
