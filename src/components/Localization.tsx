import {useLayoutEffect} from 'react';
import {useSettings} from '@/stores/settings';
import translations from '@/data/localization.json';
const catalog=translations as Record<string,Record<string,string>>;
interface Original {source:string;rendered:string}
const textOriginals=new WeakMap<Text,Original>();
const attributeOriginals=new WeakMap<Element,Map<string,Original>>();
export function Localization(){
 const locale=useSettings(s=>s.settings.appLanguage);
 useLayoutEffect(()=>{
  document.documentElement.lang=locale;
  const translate=(source:string)=>{const trimmed=source.trim(),value=catalog[locale]?.[trimmed];return value?source.replace(trimmed,value):source;};
  const text=(node:Text)=>{if(node.parentElement?.closest('script,style,textarea,option[data-no-translate]'))return;const old=textOriginals.get(node);const source=old&&node.data===old.rendered?old.source:node.data;const rendered=locale==='cs'?source:translate(source);textOriginals.set(node,{source,rendered});if(node.data!==rendered)node.data=rendered;};
  const attributes=(element:Element)=>{let originals=attributeOriginals.get(element);if(!originals){originals=new Map();attributeOriginals.set(element,originals);}for(const name of ['aria-label','title','placeholder']){const value=element.getAttribute(name);if(value===null)continue;const old=originals.get(name),source=old&&value===old.rendered?old.source:value;const rendered=locale==='cs'?source:translate(source);originals.set(name,{source,rendered});if(value!==rendered)element.setAttribute(name,rendered);}};
  const apply=(root:Node)=>{if(root.nodeType===Node.TEXT_NODE){text(root as Text);return;}if(root instanceof Element)attributes(root);const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let node:Node|null;while((node=walk.nextNode())){if(node.nodeType===Node.TEXT_NODE)text(node as Text);else attributes(node as Element);}};
  apply(document.body);
  const observer=new MutationObserver(changes=>{for(const change of changes){if(change.type==='characterData')text(change.target as Text);else if(change.type==='attributes')attributes(change.target as Element);else for(const node of change.addedNodes)apply(node);}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
  return()=>observer.disconnect();
 },[locale]);return null;
}
