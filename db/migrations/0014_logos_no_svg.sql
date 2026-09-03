-- 0014: take SVG off the logo bucket.
--
-- 0013 allowed it. SVG is a document format that can carry script, and the
-- bucket is public-read, so an SVG logo is a page we would be hosting on a
-- storage domain for whoever uploaded it. The application already refuses it
-- (lib/domain/images.ts decides the format from the bytes); this makes the
-- bucket agree, so the rule holds even if something else ever writes here.
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'logos';
