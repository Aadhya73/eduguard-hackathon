-- ================================================================
-- EduGuard - Supabase Setup & Row Level Security (RLS) Policies
-- Run this script in the Supabase SQL Editor for your project.
-- ================================================================

-- 1. Enable RLS on students and grant read/write access for anon/demo
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read students" ON students;
CREATE POLICY "Allow public read students" ON students
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert students" ON students;
CREATE POLICY "Allow anon insert students" ON students
FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update students" ON students;
CREATE POLICY "Allow anon update students" ON students
FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon delete students" ON students;
CREATE POLICY "Allow anon delete students" ON students
FOR DELETE TO anon USING (true);

-- 2. Attendance Policies
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read attendance" ON attendance;
CREATE POLICY "Allow public read attendance" ON attendance
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert attendance" ON attendance;
CREATE POLICY "Allow anon insert attendance" ON attendance
FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update attendance" ON attendance;
CREATE POLICY "Allow anon update attendance" ON attendance
FOR UPDATE TO anon USING (true);

-- 3. Academic Performance Policies
ALTER TABLE academic_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read academic_performance" ON academic_performance;
CREATE POLICY "Allow public read academic_performance" ON academic_performance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert academic_performance" ON academic_performance;
CREATE POLICY "Allow anon insert academic_performance" ON academic_performance FOR INSERT TO anon WITH CHECK (true);

-- 4. Assignments Policies
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read assignments" ON assignments;
CREATE POLICY "Allow public read assignments" ON assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert assignments" ON assignments;
CREATE POLICY "Allow anon insert assignments" ON assignments FOR INSERT TO anon WITH CHECK (true);

-- 5. Submissions Policies
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read submissions" ON submissions;
CREATE POLICY "Allow public read submissions" ON submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert submissions" ON submissions;
CREATE POLICY "Allow anon insert submissions" ON submissions FOR INSERT TO anon WITH CHECK (true);

-- 6. Engagement Policies
ALTER TABLE engagement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read engagement" ON engagement;
CREATE POLICY "Allow public read engagement" ON engagement FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert engagement" ON engagement;
CREATE POLICY "Allow anon insert engagement" ON engagement FOR INSERT TO anon WITH CHECK (true);

-- 7. Risk Scores Policies
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read risk_scores" ON risk_scores;
CREATE POLICY "Allow public read risk_scores" ON risk_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert risk_scores" ON risk_scores;
CREATE POLICY "Allow anon insert risk_scores" ON risk_scores FOR INSERT TO anon WITH CHECK (true);
