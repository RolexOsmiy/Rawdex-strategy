'use strict';

(() => {
 const languages=[
  ['ru','Русский'],['en','English'],['de','Deutsch'],['fr','Français'],['es','Español'],
  ['pt-BR','Português (Brasil)'],['pl','Polski'],['tr','Türkçe'],['zh-CN','简体中文'],
  ['ja','日本語'],['ko','한국어'],['uk','Українська']
 ];
 const codeFor=value=>{
  const tag=String(value||'').toLowerCase();
  return languages.find(([code])=>code.toLowerCase()===tag)?.[0]||
   languages.find(([code])=>tag.split('-')[0]===code.toLowerCase().split('-')[0])?.[0];
 };
 const preferenceKey='baltic-ways.language';
 const query=new URLSearchParams(location.search), preference=query.get('lang');
 let saved;
 try{saved=localStorage.getItem(preferenceKey)}catch{}
 const locale=codeFor(preference)||codeFor(saved)||codeFor(navigator.language)||'ru';
 const column=languages.findIndex(([code])=>code===locale);
 const normalize=value=>value.trim().replace(/\s+/g,' ');
 const fold=value=>value.toLocaleLowerCase('ru');
 const cyrillic=/\p{Script=Cyrillic}/u;
 const numeric=/^[+−-]?\d[\d.,\u00a0\u202f ]*$/u;
 const word=/[\p{L}\p{M}\p{N}]/u;
 const words=value=>value.match(/[\p{L}\p{M}]+/gu)||[];
 const parameter=/\{(\d+)\}/g;
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const lookup=new Map(), folded=new Map(), byAnchor=new Map(), fragments=new Map();
 const cache=new Map(), missed=query.has('locale-debug')?new Set():null;
 const add=(index,key,item)=>{
  if(!index.has(key))index.set(key,[]);
  index.get(key).push(item);
 };

 for(const line of globalThis.balticLocaleCatalog.split('\n')){
  const entries=line.split('|');
  if(entries.length!==languages.length)continue;
  const source=normalize(entries[0]), target=entries[column];
  lookup.set(source,target);
  if(!folded.has(fold(source)))folded.set(fold(source),target);
  if(locale==='ru')continue;
  const segments=source.split(parameter);
  const staticWords=words(segments.filter((_,i)=>i%2===0).join(' ')).filter(text=>cyrillic.test(text));
  if(segments.length>1){
   if(!staticWords.length||/\}\{/.test(source))continue;
   const anchor=fold(staticWords.reduce((a,b)=>a.length>=b.length?a:b));
   const regex=new RegExp('^'+segments.map((part,i)=>i%2?'(.*?)':escape(part)).join('')+'$','iu');
   const weight=segments.reduce((n,part,i)=>i%2?n:n+part.length,0);
   add(byAnchor,anchor,{weight,target,regex,fields:segments.filter((_,i)=>i%2)});
  }else if(source.length>2&&staticWords.length&&/[\p{L}\p{N}]/u.test(source[0])){
   if(words(source).length===1&&source.length<=3&&!/[.]/.test(source)&&!['Рим','Лес','Мир','До','На','из','все'].includes(source))continue;
   add(fragments,fold(source).match(/^[\p{L}\p{M}\p{N}]+/u)[0],{source:fold(source),target});
  }
 }
 for(const list of fragments.values())list.sort((a,b)=>b.source.length-a.source.length);

 const fullDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 const shortDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'});
 const monthDate=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'});
 const longMonths=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'});
 const russianMonths=Array.from({length:12},(_,month)=>
  longMonths.formatToParts(new Date(Date.UTC(1619,month,1))).find(part=>part.type==='month').value);
 const numbers=new Intl.NumberFormat(locale,{maximumFractionDigits:10});
 const numberParts=numbers.formatToParts(1000.1);
 const separator=numberParts.find(part=>part.type==='decimal').value;
 const group=numberParts.find(part=>part.type==='group')?.value;
 const grouped=group&&new RegExp('^[+−-]?\\d{1,3}(?:'+escape(group)+'\\d{3})+(?:'+escape(separator)+'\\d+)?$','u');
 const calendar=(date,year=true)=>(year?fullDate:shortDate).format(new Date(Date.UTC(date.year,date.month,date.day)));
 const month=(year,index)=>monthDate.format(new Date(Date.UTC(year,index,1)));
 const decimal=value=>{
  if(grouped?.test(value))return value;
  const raw=value.replace(/[\u00a0\u202f ]/g,'').replace('−','-').replace(',','.');
  const number=Number(raw);
  if(!Number.isFinite(number))return value;
  const fraction=raw.split('.')[1]?.length||0;
  if(fraction>10)return value;
  if(!fraction)return (raw.startsWith('+')?'+':'')+numbers.format(number);
  return (raw.startsWith('+')?'+':'')+number.toLocaleString(locale,{minimumFractionDigits:fraction,maximumFractionDigits:fraction});
 };
 const translateArgument=(value,depth)=>numeric.test(value)?decimal(value):translate(value,depth+1);
 const known=value=>lookup.get(value)??folded.get(fold(value));
 const format=(value,...parameters)=>{
  if(value==null)return '';
  const label=String(value);
  if(!parameters.length)return display(label);
  const translated=known(normalize(label))??label;
  return translated.replace(parameter,(match,index)=>{
   const value=parameters[index];
   return value==null?match:locale==='ru'?String(value):translateArgument(String(value),0);
  });
 };
 function fill(template,text,depth){
  const match=template.regex.exec(text);
  if(!match)return null;
  const parameters=new Map(template.fields.map((field,index)=>[field,match[index+1]]));
  return template.target.replace(parameter,(_,index)=>translateArgument(parameters.get(index),depth));
 }
 function localDate(text){
  const match=/^(\d{1,2}) (\p{L}+) (\d{4})(?: г\.)?$/u.exec(text);
  if(!match)return null;
  const month=russianMonths.indexOf(fold(match[2]));
  return month<0?null:calendar({day:+match[1],month,year:+match[3]});
 }
 function embedded(text){
  const lower=fold(text);
  const translated=[];
  let cursor=0;
  for(const match of lower.matchAll(/[\p{L}\p{M}\p{N}]+/gu)){
   const start=match.index;
   if(start<cursor)continue;
   const choices=fragments.get(match[0]);
   if(!choices)continue;
   const entry=choices.find(({source})=>lower.startsWith(source,start)&&!word.test(lower[start+source.length]||''));
   if(!entry)continue;
   translated.push(text.slice(cursor,start),entry.target);
   cursor=start+entry.source.length;
  }
  if(!cursor)return text;
  translated.push(text.slice(cursor));
  return translated.join('');
 }
 function translate(value,depth=0){
  if(!value||!cyrillic.test(value)||depth>12)return value;
  const text=normalize(value);
  const exact=known(text);
  if(exact!==undefined)return exact;
  const date=localDate(text);
  if(date)return date;
  const candidates=new Set();
  for(const token of words(text))for(const item of byAnchor.get(fold(token))||[])candidates.add(item);
  for(const template of [...candidates].sort((a,b)=>b.weight-a.weight)){
   const result=fill(template,text,depth);
   if(result!==null)return result;
  }
  if(/ [·•] /.test(text))return text.split(/( [·•] )/).map((part,index)=>index%2?part:translate(part,depth+1)).join('');
  const prefix=/^([^\p{L}\p{N}]+)(.+)$/u.exec(text);
  if(prefix){const translated=translate(prefix[2],depth+1);if(translated!==prefix[2])return prefix[1]+translated}
  const sentences=text.split(/(?<=[.!?]) (?=[А-ЯЁ][а-яё]{2})/u);
  if(sentences.length>1&&sentences.some(sentence=>known(sentence)!==undefined)){
   return sentences.map(sentence=>translate(sentence,depth+1)).join(' ');
  }
  const result=embedded(text);
  if(missed&&missed.size<4096&&((locale!=='uk'&&cyrillic.test(result))||result===text))missed.add(text);
  return result;
 }
 function rendered(value){
  if(locale==='uk'&&cyrillic.test(value)){
   if(cache.size>=4096)cache.clear();
   cache.set(value,value);
  }
  return value;
 }
 function display(value){
  if(locale==='ru'||!value||!cyrillic.test(value))return value;
  if(cache.has(value))return cache.get(value);
  const result=value.split('\n').map(line=>line.replace(/\S(?:.*\S)?/u,text=>translate(text))).join('\n');
  if(cache.size>=4096)cache.clear();
  cache.set(value,result);
  return result;
 }

 const localeLabel=document.getElementById('front-language');
 if(localeLabel){
  for(const [code,label] of languages){
   const option=document.createElement('option');
   option.value=code;
   option.lang=code;
   option.textContent=label;
   localeLabel.append(option);
  }
  localeLabel.value=locale;
  localeLabel.addEventListener('change',()=>{
   const next=codeFor(localeLabel.value);
   if(!next||next===locale)return;
   try{localStorage.setItem(preferenceKey,next)}catch{}
   const url=new URL(location.href);
   url.searchParams.set('lang',next);
   location.replace(url);
  });
 }
 if(codeFor(preference)){
  try{localStorage.setItem(preferenceKey,locale)}catch{}
 }
 document.documentElement.lang=locale;
 document.title=format(document.title||'Балтийские пути');
 globalThis.gameI18n={locale,text:format,display,rendered,date:calendar,month};
 if(missed)globalThis.gameI18n.missing=()=>[...missed];

 const keepLanguage=link=>{
  const href=link.getAttribute('href');
  if(!href?.startsWith('./')&&!href?.startsWith('../'))return;
  const url=new URL(href,location.href);
  url.searchParams.set('lang',locale);
  if(link.href!==url.href)link.href=url.href;
 };
 if(locale==='ru'){
  if(preference)for(const link of document.querySelectorAll('a[href]'))keepLanguage(link);
  return;
 }

 // Rendering strings are localized at the DOM boundary, leaving game data and event
 // identifiers in the simulation untouched. Frame-driven layers use the same dictionary.
 const attributes=['aria-label','aria-description','aria-valuetext','title','alt','placeholder'];
 const ignored='script,style,noscript,option[lang],svg :not(title):not(desc):not(text)';
 const localized=new WeakMap();
 function localizeAttribute(node,attribute){
  const value=node.getAttribute(attribute);
  if(!value||!cyrillic.test(value))return;
  const last=localized.get(node);
  if(last?.[attribute]===value)return;
  const result=display(value);
  if(result!==value){
   localized.set(node,{...last,[attribute]:result});
   node.setAttribute(attribute,result);
  }
 }
 function localize(node){
  if(node.nodeType===Node.TEXT_NODE){
   if(!cyrillic.test(node.data)||!node.parentElement||node.parentElement.closest(ignored)||
    localized.get(node)===node.data)return;
   const translated=display(node.data);
   if(translated!==node.data){localized.set(node,translated);node.data=translated}
   return;
  }
  if(node.nodeType!==Node.ELEMENT_NODE||node.closest(ignored))return;
  if(node.matches('a[href]'))keepLanguage(node);
  for(const attribute of attributes)localizeAttribute(node,attribute);
  for(const child of node.childNodes)localize(child);
 }
 localize(document.body);
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='childList')for(const node of record.addedNodes)localize(node);
   else if(record.type==='characterData')localize(record.target);
   else if(!record.target.closest(ignored))localizeAttribute(record.target,record.attributeName);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
})();
