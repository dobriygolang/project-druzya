-- Runs once on first postgres container start.
-- Primary DB `druzya` is created via POSTGRES_DB env.
-- Other DB names must match DB_SERVICES in deploy/scripts/services.conf.sh.
CREATE DATABASE druzya_content;
CREATE DATABASE druzya_interview;
CREATE DATABASE druzya_ai;
CREATE DATABASE druzya_recommendation;
CREATE DATABASE druzya_billing;
CREATE DATABASE druzya_sandbox;
CREATE DATABASE druzya_rooms;
