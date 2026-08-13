-- Remove the projects feature: drop orphaned FK columns and the table.
-- Dropping each project_id column also drops its FK constraint.

ALTER TABLE service_income DROP COLUMN IF EXISTS project_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS project_id;

DROP TABLE IF EXISTS projects;
