'use strict';

// Volume, excerpt length and retrigger interval, in seconds.
const GAME_AUDIO_CUES={
 city:[.37,3.8,.3],grain:[.33,2.8,.3],wood:[.29,2.6,.3],
 iron:[.32,2.9,.3],cloth:[.34,2.7,.3],port:[.35,3.6,.3],ship:[.34,2.2,.3],unit:[.36,1.25,.3],
 march:[.45,2.2,1.4],build:[.38,1.4,1.2],load:[.28,.85,2.3],
 delivery:[.40,.55,2.3],trade:[.36,1.1,1.6],recruit:[.36,1.55,1.5],
 victory:[.40,3.2,2.5],defeat:[.35,2.35,2.5],capture:[.38,2.7,2.5],battle:[.40,1.8,2]
};

function createGameAudio(button){
 const samples=new Map(),lastCue=new Map(),voices=new Set();
 let audio=null,master=null,ready=null,muted=false,generation=0,selectionRequest=0,selectionVoice=null;
 const canPlay=()=>!muted&&!document.hidden&&!globalThis.gameShell?.paused;
 function unlock(){
  if(!canPlay()||!window.AudioContext)return;
  if(!audio){
   try{
    audio=new AudioContext();
    master=audio.createGain();master.gain.value=.80;master.connect(audio.destination);
   }catch{return}
  }
  if(audio.state!=='running'&&!ready){
   ready=audio.resume().catch(()=>{}).finally(()=>{ready=null});
  }
 }
 window.addEventListener('pointerdown',unlock,{capture:true,passive:true});
 window.addEventListener('keydown',unlock,{capture:true});

 function stop(){
  generation++;
  for(const {source} of voices)source.stop();
  selectionVoice=null;
  lastCue.clear();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 button.onclick=()=>{
  muted=!muted;
  button.setAttribute('aria-pressed',String(!muted));
  button.title=muted?'Включить звуковые эффекты':'Выключить звуковые эффекты';
  if(muted)stop();
  else unlock();
 };
 function sampleFor(kind){
  if(!samples.has(kind)){
   const promise=fetch('audio/'+kind+'.mp3').then(response=>{
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.arrayBuffer();
   }).then(bytes=>audio.decodeAudioData(bytes)).catch(error=>{
    samples.delete(kind);
    console.warn('Не удалось загрузить звук '+kind,error);
    return null;
   });
   samples.set(kind,promise);
  }
  return samples.get(kind);
 }
 function fadeOut(voice,now){
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(0,now,.025);
  voice.source.stop(now+.09);
 }
 async function play(kind,selection=false){
  const cue=GAME_AUDIO_CUES[kind];
  if(!cue||!audio||!canPlay()||audio.state!=='running'&&!ready)return;
  const [volume,maxDuration,interval]=cue,now=audio.currentTime;
  if(now-(lastCue.get(kind)??-Infinity)<interval)return;
  lastCue.set(kind,now);
  const request=selection?++selectionRequest:0,epoch=generation;
  const [buffer]=await Promise.all([sampleFor(kind),ready]);
  if(!buffer||!canPlay()||audio.state!=='running'||epoch!==generation||selection&&request!==selectionRequest)return;
  if(!selection&&voices.size>=4)return;
  const time=audio.currentTime,duration=Math.min(buffer.duration,maxDuration);
  if(selection&&selectionVoice)fadeOut(selectionVoice,time);
  const source=audio.createBufferSource(),gain=audio.createGain(),voice={source,gain};
  source.buffer=buffer;
  gain.gain.setValueAtTime(0,time);
  gain.gain.linearRampToValueAtTime(volume,time+Math.min(.045,duration*.2));
  gain.gain.setValueAtTime(volume,time+duration-Math.min(.19,duration*.4));
  gain.gain.linearRampToValueAtTime(0,time+duration);
  source.connect(gain);gain.connect(master);
  voices.add(voice);
  if(selection)selectionVoice=voice;
  source.onended=()=>{
   voices.delete(voice);
   if(selectionVoice===voice)selectionVoice=null;
   source.disconnect();gain.disconnect();
  };
  source.start(time,0,duration);
 }
 return {play,select:kind=>play(kind,true),stop};
}
