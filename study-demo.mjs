const lessons=await fetch('demo-lessons.json').then(r=>r.json()),rewards=await fetch('rewards.json').then(r=>r.json());
const now=()=>new Date().toISOString(),key='onestudy-v10-demo';
let d;try{d=JSON.parse(sessionStorage.getItem(key))}catch{}
d||={courses:[],tasks:[],attempts:[],submissions:[],private:{}};
function shared(){
 let s;try{s=JSON.parse(sessionStorage.getItem('onehome-v5-demo'))}catch{}
 s||={school:'Example Academy · Demonstration',settings:{ready:true,years:[7,8,9,10,11],buddy:true},classes:[{id:'demo-10',name:'10A',year:10},{id:'demo-11',name:'11B',year:11}],students:[{id:'demo-student',first:'Alex',last:'Taylor',year:11,class_ids:['demo-11']}],tasks:[],progress:[],awards:[]};
 s.wallet||={saved:{reader:0,maths:0},spent:{reader:0,maths:0},owned:[],equipped:{},name:'Milo',buddy:'fox'};
 if(!s.awards.some(a=>a.item==='study-demo-welcome'))s.awards.push({student_id:'demo-student',item:'study-demo-welcome',service:'maths',points:3000,created_at:now()},{student_id:'demo-student',item:'study-demo-stars',service:'reader',points:3000,created_at:now()});
 return s;
}
function save(s){sessionStorage.setItem(key,JSON.stringify(d));sessionStorage.setItem('onehome-v5-demo',JSON.stringify(s))}
function award(s,item,points){if(!s.awards.some(a=>a.item===item))s.awards.push({student_id:'demo-student',item,service:'maths',points,created_at:now()})}
export async function demoCall(action,a={},mode='student',legacy=false){
 const s=shared(),p=s.students.find(x=>x.id==='demo-student'),w=s.wallet;
 const earned=()=>Object.fromEntries(['reader','maths'].map(k=>[k,s.awards.filter(x=>x.student_id===p.id&&x.service===k).reduce((n,x)=>n+x.points,0)]));
 if(legacy){
  if(action==='buy'){const r=rewards.find(x=>x.id===a.reward);if(!r)throw Error('Reward unavailable.');if(!w.owned.includes(r.id)){if(earned()[r.service]-(w.spent[r.service]||0)-(w.saved[r.service]||0)<r.cost)throw Error('Not enough points.');w.spent[r.service]=(w.spent[r.service]||0)+r.cost;w.owned.push(r.id)}}
  if(action==='equip'){const r=rewards.find(x=>x.id===a.reward);if(!r||!w.owned.includes(r.id))throw Error('Buy this reward first.');w.equipped[r.category]=a.remove?null:r.id}
  if(action==='buddy_name'){if(!a.name?.trim()||a.name.length>24)throw Error('Use 1–24 characters.');w.name=a.name.trim()}
  if(action==='buddy_type')w.buddy=a.buddy;
  if(action==='buddy_random'){const extras=await fetch('student-extras.json').then(r=>r.json());w.name=extras.names[Math.floor(Math.random()*extras.names.length)]}
  save(s);return structuredClone({...w,earned:earned()});
 }
 let result;
 if(action==='student'||action==='staff')result={role:mode==='student'?'student':'teacher',settings:s.settings,school:s.school,student:mode==='student'?p:null,students:mode==='student'?[]:s.students,classes:mode==='student'?s.classes.filter(c=>p.class_ids.includes(c.id)):s.classes,catalog:lessons.map(({id,subject,year,title,summary,minutes,tags})=>({id,subject,year,title,summary,minutes,tags})),...structuredClone(d)};
 if(action==='student')result.tasks=result.tasks.filter(t=>!t.archived&&new Date(t.release_at)<=new Date()&&p.class_ids.includes(t.class_id));
 if(action==='preview')result=lessons.find(x=>x.id===a.id);
 if(action==='lesson'){const l=lessons.find(x=>x.id===a.id);result={...l,questions:l.questions.map(({correct,...q})=>q)}}
 if(action==='answer'){const l=lessons.find(x=>x.id===a.id),q=l.questions[a.question],ok=Number(a.answer)===q.correct;let row=d.attempts.find(x=>x.lesson_id===a.id&&x.question===a.question);if(!row){row={student_id:p.id,lesson_id:a.id,question:a.question,attempts:0,first_correct:ok,solved:false};d.attempts.push(row)}row.attempts++;row.solved||=ok;row.updated_at=now();if(d.attempts.filter(x=>x.lesson_id===a.id&&x.solved).length===l.questions.length)award(s,'study-lesson:'+a.id,5);result={correct:ok,explanation:ok?q.explanation:q.hint}}
 if(action==='save'){d.private=a.data;result={saved:true}}
 if(action==='course'){const c=s.classes.find(x=>x.id===a.class);if(c.year<10&&a.board||['French','German'].includes(a.subject)&&['OCR','Eduqas'].includes(a.board))throw Error('Choose an available board.');d.courses=d.courses.filter(x=>!(x.class_id===a.class&&x.subject===a.subject));d.courses.push({class_id:a.class,subject:a.subject,board:a.board,route:a.route,notes:a.notes});result={saved:true}}
 if(action==='assign'){if(!a.lessons.length||a.lessons.length>10||new Date(a.due)<=new Date(a.release))throw Error('Choose 1–10 lessons and valid dates.');d.tasks.push({id:crypto.randomUUID(),class_id:a.class,subject:a.subject,title:a.title,lesson_ids:a.lessons,instructions:a.instructions,points:a.points,release_at:a.release,due_at:a.due,archived:false});result={saved:true}}
 if(action==='archive'){d.tasks.find(x=>x.id===a.task).archived=a.archived;result={saved:true}}
 if(action==='submit'){const t=d.tasks.find(x=>x.id===a.task);for(const id of t.lesson_ids){if((a.writing[id]||'').trim().length<20)throw Error('Each written response needs at least 20 characters.');if(d.attempts.filter(x=>x.lesson_id===id&&x.solved).length!==2)throw Error('Finish the practice checks first.')}let sub=d.submissions.find(x=>x.task_id===a.task&&x.student_id===p.id);if(sub&&sub.status!=='returned')throw Error('Already submitted.');if(!sub){sub={student_id:p.id,task_id:a.task};d.submissions.push(sub)}Object.assign(sub,{writing:a.writing,status:'submitted',submitted_at:now(),feedback:'',awarded:0});result={saved:true}}
 if(action==='review'){const sub=d.submissions.find(x=>x.task_id===a.task&&x.student_id===a.student),t=d.tasks.find(x=>x.id===a.task);if(sub.status==='reviewed')throw Error('Already reviewed.');Object.assign(sub,{status:a.status,feedback:a.feedback,reviewed_at:now(),awarded:a.status==='reviewed'?t.points:0});if(sub.awarded)award(s,'study-task:'+t.id,sub.awarded);result={saved:true}}
 save(s);return structuredClone(result);
}
