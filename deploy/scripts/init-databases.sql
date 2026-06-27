-- Runs once on first postgres container start.
-- Primary DB `druzya` is created via POSTGRES_DB env.
CREATE DATABASE druzya_content;
CREATE DATABASE druzya_interview;
CREATE DATABASE druzya_ai;
CREATE DATABASE druzya_recommendation;
CREATE DATABASE druzya_billing;
CREATE DATABASE druzya_sandbox;
CREATE DATABASE druzya_rooms;
