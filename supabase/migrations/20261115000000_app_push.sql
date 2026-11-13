-- TopTrack iPhone app: its notifications go through Apple, so it saves its
-- Apple device token as "apns:<token>" next to the browsers' web push
-- addresses (see src/app/api/push/send/route.ts).
alter table public.push_subs drop constraint if exists push_subs_endpoint_check;
alter table public.push_subs add constraint push_subs_endpoint_check
  check (endpoint ~ '^https://' or endpoint ~ '^apns:[0-9a-f]{32,200}$');
