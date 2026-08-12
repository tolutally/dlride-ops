-- Add 'essential_weekly_use' to public.application_vehicle_use enum
alter type public.application_vehicle_use add value if not exists 'essential_weekly_use';
