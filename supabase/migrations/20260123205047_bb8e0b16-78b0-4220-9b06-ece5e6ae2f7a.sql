-- Add table_of_contents JSONB column to content table
ALTER TABLE content 
ADD COLUMN table_of_contents jsonb DEFAULT NULL;

COMMENT ON COLUMN content.table_of_contents IS 
  'Pre-extracted PDF table of contents for segmented content';