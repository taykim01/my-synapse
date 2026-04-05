
-- Create storage bucket for capture file/image uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('capture-files', 'capture-files', true);

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload capture files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'capture-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to capture files
CREATE POLICY "Capture files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'capture-files');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own capture files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'capture-files' AND auth.uid()::text = (storage.foldername(name))[1]);
