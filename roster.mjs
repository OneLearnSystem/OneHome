
import {parseCSV} from './home-core.mjs';
export const fields={name:['studentname','fullname','name','legalname'],first:['first','firstname','forename','legalfirstname'],last:['last','lastname','surname','legallastname'],email:['schoolemail','email','emailaddress','studentemailaddress'],year:['year','yeargroup','academicyear'],classes:['classes','class','classname','registrationform','registrationformname','tutorgroup','teachinggroups','group','team'],externalId:['externalid','studentid','arborstudentid','id','upn']};
const norm=s=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
export function columns(text){const data=parseCSV(text.replace(/^\uFEFF/,''));if(data.length<2)throw Error('Add headers and at least one student row.');return {headers:data[0],map:Object.fromEntries(Object.entries(fields).map(([k,a])=>[k,data[0].findIndex(h=>a.includes(norm(h)))]))}}
export function roster(text,map,year='',provider='email'){
 const raw=parseCSV(text.replace(/^\uFEFF/,''));raw.shift();if(raw.length>500)throw Error('Use up to 500 rows per import.');
 const students=new Map(),ids=new Map();let duplicates=0;
 for(const [i,row] of raw.entries()){
  const get=k=>map[k]>=0?(row[map[k]]||'').trim():'';
  let first=get('first'),last=get('last');if(!first){const full=get('name').split(/\s+/);first=full.shift()||'';last=full.join(' ')}
  const email=get('email').toLowerCase(),rowYear=get('year'),y=Number((rowYear||year).replace(/^year\s*/i,'')),externalId=get('externalId')||email;
  const classes=[...new Set(get('classes').split(/[,;|]/).map(s=>s.trim().replace(/\s+/g,' ').toUpperCase()).filter(Boolean))];
  if(!first||first.length>80||last.length>80||!/^\S+@[^@\s]+\.[^@\s]+$/.test(email)||!Number.isInteger(y)||y<7||y>11||!classes.length||classes.length>30||classes.some(c=>c.length>120)||externalId.length>100)throw Error('Check row '+(i+2)+': student name, school email, Year 7–11 and classes are required.');
  if(year&&rowYear&&y!==Number(year))throw Error('Row '+(i+2)+' has a different year from the selected import year.');
  if(ids.has(externalId)&&ids.get(externalId)!==email)throw Error('The same student ID has different emails. Review row '+(i+2)+'.');ids.set(externalId,email);
  const old=students.get(email);
  if(old){if(old.first!==first||old.last!==last||old.year!==y||old.externalId!==externalId)throw Error('Conflicting details for '+email+'.');old.classes=[...new Set([...old.classes,...classes])];duplicates++}
  else students.set(email,{externalId,first,last,email,year:y,classes,provider});
 }
 return {rows:[...students.values()],duplicates,classes:[...new Set([...students.values()].flatMap(s=>s.classes.map(c=>s.year+' · '+c)))]};
}

