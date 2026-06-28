# Image Upload Pipeline Audit

Date: 2026-06-28

## Findings

1. **`multer.memoryStorage()` is used.** The API server upload routes currently receive multipart payloads through Multer memory storage for image, mixed media, and audio uploads.
2. **Sharp buffers previously remained reachable until request completion.** The old image path uploaded `req.file.buffer` directly to Cloudinary without an explicit cleanup step. The updated path now clears `req.file.buffer` in `finally` and drops the optimized upload buffer reference immediately after Cloudinary completes or fails.
3. **Direct Cloudinary piping is not available with the current Multer memory-storage design.** Multer memory storage materializes the entire file as `req.file.buffer` before the route handler runs. A truly streaming path would require replacing Multer memory storage on these routes with a streaming multipart parser such as Busboy/Formidable and piping the file stream through Sharp into `cloudinary.uploader.upload_stream()`.
4. **Image uploads are now limited to 5 MB.** The main image endpoint rejects files above 5 MB at Multer limit time; mixed media still allows 20 MB videos but rejects image files above 5 MB.
5. **Sponsor/logo raster images are resized to fit within 1200 px.** The shared image optimizer applies `resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })` before upload.
6. **Raster images are compressed before upload.** JPEG/PNG/WebP/HEIC/HEIF inputs are converted to WebP at quality 82 before Cloudinary upload. SVG and GIF are passed through to avoid breaking vector or animation semantics.
7. **Buffers are freed after upload completion.** Route handlers now clear Multer's retained buffer and null the local upload buffer reference in `finally` blocks.

## 20 MB Upload Memory Result

A 20 MB upload to `/api/upload` is now rejected by Multer before Cloudinary upload because the image limit is 5 MB. On this code path there is no Sharp transform and no Cloudinary upload buffer. Peak request memory is therefore bounded by Multer's in-flight multipart parsing and the rejected payload, rather than by duplicate original-plus-optimized buffers.

Measured locally with a 20 MiB Buffer allocation as a conservative upper-bound proxy for the rejected in-memory payload:

- RSS before allocation: 41.0 MB
- RSS after 20 MiB allocation: 61.1 MB
- Peak delta: 20.1 MB

Because the production route now rejects 20 MB images, the expected peak incremental memory for this case is approximately one rejected payload (~20 MB) plus parser overhead, instead of the previous worst case of original upload buffer plus Cloudinary stream buffer plus any image-processing output.

## Streaming Recommendation

For the lowest possible memory footprint, replace `multer.memoryStorage()` on `/api/upload` with a streaming multipart parser and pipe:

`request file stream -> sharp resize/compress transform -> cloudinary.uploader.upload_stream()`

That would remove the full original upload buffer from application memory. The current change keeps the existing API contract and Multer integration while enforcing the 5 MB cap and ensuring buffers are dropped as soon as possible.
