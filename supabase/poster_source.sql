-- Which campus poster a person joined from (gu1 to gu5 Georgetown, gw1 to gw5 GW). Safe to run more than once.
-- Only the first poster is kept. Server only (RLS on the table, no policies), like the rest of the waitlist.
alter table public.waitlist add column if not exists source text;
