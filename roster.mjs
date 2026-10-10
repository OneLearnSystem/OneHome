import {parseCSV} from './home-core.mjs';
export const fields={name:['studentname','fullname','name'],first:['first','firstname','forename'],last:['last','lastname','surname'],parentEmail:['parentemail','parentemailaddress','guardianemail'],email:['schoolemail','studentemail','studentemailaddress'],year:['year','yeargroup'],classes:['classes','class','classname','teachinggroups','registrationform'],externalId:['studentid','externalid','arborstudentid','upn','id']};
const norm=s=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
export function columns(text){const a=parseCSV(text.replace(/^\uFEFF/,''));if(a.length<2)throw Error('Add a header and student rows.');return {headers:a[0],map:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,a[0].findIndex(h=>v.includes(norm(h)))]))}}
function hash(s){let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0)}return (a>>>0).toString(16)+(b>>>0).toString(16)}
export function roster(text,map,year='',provider='email'){
 const lines=parseCSV(text.replace(/^\uFEFF/,''));lines.shift();if(lines.length>500)throw Error('Import up to 500 students at a time.');
 const rows=[],ids=new Set();
 for(const [i,line] of lines.entries()){const get=k=>map[k]>=0?(line[map[k]]||'').trim():'';
 let first=get('first'),last=get('last');if(!first){const parts=get('name').split(/\s+/);first=parts.shift()||'';last=parts.join(' ')}
 const parentEmail=get('parentEmail').toLowerCase(),email=get('email').toLowerCase(),y=Number((get('year')||year).replace(/^year\s*/i,''));
 const classes=[...new Set(get('classes').split(/[,;|]/).map(c=>c.trim().replace(/\s+/g,' ').toUpperCase()).filter(Boolean))];
 if(!first||first.length>80||last.length>80||!/^\S+@[^@\s]+\.[^@\s]+$/.test(parentEmail)||(email&&!/^\S+@[^@\s]+\.[^@\s]+$/.test(email))||!Number.isInteger(y)||y<7||y>11||classes.length<1||classes.length>10||classes.some(c=>c.length>120))throw Error('Check row '+(i+2)+': name, parent email, Year 7–11 and 1–10 classes are required.');
 if(year&&y!==Number(year))throw Error('Row '+(i+2)+' has a different year.');
 const externalId=get('externalId')||'local-'+hash([first.toLowerCase(),last.toLowerCase(),parentEmail,y].join('|'));
 if(externalId.length>100||ids.has(externalId))throw Error('Duplicate or invalid Student ID at row '+(i+2)+'. Keep all classes on one row; give different students distinct IDs.');
 ids.add(externalId);rows.push({externalId,first,last,parentEmail,email,year:y,classes,provider,generatedId:!get('externalId')});
 }
 return {rows,duplicates:0,classes:[...new Set(rows.flatMap(s=>s.classes.map(c=>s.year+' · '+c)))]};
}

