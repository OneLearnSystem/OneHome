-- ONE HOME refresh. Run once in the existing MULTI-SCHOOL OneLearn project.
-- Additive and repeatable: does not replace ol_call, school roles or existing homework.
BEGIN;
DO $$ BEGIN IF to_regclass('public.ol_schools') IS NULL THEN RAISE EXCEPTION 'Install the OneLearn multi-school platform first. Do not run in the older single-school database.'; END IF; END $$;
CREATE TABLE IF NOT EXISTS public.oh2_settings(school_id uuid PRIMARY KEY REFERENCES public.ol_schools(id),data jsonb NOT NULL DEFAULT '{"ready":false,"years":[7,8,9,10,11],"board":"AQA","starReader":false,"college":true,"collegeOff":[]}');
CREATE TABLE IF NOT EXISTS public.oh2_classes(school_id uuid REFERENCES public.ol_schools(id),id text,name text NOT NULL,year integer NOT NULL CHECK(year BETWEEN 7 AND 11),source text NOT NULL,PRIMARY KEY(school_id,id));
CREATE TABLE IF NOT EXISTS public.oh2_students(school_id uuid REFERENCES public.ol_schools(id),id text,first text NOT NULL,last text NOT NULL,year integer NOT NULL CHECK(year BETWEEN 7 AND 11),class_ids text[] NOT NULL DEFAULT '{}',source_id text,code_hash text,active boolean NOT NULL DEFAULT true,last_seen timestamptz,reading_age text,age_source text,age_date date,PRIMARY KEY(school_id,id),UNIQUE(school_id,code_hash));
CREATE TABLE IF NOT EXISTS public.oh2_content(id text PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('book','math','test')),data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS public.oh2_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES public.ol_schools(id),class_id text NOT NULL,service text NOT NULL CHECK(service IN ('reader','maths')),title text NOT NULL,items text[] NOT NULL,points integer NOT NULL CHECK(points BETWEEN 5 AND 1000),release_at timestamptz NOT NULL,due_at timestamptz NOT NULL,created_by uuid,archived boolean NOT NULL DEFAULT false,CHECK(due_at>release_at));
CREATE TABLE IF NOT EXISTS public.oh2_progress(school_id uuid,id text,student_id text,data jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(school_id,id,student_id),FOREIGN KEY(school_id,student_id) REFERENCES public.oh2_students(school_id,id));
CREATE TABLE IF NOT EXISTS public.oh2_awards(school_id uuid,student_id text,item text,service text,points integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(school_id,student_id,item),FOREIGN KEY(school_id,student_id) REFERENCES public.oh2_students(school_id,id));
ALTER TABLE public.oh2_classes ADD COLUMN IF NOT EXISTS staff_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.oh2_students ADD COLUMN IF NOT EXISTS last_login timestamptz;
CREATE OR REPLACE FUNCTION public.oh2_can_class(p_school uuid,p_class text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.ol_role(p_school)='admin' OR (public.ol_role(p_school) IS NOT NULL AND EXISTS(SELECT 1 FROM public.oh2_classes WHERE school_id=p_school AND id=p_class AND (cardinality(staff_ids)=0 OR auth.uid()=ANY(staff_ids)))) $$;
REVOKE ALL ON FUNCTION public.oh2_can_class(uuid,text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['oh2_settings','oh2_classes','oh2_students','oh2_content','oh2_tasks','oh2_progress','oh2_awards'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.oh2_call(p_slug text,p_action text,p_data jsonb DEFAULT '{}',p_code text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; role_name text; ns text; prefs jsonb; pupil public.oh2_students; x jsonb; y jsonb; doc jsonb; result jsonb; payload jsonb; scores jsonb; q jsonb; d jsonb; source_data jsonb; is_student boolean; blocked boolean; cid text; pid text; token text; code_norm text; selected text; kind_name text; item text; step integer; total integer; earned integer; page integer; old_page integer; marks integer; choice integer; rec record; classids text[]; ids text[]; task public.oh2_tasks; nowtime timestamptz:=now();
BEGIN
SELECT id INTO sid FROM public.ol_schools WHERE slug=p_slug AND active;
IF sid IS NULL THEN RAISE EXCEPTION 'School unavailable.'; END IF;
IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>2000000 THEN RAISE EXCEPTION 'Invalid request.'; END IF;
IF to_regprocedure('public.ol_locked(uuid)') IS NOT NULL THEN EXECUTE 'SELECT public.ol_locked($1)' INTO blocked USING sid; IF blocked THEN RAISE EXCEPTION 'LOCKDOWN: OneHome is paused. Follow your school instructions.'; END IF; END IF;
ns:='school_'||replace(sid::text,'-',''); role_name:=public.ol_role(sid);
is_student:=p_action=ANY(ARRAY['student','open','page','answer','test_save']) OR (p_action='status' AND p_code<>'');
IF NOT is_student AND role_name IS NULL THEN RAISE EXCEPTION 'Verified school staff access required.'; END IF;
INSERT INTO public.oh2_settings(school_id) VALUES(sid) ON CONFLICT DO NOTHING;
SELECT data INTO prefs FROM public.oh2_settings WHERE school_id=sid;
IF is_student THEN
 IF prefs->>'ready' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Your school is finishing setup. Please ask staff.'; END IF;
 code_norm:=upper(regexp_replace(p_code,'[-[:space:]]','','g'));
 IF code_norm !~ '^[A-F0-9]{32}$' THEN RAISE EXCEPTION 'Student code not recognised.'; END IF;
 SELECT * INTO pupil FROM public.oh2_students WHERE school_id=sid AND code_hash=encode(sha256(convert_to(code_norm,'UTF8')),'hex') AND active FOR UPDATE;
 IF pupil.id IS NULL THEN
  BEGIN
   EXECUTE format('SELECT %I.oh_pupil($1)',ns) INTO x USING p_code;
   PERFORM public.ol_call(p_slug,'oe_student_portal',jsonb_build_object('p_code',p_code));
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Student code not recognised or portal access is restricted. Please ask staff.'; END;
  SELECT * INTO pupil FROM public.oh2_students WHERE school_id=sid AND source_id=x->>'id' AND active FOR UPDATE;
  IF pupil.id IS NOT NULL THEN
   pupil.year:=(x->>'year')::integer; pupil.first:=x->>'first'; pupil.last:=x->>'last';
   SELECT coalesce(array_agg('oe:'||v),'{}') INTO pupil.class_ids FROM jsonb_array_elements_text(coalesce(x->'classIds','[]')) v;
   UPDATE public.oh2_students SET year=pupil.year,first=pupil.first,last=pupil.last,class_ids=pupil.class_ids WHERE school_id=sid AND id=pupil.id;
  END IF;
 END IF;
 IF pupil.id IS NULL THEN RAISE EXCEPTION 'Student not connected to OneHome. Please ask your administrator to import the class.'; END IF;
 IF NOT prefs->'years' @> to_jsonb(ARRAY[pupil.year]) THEN RAISE EXCEPTION 'Your year group is not enabled.'; END IF;
 UPDATE public.oh2_students SET last_seen=nowtime,last_login=CASE WHEN p_action='student' AND p_data->>'login'='true' THEN nowtime ELSE last_login END WHERE school_id=sid AND id=pupil.id;
END IF;
IF p_action='status' THEN RETURN jsonb_build_object('available',true,'ready',prefs->'ready'); END IF;
IF p_action='settings' THEN
 IF role_name IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'School administrator access required.'; END IF;
 IF coalesce(p_data->>'board','') NOT IN ('AQA','Edexcel') OR jsonb_typeof(p_data->'years') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'years')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'years') v WHERE v NOT IN ('7','8','9','10','11')) OR jsonb_typeof(p_data->'ready') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_data->'college') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_data->'starReader') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Choose an exam board, year groups and all preferences.'; END IF;
 UPDATE public.oh2_settings SET data=prefs||jsonb_build_object('board',p_data->>'board','years',p_data->'years','ready',p_data->'ready','college',p_data->'college','starReader',p_data->'starReader') WHERE school_id=sid; RETURN '{"saved":true}';
ELSIF p_action='class_staff' THEN
 IF role_name IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'School administrator access required.'; END IF;
 IF jsonb_typeof(p_data->'staff') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'staff') v WHERE NOT EXISTS(SELECT 1 FROM public.ol_members WHERE school_id=sid AND user_id::text=v)) THEN RAISE EXCEPTION 'Choose members of this school.'; END IF;
 UPDATE public.oh2_classes SET staff_ids=ARRAY(SELECT v::uuid FROM jsonb_array_elements_text(p_data->'staff') v) WHERE school_id=sid AND id=p_data->>'class'; RETURN '{"saved":true}';
ELSIF p_action='college_class' THEN
 cid:=p_data->>'class'; IF NOT EXISTS(SELECT 1 FROM public.oh2_classes WHERE school_id=sid AND id=cid AND year=11) OR NOT public.oh2_can_class(sid,cid) THEN RAISE EXCEPTION 'Choose an authorised Year 11 class.'; END IF;
 SELECT coalesce(jsonb_agg(v),'[]') INTO x FROM jsonb_array_elements_text(coalesce(prefs->'collegeOff','[]')) v WHERE v<>cid;
 IF p_data->>'enabled'='false' THEN x:=x||to_jsonb(cid); END IF;
 UPDATE public.oh2_settings SET data=jsonb_set(data,'{collegeOff}',x) WHERE school_id=sid; RETURN '{"saved":true}';
ELSIF p_action='sync' THEN
 IF role_name IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'School administrator access required.'; END IF;
 x:=public.ol_call(p_slug,'oe_get_state','{}'); source_data:=x->'data'; total:=0;
 FOR y IN SELECT value FROM jsonb_array_elements(coalesce(source_data->'classes','[]')) LOOP
  IF (y->>'year')::integer BETWEEN 7 AND 11 THEN INSERT INTO public.oh2_classes(school_id,id,name,year,source) VALUES(sid,'oe:'||(y->>'id'),y->>'name',(y->>'year')::integer,'ONE EDUCATE') ON CONFLICT(school_id,id) DO UPDATE SET name=excluded.name,year=excluded.year; END IF;
 END LOOP;
 UPDATE public.oh2_students SET active=false WHERE school_id=sid AND source_id IS NOT NULL;
 FOR y IN SELECT value FROM jsonb_array_elements(coalesce(source_data->'students','[]')) LOOP
  IF (y->>'year')::integer BETWEEN 7 AND 11 AND coalesce(y->>'archived','false')<>'true' THEN
   SELECT coalesce(array_agg('oe:'||v),'{}') INTO classids FROM jsonb_array_elements_text(coalesce(y->'classIds','[]')) v;
   INSERT INTO public.oh2_students(school_id,id,first,last,year,class_ids,source_id) VALUES(sid,'oe:'||(y->>'id'),y->>'first',y->>'last',(y->>'year')::integer,classids,y->>'id') ON CONFLICT(school_id,id) DO UPDATE SET first=excluded.first,last=excluded.last,year=excluded.year,class_ids=excluded.class_ids,active=true;
   total:=total+1;
  END IF;
 END LOOP; RETURN jsonb_build_object('count',total);
ELSIF p_action='import' THEN
 IF role_name IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'School administrator access required.'; END IF;
 IF jsonb_typeof(p_data->'rows') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'rows') NOT BETWEEN 1 AND 500 OR p_data->>'source' NOT IN ('CSV','Arbor','Microsoft Teams') THEN RAISE EXCEPTION 'Import 1–500 rows with a supported source.'; END IF;
 result:='[]';
 FOR y IN SELECT value FROM jsonb_array_elements(p_data->'rows') LOOP
  IF coalesce(length(trim(y->>'first')),0) NOT BETWEEN 1 AND 80 OR coalesce(length(trim(y->>'last')),0) NOT BETWEEN 1 AND 80 OR coalesce(y->>'year','') NOT IN ('7','8','9','10','11') OR coalesce(length(trim(y->>'class')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(y->>'externalId')),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Each row needs first, last, year 7–11, class and a stable externalId.'; END IF;
  pid:=p_data->>'source'||':'||(y->>'externalId'); cid:=p_data->>'source'||':'||(y->>'year')||':'||(y->>'class'); token:=NULL;
  INSERT INTO public.oh2_classes(school_id,id,name,year,source) VALUES(sid,cid,y->>'class',(y->>'year')::integer,p_data->>'source') ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.oh2_students WHERE school_id=sid AND id=pid) THEN
   token:=upper(replace(gen_random_uuid()::text,'-',''));
   INSERT INTO public.oh2_students(school_id,id,first,last,year,class_ids,code_hash) VALUES(sid,pid,y->>'first',y->>'last',(y->>'year')::integer,ARRAY[cid],encode(sha256(convert_to(token,'UTF8')),'hex'));
  ELSE
   UPDATE public.oh2_students SET first=y->>'first',last=y->>'last',year=(y->>'year')::integer,active=true,class_ids=CASE WHEN cid=ANY(class_ids) THEN class_ids ELSE array_append(class_ids,cid) END WHERE school_id=sid AND id=pid;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('name',(y->>'first')||' '||(y->>'last'),'id',pid,'code',token));
 END LOOP; RETURN result;
ELSIF p_action='rotate' THEN
 IF role_name IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'School administrator access required.'; END IF;
 token:=upper(replace(gen_random_uuid()::text,'-',''));
 UPDATE public.oh2_students SET code_hash=encode(sha256(convert_to(token,'UTF8')),'hex') WHERE school_id=sid AND id=p_data->>'student' AND source_id IS NULL AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Use ONE EDUCATE to change an imported ONE EDUCATE code.'; END IF; RETURN jsonb_build_object('code',token);
ELSIF p_action='reading_age' THEN
 IF NOT EXISTS(SELECT 1 FROM public.oh2_students st WHERE school_id=sid AND id=p_data->>'student' AND (role_name='admin' OR EXISTS(SELECT 1 FROM unnest(st.class_ids) AS v(class_key) WHERE public.oh2_can_class(sid,v.class_key)))) THEN RAISE EXCEPTION 'Student outside your authorised classes.'; END IF;
 IF coalesce(length(p_data->>'age'),0)>50 OR coalesce(length(p_data->>'source'),0) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Enter a reading age and assessment source.'; END IF;
 UPDATE public.oh2_students SET reading_age=p_data->>'age',age_source=p_data->>'source',age_date=current_date WHERE school_id=sid AND id=p_data->>'student' AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found.'; END IF; RETURN '{"saved":true}';
ELSIF p_action='task' THEN
 IF prefs->>'ready' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Ask an administrator to finish setup first.'; END IF;
 IF coalesce(p_data->>'service','') NOT IN ('reader','maths') OR coalesce(length(trim(p_data->>'title')),0) NOT BETWEEN 1 AND 150 OR NOT EXISTS(SELECT 1 FROM public.oh2_classes WHERE school_id=sid AND id=p_data->>'class') OR NOT public.oh2_can_class(sid,p_data->>'class') THEN RAISE EXCEPTION 'Choose an authorised class, service and title.'; END IF;
 SELECT array_agg(v) INTO ids FROM jsonb_array_elements_text(p_data->'items') v;
 IF cardinality(ids) NOT BETWEEN 1 AND 20 OR ids IS NULL THEN RAISE EXCEPTION 'Choose 1–20 books or topics.'; END IF;
 FOR item IN SELECT unnest(ids) LOOP
  SELECT kind,data INTO kind_name,doc FROM public.oh2_content WHERE id=item;
  IF kind_name IS NULL OR kind_name<>(CASE WHEN p_data->>'service'='reader' THEN 'book' ELSE 'math' END) THEN RAISE EXCEPTION 'Invalid content choice.'; END IF;
  IF kind_name='book' AND doc->>'college'='true' AND (prefs->>'college' IS DISTINCT FROM 'true' OR prefs->'collegeOff' ? (p_data->>'class') OR NOT EXISTS(SELECT 1 FROM public.oh2_classes WHERE school_id=sid AND id=p_data->>'class' AND year=11)) THEN RAISE EXCEPTION 'College titles are available only to enabled Year 11 classes.'; END IF;
 END LOOP;
 IF (p_data->>'points')::integer>cardinality(ids)*(CASE WHEN p_data->>'service'='maths' THEN 40 WHEN prefs->>'starReader'='true' THEN 20 ELSE 10 END) OR (SELECT count(DISTINCT v) FROM unnest(ids) v)<>cardinality(ids) THEN RAISE EXCEPTION 'Choose unique items and an achievable points target.'; END IF;
 INSERT INTO public.oh2_tasks(school_id,class_id,service,title,items,points,release_at,due_at,created_by) VALUES(sid,p_data->>'class',p_data->>'service',trim(p_data->>'title'),ids,(p_data->>'points')::integer,(p_data->>'release')::timestamptz,(p_data->>'due')::timestamptz,auth.uid()) RETURNING id INTO selected;
 RETURN jsonb_build_object('id',selected);
ELSIF p_action='archive' THEN
 UPDATE public.oh2_tasks SET archived=true WHERE school_id=sid AND id=(p_data->>'id')::uuid AND public.oh2_can_class(sid,class_id); IF NOT FOUND THEN RAISE EXCEPTION 'Homework outside your authorised classes.'; END IF; RETURN '{"saved":true}';
ELSIF p_action='preview' THEN
 SELECT data INTO doc FROM public.oh2_content WHERE id=p_data->>'id'; IF doc IS NULL THEN RAISE EXCEPTION 'Content not found.'; END IF; RETURN jsonb_build_object('content',doc);
END IF;
IF p_action IN ('staff','student') THEN
 IF NOT is_student AND role_name<>'admin' AND prefs->>'ready' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Your administrator must complete OneHome setup first.'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',data->>'title','year',data->'year','age',data->>'age','genre',data->>'genre','college',data->'college','count',jsonb_array_length(coalesce(data->'questions','[]')) ) ORDER BY id),'[]') INTO result FROM public.oh2_content WHERE kind<>'test' AND (NOT is_student OR kind<>'book' OR coalesce(data->>'college','false')<>'true' OR (pupil.year=11 AND prefs->>'college'='true' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(prefs->'collegeOff','[]')) v WHERE v=ANY(pupil.class_ids))));
 RETURN jsonb_build_object('role',CASE WHEN is_student THEN 'student' ELSE role_name END,'school',(SELECT name FROM public.ol_schools WHERE id=sid),'settings',prefs,'catalog',result,'student',CASE WHEN is_student THEN to_jsonb(pupil)-'code_hash'-'source_id'-'school_id' ELSE NULL END,
 'members',CASE WHEN NOT is_student AND role_name='admin' THEN public.ol_staff(sid) ELSE '[]'::jsonb END,
 'students',CASE WHEN is_student THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(to_jsonb(st)-'code_hash'-'school_id') FROM public.oh2_students st WHERE school_id=sid AND active AND (role_name='admin' OR EXISTS(SELECT 1 FROM unnest(st.class_ids) AS v(class_key) WHERE public.oh2_can_class(sid,v.class_key)))),'[]') END,
 'classes',coalesce((SELECT jsonb_agg(to_jsonb(c)-'school_id') FROM public.oh2_classes c WHERE school_id=sid AND ((NOT is_student AND public.oh2_can_class(sid,id)) OR (is_student AND id=ANY(pupil.class_ids)))),'[]'),
 'tasks',coalesce((SELECT jsonb_agg(to_jsonb(t)-'school_id' ORDER BY release_at DESC) FROM public.oh2_tasks t WHERE school_id=sid AND NOT archived AND ((NOT is_student AND public.oh2_can_class(sid,class_id)) OR (is_student AND class_id=ANY(pupil.class_ids) AND release_at<=nowtime))),'[]'),
 'progress',coalesce((SELECT jsonb_agg(to_jsonb(pr)-'school_id') FROM public.oh2_progress pr WHERE school_id=sid AND ((is_student AND student_id=pupil.id) OR (NOT is_student AND (role_name='admin' OR EXISTS(SELECT 1 FROM public.oh2_students st,unnest(st.class_ids) AS v(class_key) WHERE st.school_id=sid AND st.id=pr.student_id AND public.oh2_can_class(sid,v.class_key)))))),'[]'),
 'awards',coalesce((SELECT jsonb_agg(to_jsonb(a)-'school_id') FROM public.oh2_awards a WHERE school_id=sid AND ((is_student AND student_id=pupil.id) OR (NOT is_student AND (role_name='admin' OR EXISTS(SELECT 1 FROM public.oh2_students st,unnest(st.class_ids) AS v(class_key) WHERE st.school_id=sid AND st.id=a.student_id AND public.oh2_can_class(sid,v.class_key)))))),'[]'));
END IF;
IF NOT is_student THEN RAISE EXCEPTION 'Unknown staff action.'; END IF;
selected:=p_data->>'id';
SELECT kind,data INTO kind_name,doc FROM public.oh2_content WHERE id=selected;
IF doc IS NULL THEN RAISE EXCEPTION 'Content not found.'; END IF;
IF kind_name='book' AND doc->>'college'='true' AND (pupil.year<>11 OR prefs->>'college' IS DISTINCT FROM 'true' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(prefs->'collegeOff','[]')) v WHERE v=ANY(pupil.class_ids))) THEN RAISE EXCEPTION 'College reading is disabled for your class or school.'; END IF;
IF kind_name='book' AND NOT EXISTS(SELECT 1 FROM public.oh2_progress WHERE school_id=sid AND student_id=pupil.id AND id='reading-check' AND data->>'complete'='true') THEN RAISE EXCEPTION 'Complete your reading check first.'; END IF;
IF kind_name='math' THEN
 IF p_data->>'task' IS NOT NULL THEN
  SELECT * INTO task FROM public.oh2_tasks WHERE school_id=sid AND id=(p_data->>'task')::uuid AND NOT archived AND release_at<=nowtime AND class_id=ANY(pupil.class_ids) AND selected=ANY(items) AND service='maths';
  IF task.id IS NULL THEN RAISE EXCEPTION 'This homework is not available.'; END IF;
 ELSIF pupil.year<10 THEN RAISE EXCEPTION 'Independent revision is for Years 10–11. Open a homework set instead.'; END IF;
END IF;
item:=CASE WHEN kind_name='math' THEN selected||':'||coalesce(p_data->>'task','revision') ELSE selected END;
INSERT INTO public.oh2_progress(school_id,id,student_id) VALUES(sid,item,pupil.id) ON CONFLICT DO NOTHING;
SELECT data INTO d FROM public.oh2_progress WHERE school_id=sid AND id=item AND student_id=pupil.id FOR UPDATE;
IF p_action='open' THEN
 SELECT coalesce(jsonb_agg(value-'correct'-'explanation'),'[]') INTO x FROM jsonb_array_elements(doc->'questions');
 IF kind_name='book' THEN doc:=doc-'pages'; END IF;
 RETURN jsonb_build_object('content',jsonb_set(doc,'{questions}',x),'progress',d,'id',selected);
ELSIF p_action='page' THEN
 IF kind_name<>'book' THEN RAISE EXCEPTION 'Choose a book.'; END IF;
 page:=(p_data->>'page')::integer; old_page:=coalesce((d->>'page')::integer,0);
 IF page NOT BETWEEN 0 AND jsonb_array_length(doc->'pages')-1 OR page>old_page+1 THEN RAISE EXCEPTION 'Read the pages in order.'; END IF;
 d:=d||jsonb_build_object('page',greatest(old_page,page));
 UPDATE public.oh2_progress SET data=d,updated_at=nowtime WHERE school_id=sid AND id=item AND student_id=pupil.id;
 RETURN jsonb_build_object('text',doc->'pages'->page,'page',page,'pages',jsonb_array_length(doc->'pages'));
ELSIF p_action='test_save' THEN
 IF kind_name<>'test' THEN RAISE EXCEPTION 'Choose the reading check.'; END IF;
 IF d->>'complete'='true' THEN RETURN d; END IF;
 IF jsonb_typeof(p_data->'answers') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Choose answers.'; END IF;
 x:=coalesce(d->'answers','{}')||(p_data->'answers'); total:=0;
 FOR rec IN SELECT value,ordinality FROM jsonb_array_elements(doc->'questions') WITH ORDINALITY LOOP
  IF x ? (rec.ordinality-1)::text AND (x->>(rec.ordinality-1)::text) !~ '^[0-3]$' THEN RAISE EXCEPTION 'Invalid answer.'; END IF;
  IF (x->>(rec.ordinality-1)::text)::integer=(rec.value->>'correct')::integer THEN total:=total+1; END IF;
 END LOOP;
 d:=jsonb_build_object('answers',x,'complete',false);
 IF p_data->>'submit'='true' THEN
  IF EXISTS(SELECT 1 FROM generate_series(0,49) i WHERE NOT x ? i::text) THEN RAISE EXCEPTION 'Answer all 50 questions first.'; END IF;
  d:=d||jsonb_build_object('complete',true,'score',total,'level',CASE WHEN total<20 THEN 'Supported' WHEN total<35 THEN 'Developing' ELSE 'Confident' END,'checkedAt',nowtime,'notice','Classroom reading check, not a standardised reading-age assessment.');
 END IF;
 UPDATE public.oh2_progress SET data=d,updated_at=nowtime WHERE school_id=sid AND id=item AND student_id=pupil.id; RETURN d;
ELSIF p_action='answer' THEN
 IF kind_name NOT IN ('book','math') THEN RAISE EXCEPTION 'Use the reading check form.'; END IF;
 IF kind_name='book' AND coalesce((d->>'page')::integer,0)<jsonb_array_length(doc->'pages')-1 THEN RAISE EXCEPTION 'Finish the pages before the questions.'; END IF;
 step:=(p_data->>'question')::integer; choice:=(p_data->>'answer')::integer; total:=jsonb_array_length(doc->'questions');
 IF step IS NULL OR step<0 OR step>=total OR choice IS NULL OR choice NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Invalid question or answer.'; END IF;
 q:=doc->'questions'->step; x:=coalesce(d->'answers','{}'); scores:=coalesce(d->'correct','{}');
 IF NOT x ? step::text THEN x:=x||jsonb_build_object(step::text,choice); scores:=scores||jsonb_build_object(step::text,choice=(q->>'correct')::integer); END IF;
 d:=d||jsonb_build_object('answers',x,'correct',scores);
 IF NOT EXISTS(SELECT 1 FROM generate_series(0,total-1) i WHERE NOT x ? i::text) THEN
  SELECT count(*) INTO marks FROM jsonb_each_text(scores) WHERE value='true';
  d:=d||jsonb_build_object('complete',true,'score',marks,'total',total);
  earned:=CASE WHEN kind_name='book' THEN CASE WHEN prefs->>'starReader'='true' THEN 20 ELSE 10 END ELSE marks*5 END;
  IF kind_name='book' AND marks<2 THEN earned:=0; END IF;
  INSERT INTO public.oh2_awards VALUES(sid,pupil.id,item,CASE WHEN kind_name='book' THEN 'reader' ELSE 'maths' END,earned,nowtime) ON CONFLICT DO NOTHING;
 END IF;
 UPDATE public.oh2_progress SET data=d,updated_at=nowtime WHERE school_id=sid AND id=item AND student_id=pupil.id;
 RETURN jsonb_build_object('progress',d,'correct',scores->step::text,'answer',q->'choices'->((q->>'correct')::integer),'explanation',q->>'explanation');
END IF;
RAISE EXCEPTION 'Unknown action.';
END $$;
REVOKE ALL ON FUNCTION public.oh2_call(text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oh2_call(text,text,jsonb,text) TO anon,authenticated;
COMMIT;


