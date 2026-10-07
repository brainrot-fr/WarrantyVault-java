import {el,link as makeLink,field} from './core/dom.js';
import {formatDate as date,formatMoney,expiryText} from './core/format.js';
import {statusBadge as badge,toast,confirmDialog} from './components/index.js';
export function element(tag,props={},children=[]){return el(tag,props,Array.isArray(children)?children:children)}
export function link(label,href,className=''){return makeLink(label,href,className)}
export function statusBadge(label){return badge(label)}
export {formatMoney,confirmDialog,toast};
export function formatDate(value){return date(value)}
export function formatDateTime(value){return value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not set'}
export function describeExpiry(days,dateValue){return expiryText(days,dateValue)}
export function addField(parent,label,name,type='text',options={}){const input=field(label,name,type,options);parent.append(input);return input.querySelector('input')}
export function addTextarea(parent,label,name,options={}){const input=field(label,name,'text',options);const native=input.querySelector('input');const area=document.createElement('textarea');for(const [key,value] of Object.entries(options))if(value!=null)area.setAttribute(key,String(value));area.name=name;area.id=name;native.replaceWith(area);parent.append(input);return area}
export function addSelect(parent,label,name,options,value){const wrap=el('label',{className:'field'},el('span',{className:'field-label'},label));const select=el('select',{name,id:name},...options.map(([key,text])=>el('option',{value:key},text)));select.value=value??'';wrap.append(select);parent.append(wrap);return select}
export function addPasswordToggle(input){return input}
export function showMessage(region,message){region.replaceChildren(el('p',{className:'form-error','role':'alert'},message))}
export function showToast(message){toast(message)}
export function errorBox(error,retry){const node=el('section',{className:'empty-state'},el('h2',{},'Something went wrong'),el('p',{},error.message||'Try again in a moment.'));if(retry)node.append(el('button',{type:'button',className:'btn btn-secondary',onClick:retry},'Try again'));return node}
export function showFieldErrors(form,errors){let first=null;for(const [name,message] of Object.entries(errors||{})){const input=form.elements[name];if(input){input.setAttribute('aria-invalid','true');input.focus();first??=input}}return first}
export function safeNext(value){return value&&value.startsWith('/')&&!value.startsWith('//')?value:'/dashboard'}
