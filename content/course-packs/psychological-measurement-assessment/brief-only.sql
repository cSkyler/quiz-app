-- Use this small patch only when the browser import reports that course_brief insert is blocked by RLS.
begin;
insert into public.course_brief (course_id, exam_date, exam_structure, assignments, study_tips) values ('bff6d335-0102-5899-9dbc-f4b0c9eec8c5'::uuid, '2026-07-19'::date, '课堂考勤 5%；课堂参与 10%；平时作业 45%；期末考核 40%。期末复习以选择题为主，重点考查概念辨析、工具选择、结果解释和临床情境应用。', '作业1：完成一次结构化初始访谈，重点考查前期准备、知情同意、初评框架、时间节奏、风险筛查和信息整合。作业2：量表检索，围绕评估问题查找并比较工具的用途、适用人群、信效度、常模、施测计分和解释限制。', '先掌握“测量—测评—测验”“信度—效度”“筛查—评估—诊断”等核心区别，再用情境题练习选择工具和下一步处理。初始评估、危机评估、人格评估为最高优先级；任何风险题先考虑安全、保密例外、升级处置和记录。')
on conflict (course_id) do update set exam_date = excluded.exam_date, exam_structure = excluded.exam_structure, assignments = excluded.assignments, study_tips = excluded.study_tips;
commit;
