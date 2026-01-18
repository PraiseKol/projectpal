-- Add new columns to documents table for editor feature
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'ppt_source',
ADD COLUMN IF NOT EXISTS extracted_content text,
ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
ADD COLUMN IF NOT EXISTS edited_content text,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.documents.document_type IS 'Type of document: ppt_source (for PPT generator) or editor (for document editor)';
COMMENT ON COLUMN public.documents.extracted_content IS 'Extracted text content from the uploaded document';
COMMENT ON COLUMN public.documents.ai_analysis IS 'JSON object containing AI analysis results';
COMMENT ON COLUMN public.documents.edited_content IS 'User-edited content after applying suggestions';
COMMENT ON COLUMN public.documents.last_edited_at IS 'Timestamp of last edit to the document';