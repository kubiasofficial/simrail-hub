import {createPortal} from 'react-dom';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function AppDialog({title,close,children,className=''}:{title:string;close:()=>void;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDialogElement>(null),closeRef=useRef(close),id=useId();closeRef.current=close;
 useEffect(()=>{const d=ref.current!,previous=document.activeElement;d.showModal();const closed=()=>closeRef.current();d.addEventListener('close',closed);return()=>{d.removeEventListener('close',closed);d.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
 return createPortal(<dialog ref={ref} className={'app-dialog '+className} aria-labelledby={id} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target!==e.currentTarget)return;const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close();}}><header className="app-dialog-header"><h2 id={id}>{title}</h2><button aria-label="Zavřít dialog" className="dialog-close" onClick={close}><X size={21}/></button></header>{children}</dialog>,document.body);
}
