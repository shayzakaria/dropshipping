-- 0008: closing a campaign is not the same as pausing it.
--
-- Pausing is a switch — out of stock, budget spent this month, back tomorrow.
-- Closing is a door: the campaign is finished. Both living in one "paused"
-- bucket meant a dashboard where a campaign ended in March sat looking like
-- something you might switch on tonight, and no way to tell an influencer
-- whether their code was resting or retired.
--
-- One-way on purpose: the application will not reopen a closed campaign,
-- because the influencers holding its codes were told it had ended, and
-- reopening would quietly make those codes live again without telling anyone.

alter type public.campaign_status add value if not exists 'closed';
