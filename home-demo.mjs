// Isolated demonstration: these sample questions are deliberately not the live question bank.
const bank=await fetch('demo-content.json').then(r=>r.json());
const rewards=await fetch('rewards.json').then(r=>r.json());
try{bank.push(...JSON.parse(sessionStorage.getItem('onehome-v4-demo-books')||'[]'))}catch{}
const key='onehome-v5-demo';let d;try{d=JSON.parse(sessionStorage.getItem(key))}catch{}
const now=()=>new Date().toISOString();
if(!d){d={school:'Example Academy · Demonstration',settings:{ready:true,years:[7,8,9,10,11],board:'AQA',starReader:false,college:true,collegeOff:[]},classes:[{id:'demo-10',name:'10A · Maths & reading',year:10},{id:'demo-11',name:'11B · Maths & reading',year:11}],students:[{id:'demo-student',first:'Alex',last:'Taylor',year:11,class_ids:['demo-11'],last_seen:now()},{id:'demo-student2',first:'Maya',last:'Bennett',year:10,class_ids:['demo-10'],last_seen:null}],tasks:[],progress:[],awards:[{student_id:'demo-student',item:'demo-welcome-stars',service:'reader',points:100,created_at:now()},{student_id:'demo-student',item:'demo-welcome-power',service:'maths',points:70,created_at:now()}]};d.tasks.push({id:'demo-task',class_id:'demo-11',service:'maths',title:'A little algebra practice',items:[bank.find(c=>c.kind==='math').id],points:10,release_at:new Date(Date.now()-86400000).toISOString(),due_at:new Date(Date.now()+604800000).toISOString()})}
d.wallet??={saved:{reader:20,maths:10},spent:{reader:0,maths:0},owned:[],equipped:{}};
const save=()=>sessionStorage.setItem(key,JSON.stringify(d));
export async function demoCall(action,a={},mode='admin'){
 const pupil=d.students[0],student=mode==='student',isAdmin=mode==='admin';
 if(['settings','import','sync','rotate'].includes(action)&&!isAdmin)throw Error('School administrator access required.');
 
 if(['roster_import','membership','graduate','graduates','restore_graduate','class_staff'].includes(action)&&!isAdmin)throw Error('School administrator access required.');
 d.members??=[{id:'demo-teacher',email:'teacher@example.test'}];d.passes??=[];d.claims??=[];
 if(action==='buddy_type'){if(d.settings.buddy===false)throw Error('Study buddy is disabled by your school.');d.wallet.buddy=a.buddy;save();return demoCall('wallet',{},mode)}
 if(action==='roster_import'){const rows=[];for(const r of a.rows){let p=d.students.find(s=>s.email===r.email||s.id===a.source+':'+r.externalId);if(p?.graduated_at)throw Error('Restore this graduate first.');const code=p?null:crypto.randomUUID().replaceAll('-','').toUpperCase();if(!p){p={id:a.source+':'+r.externalId,class_ids:[]};d.students.push(p)}Object.assign(p,{first:r.first,last:r.last,email:r.email,provider:r.provider,year:r.year,active:true});const ids=r.classes.map(n=>{let c=d.classes.find(c=>c.year===r.year&&c.name.toUpperCase()===n.toUpperCase());if(!c){c={id:'class:'+r.year+':'+n,name:n,year:r.year,staff_ids:[],restricted:true};d.classes.push(c)}return c.id});p.class_ids=a.membership==='replace'?ids:[...new Set([...p.class_ids,...ids])];rows.push({id:p.id,name:r.first+' '+r.last,code})}save();return rows}
 if(action==='membership'){if(!a.students.length)throw Error('Choose students.');for(const id of a.students){const p=d.students.find(s=>s.id===id);if(a.operation!=='add'&&!p.class_ids.includes(a.class))throw Error('Selected student is not in this class.');if(a.operation!=='remove'&&!d.classes.some(c=>c.id===(a.operation==='move'?a.to:a.class)&&c.year===p.year))throw Error('Choose a destination in the same year.');p.class_ids=a.operation==='remove'?p.class_ids.filter(c=>c!==a.class):a.operation==='move'?[...new Set([...p.class_ids.filter(c=>c!==a.class),a.to])]:[...new Set([...p.class_ids,a.class])]}save();return {saved:true}}
 if(action==='graduates')return structuredClone(d.students.filter(s=>s.graduated_at));
 if(action==='graduate'){if(a.confirm!=='GRADUATE YEAR 11'||!a.students.length)throw Error('Select leavers and type GRADUATE YEAR 11.');for(const id of a.students){const p=d.students.find(s=>s.id===id);if(!p||p.year!==11)throw Error('Choose Year 11 students.');p.active=false;p.graduated_at=now()}save();return {saved:true}}
 if(action==='restore_graduate'){const p=d.students.find(s=>s.id===a.student);p.active=true;p.graduated_at=null;save();return {saved:true}}
 if(['advent_status','advent_claim','pass_request'].includes(action)){
  const date=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'}),[year,month,today]=date.split('-').map(Number),open=month===12&&today<=25&&d.settings.advent!==false;
  if(action==='advent_claim'){if(!open||a.day!==today)throw Error('Only today’s December door can be opened.');if(!d.claims.some(c=>c.year===year&&c.day===today)){const reward=today===25?{kind:'homework_pass'}:{kind:'points',service:Math.random()<.5?'reader':'maths',points:5+Math.floor(Math.random()*5)*5};d.claims.push({year,day:today,reward});if(today<25)d.awards.push({student_id:pupil.id,item:'advent-'+year+'-'+today,service:reward.service,points:reward.points,created_at:now()})}}
  if(action==='pass_request'){if(!d.claims.some(c=>c.year===a.year&&c.day===25))throw Error('No Christmas pass.');const prior=d.passes.find(p=>p.year===a.year);if(prior&&prior.status!=='declined')throw Error('Pass already requested or used.');if(prior){prior.task_id=a.task;prior.status='pending'}else d.passes.push({student_id:pupil.id,year:a.year,task_id:a.task,status:'pending'})}
  save();return structuredClone({year,today,date,open,claims:d.claims,passes:d.passes})
 }
 if(action==='pass_decide'){const p=d.passes.find(p=>p.student_id===a.student&&p.year===a.year&&p.status==='pending');if(student||!p)throw Error('Staff request unavailable.');p.status=a.status;save();return {saved:true}}


 if(['wallet','save_points','buy','equip','care','buddy_name'].includes(action)){
  const w=d.wallet,earned=Object.fromEntries(['reader','maths'].map(s=>[s,d.awards.filter(v=>v.student_id===pupil.id&&v.service===s).reduce((n,v)=>n+v.points,0)]));
  if(['buddy_name','care','equip'].includes(action)&&d.settings.buddy===false)throw Error('Study buddy is disabled by your school.');
  if(action==='buddy_name'){if(!a.name?.trim()||a.name.length>24)throw Error('Use 1–24 characters.');w.name=a.name.trim()}
  if(action==='care'&&Date.now()-new Date(w[a.kind]||0).getTime()>=86400000){if(earned.maths-w.spent.maths-w.saved.maths<5)throw Error('You need 5 available Power Points.');w.spent.maths+=5;w[a.kind]=now()}

  if(action==='save_points'){if(a.amount>earned[a.service]-w.spent[a.service]-w.saved[a.service]||-a.amount>w.saved[a.service])throw Error('Not enough available or saved points.');w.saved[a.service]+=a.amount}
  if(action==='buy'){const r=rewards.find(r=>r.id===a.reward);if(!w.owned.includes(r.id)){if(r.cost>earned[r.service]-w.spent[r.service]-w.saved[r.service])throw Error('Not enough available points.');w.spent[r.service]+=r.cost;w.owned.push(r.id)}}
  if(action==='equip'){const r=rewards.find(r=>r.id===a.reward);if(!w.owned.includes(r.id))throw Error('Buy first.');w.equipped[r.category]=a.remove?null:r.id}
  save();return structuredClone({...w,earned})
 }
 if(action==='book_upload'){if(!isAdmin)throw Error('Administrator required.');const id='custom-'+crypto.randomUUID();bank.push({id,kind:'book',data:a.book});sessionStorage.setItem('onehome-v4-demo-books',JSON.stringify(bank.filter(b=>b.id.startsWith('custom-'))));return {id}}
 if(['annual_open','annual_answer'].includes(action)){
  const year=new Date().getFullYear()-(new Date().getMonth()<8?1:0),id='annual-'+year;let pr=d.progress.find(p=>p.id===id);if(!pr){const completed=d.progress.filter(p=>p.data.complete).map(p=>bank.find(b=>b.id===p.id&&b.kind==='book')).filter(Boolean);if(!completed.length)return {year,eligible:false,questions:[]};pr={id,student_id:pupil.id,data:{year,refs:completed.flatMap(b=>b.data.questions.map((q,i)=>({book:b.id,question:i}))).slice(0,10),answers:{},score:0,complete:false}};d.progress.push(pr)}
  const v=pr.data;if(action==='annual_answer'&&!v.complete&&v.answers[a.question]===undefined){const ref=v.refs[a.question],q=bank.find(b=>b.id===ref.book).data.questions[ref.question];v.answers[a.question]=a.answer;if(q.correct===a.answer)v.score++;v.complete=Object.keys(v.answers).length===v.refs.length;if(v.complete&&!d.awards.some(a=>a.item===id))d.awards.push({student_id:pupil.id,item:id,service:'reader',points:v.score*2,created_at:now()})}
  save();return {...v,eligible:true,points:v.complete?v.score*2:0,questions:v.refs.map(ref=>({...ref,title:bank.find(b=>b.id===ref.book).data.title,questionData:bank.find(b=>b.id===ref.book).data.questions[ref.question]}))}
 }
 if(action==='tick'||action==='status')return {saved:true};
 if(action==='email_roster'){if(!isAdmin)throw Error('Administrator required.');for(const row of a.rows){const s=d.students.find(s=>s.id===row.id);if(!s)throw Error('Student not found.');s.email=row.email;s.provider=row.provider}save();return {saved:true}}
 if(['staff','student'].includes(action)){d.students[0].last_seen=now();save();return structuredClone({...d,role:student?'student':isAdmin?'admin':'teacher',student:pupil,students:student?[]:d.students.filter(s=>s.active!==false),catalog:bank.filter(c=>c.kind!=='test').map(c=>({id:c.id,kind:c.kind,...c.data,pages:undefined,questions:undefined})),tasks:d.tasks.filter(t=>!student||t.class_id===pupil.class_ids[0]&&new Date(t.release_at)<=new Date()),progress:d.progress.filter(p=>!student||p.student_id===pupil.id),awards:d.awards.filter(p=>!student||p.student_id===pupil.id)})}
 if(action==='preview'){if(student)throw Error('Staff access required.');return {content:bank.find(c=>c.id===a.id).data}}
 if(action==='class_staff'){const c=d.classes.find(c=>c.id===a.class);c.staff_ids=a.staff;c.restricted=true}
 else if(action==='settings')d.settings={...d.settings,...a};
 else if(action==='college_class')d.settings.collegeOff=a.enabled?d.settings.collegeOff.filter(c=>c!==a.class):[...d.settings.collegeOff,a.class];
 else if(action==='sync')return {count:d.students.length};
 else if(action==='import'){const rows=a.rows.map(r=>{const id=a.source+':'+r.externalId,cid=a.source+':'+r.class;let p=d.students.find(p=>p.id===id);if(!d.classes.some(c=>c.id===cid))d.classes.push({id:cid,name:r.class,year:r.year});const code=p?null:crypto.randomUUID().replaceAll('-','').toUpperCase();if(!p){p={id,first:r.first,last:r.last,year:r.year,class_ids:[cid],last_seen:null};d.students.push(p)}else if(!p.class_ids.includes(cid))p.class_ids.push(cid);return {name:r.first+' '+r.last,id,code}});save();return rows}
 else if(action==='rotate')return {code:crypto.randomUUID().replaceAll('-','').toUpperCase()};
 else if(action==='reading_age'){const p=d.students.find(p=>p.id===a.student);p.reading_age=a.age;p.age_source=a.source}
 else if(action==='task')d.tasks.unshift({id:crypto.randomUUID(),class_id:a.class,service:a.service,title:a.title,items:a.items,points:a.points,release_at:a.release,due_at:a.due});
 else if(action==='archive')d.tasks=d.tasks.filter(t=>t.id!==a.id);
 else {
  const c=bank.find(c=>c.id===a.id);if(!c)throw Error('Content not found.');
  if(c.kind==='book'&&!d.progress.find(p=>p.id==='reading-check')?.data.complete)throw Error('Complete your reading check first.');
  if(c.data.college&&(!d.settings.college||d.settings.collegeOff.some(c=>pupil.class_ids.includes(c))))throw Error('College reading is disabled.');
  const id=c.kind==='math'?a.id+':'+(a.task||'revision'):a.id;
  let p=d.progress.find(p=>p.id===id&&p.student_id===pupil.id);if(!p){p={id,student_id:pupil.id,data:{}};d.progress.push(p)}
  if(action==='hint'){if(a.tool==='pet'&&(d.settings.buddy===false||!d.wallet.water||!d.wallet.fed))throw Error('Feed and water your study buddy first.');if(a.tool!=='pet'&&!d.wallet.owned.includes('reward-21'))throw Error('Buy the hint tool first.');return {eliminate:(c.data.questions[a.question].correct+1)%4}}
  if(action==='open'){save();return {id:a.id,content:{...c.data,pages:undefined,pagesCount:c.kind==='book'?c.data.pages.length:undefined,questions:c.data.questions.map(({correct,explanation,...q})=>q)},progress:structuredClone(p.data)}}
  if(action==='page'){if(a.page>(p.data.page||0)+1)throw Error('Read in order.');p.data.page=Math.max(p.data.page||0,a.page);save();return {text:c.data.pages[a.page],page:a.page,pages:c.data.pages.length}}
  if(action==='test_save'){if(!p.data.complete){p.data.answers={...p.data.answers,...a.answers};if(a.submit){if(Object.keys(p.data.answers).length!==50)throw Error('Answer all 50 questions.');p.data.score=c.data.questions.filter((q,i)=>q.correct===p.data.answers[i]).length;p.data.complete=true;p.data.level=p.data.score<20?'Supported':p.data.score<35?'Developing':'Confident'}}save();return p.data}
  if(action==='answer'){const q=c.data.questions[a.question];p.data.answers??={};p.data.correct??={};if(!p.data.correct[a.question]){p.data.answers[a.question]=a.answer;p.data.correct[a.question]=q.correct===a.answer}p.data.score=Object.values(p.data.correct).filter(Boolean).length;p.data.total=c.data.questions.length;p.data.complete=p.data.score===p.data.total;const item=c.kind==='math'?id+':q'+a.question:c.data.long?id+':cp'+q.checkpoint:id;const checkpoint=c.kind==='math'?p.data.correct[a.question]:c.data.long?c.data.questions.every((v,i)=>v.checkpoint!==q.checkpoint||p.data.correct[i]):p.data.complete;if(checkpoint&&!d.awards.some(x=>x.item===item&&x.student_id===pupil.id))d.awards.push({student_id:pupil.id,item,service:c.kind==='math'?'maths':'reader',points:c.kind==='math'?5:d.settings.starReader?20:10,created_at:now()});save();return {progress:p.data,correct:p.data.correct[a.question],answer:q.choices[q.correct],explanation:q.explanation}}
 }
 save();return {saved:true};
}
