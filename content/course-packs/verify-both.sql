-- Read-only verification after import.
select id, title, order_index from public.courses where id = '066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid;
select count(*) as chapter_count from public.chapters where course_id = '066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid;
select c.order_index, c.title, count(q.id) as question_count
from public.chapters c left join public.questions q on q.chapter_id = c.id
where c.course_id = '066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid
group by c.id, c.order_index, c.title order by c.order_index;
select q.type, count(*) as question_count from public.questions q join public.chapters c on c.id = q.chapter_id where c.course_id = '066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid group by q.type order by q.type;
select count(*) as review_count from public.chapter_review_notes where course_id = '066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid;


-- Read-only verification after import.
select id, title, order_index from public.courses where id = 'bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid;
select count(*) as chapter_count from public.chapters where course_id = 'bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid;
select c.order_index, c.title, count(q.id) as question_count
from public.chapters c left join public.questions q on q.chapter_id = c.id
where c.course_id = 'bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid
group by c.id, c.order_index, c.title order by c.order_index;
select q.type, count(*) as question_count from public.questions q join public.chapters c on c.id = q.chapter_id where c.course_id = 'bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid group by q.type order by q.type;
select count(*) as review_count from public.chapter_review_notes where course_id = 'bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid;
