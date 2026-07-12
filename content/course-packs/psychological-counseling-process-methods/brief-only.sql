-- Use this small patch only when the browser import reports that course_brief insert is blocked by RLS.
begin;
insert into public.course_brief (course_id, exam_date, exam_structure, assignments, study_tips) values ('066e7a57-7d3e-5e45-988c-9bdf6c11ada1'::uuid, '2026-07-19'::date, '出勤 10%；课堂练习 10%；模拟练习完成情况及督导 40%；期末考试 40%。期末复习以概念理解、技术目的、使用时机、当事人反应和阶段整合为主。', '课堂练习包括刻意练习、模拟咨询和团体督导。模拟练习须遵守保密要求，练习者充当当事人时不能取代真实心理咨询或治疗；反馈应先积极后建设、基于可观察行为、具体明确，并聚焦助人者技能而非分析当事人问题。', '按“探索—领悟—行动”主线学习每项技术：先记考试定义，再理解技术意图、适用阶段、示例回应、常见误区和当事人可能反应。重点掌握能够向来访者解释的概念，如心理咨询、保密与保密例外、知情同意、评估目的、咨询关系、督导和结束咨询。')
on conflict (course_id) do update set exam_date = excluded.exam_date, exam_structure = excluded.exam_structure, assignments = excluded.assignments, study_tips = excluded.study_tips;
commit;
