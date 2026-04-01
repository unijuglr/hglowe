# Resume Mirror: Heather Glowe

This is a static mirror of the Squarespace resume site for Heather Glowe.

## Project Structure

- `static/`: Contains the mirrored HTML, CSS, and JS assets.
- `mirror.py`: The Python script used to crawl and download the assets.
- `Dockerfile`: Configuration for building a containerized version of the site.

## Local Run

To run the site locally using Docker:

```bash
docker build -t resume-mirror .
docker run -p 8080:80 resume-mirror
```

Then visit `http://localhost:8080`.

## Cloud Run Deployment

To deploy this to Google Cloud Run:

1. **Build and push the image to Artifact Registry:**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/resume-mirror
   ```

2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy resume-mirror --image gcr.io/YOUR_PROJECT_ID/resume-mirror --platform managed --allow-unauthenticated
   ```

## Technical Notes

The site was mirrored using a custom Python script that downloads assets from Squarespace's CDNs and rewrites links in the HTML to point to local versions. Some dynamic Squarespace features (like complex forms or real-time analytics) may not work in this static mirror.
