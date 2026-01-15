# Google Search Console Setup Guide

This guide will help you submit your sitemap to Google Search Console for better SEO visibility.

## Step 1: Access Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in with your Google account (preferably the same account used for Google Business Profile)

## Step 2: Add Your Property (Website)

1. Click **"Add Property"** (or use the dropdown if you have existing properties)
2. Choose **"URL prefix"** method (recommended)
3. Enter your website URL: `https://www.sanhoti.org`
4. Click **"Continue"**

## Step 3: Verify Ownership

You need to verify that you own the website. Choose one of these methods:

### Method 1: HTML File Upload (Recommended)
1. Download the HTML verification file from Google Search Console
2. Upload it to your server's public directory:
   ```bash
   # SSH into your AWS server
   ssh -i ~/Downloads/sanhoti-keypair.pem ubuntu@44.220.179.207
   
   # Navigate to the frontend public directory
   cd /var/www/sanhoti/frontend/public
   
   # Upload the HTML file (using scp from your local machine)
   # From your local terminal:
   scp -i ~/Downloads/sanhoti-keypair.pem /path/to/google-verification-file.html ubuntu@44.220.179.207:/var/www/sanhoti/frontend/public/
   ```
3. Ensure the file is accessible at: `https://www.sanhoti.org/google-verification-file.html`
4. Click **"Verify"** in Google Search Console

### Method 2: HTML Tag
1. Copy the HTML meta tag provided by Google
2. Add it to your `frontend/index.html` file in the `<head>` section
3. Deploy the changes
4. Click **"Verify"** in Google Search Console

### Method 3: DNS Record (If you have DNS access)
1. Add a TXT record to your domain's DNS settings
2. Wait for DNS propagation (can take up to 48 hours)
3. Click **"Verify"** in Google Search Console

## Step 4: Submit Your Sitemap

Once verified:

1. In Google Search Console, click **"Sitemaps"** in the left sidebar (under "Indexing")
2. In the "Add a new sitemap" field, enter: `https://www.sanhoti.org/api/sitemap.xml`
   - **Note**: If you want to serve it directly (without `/api`), configure your Nginx to serve it at `/sitemap.xml`
3. Click **"Submit"**

## Step 5: Verify Sitemap Processing

1. Google will start processing your sitemap (usually within a few minutes to hours)
2. Check the "Sitemaps" page to see:
   - **Status**: Should show "Success" once processed
   - **Discovered URLs**: Number of URLs found in your sitemap
   - **Last read date**: When Google last fetched your sitemap

## Step 6: Monitor Indexing

1. Go to **"Pages"** in the left sidebar (under "Indexing")
2. Monitor:
   - **Valid pages**: Pages successfully indexed
   - **Why pages aren't indexed**: Check for any issues

## Step 7: Additional Optimization

### Submit robots.txt
- Go to **"robots.txt Tester"** in Settings
- Your robots.txt should be accessible at: `https://www.sanhoti.org/robots.txt`
- Test it to ensure it's working correctly

### Monitor Performance
- Check **"Performance"** section to see:
  - Search queries that bring people to your site
  - Click-through rates
  - Average position in search results

### Request Indexing (Optional)
- For important new pages, you can request immediate indexing:
  1. Use the URL Inspection tool
  2. Enter the URL
  3. Click "Request Indexing"

## Important Notes

1. **Sitemap Location**: 
   - Dynamic sitemap is available at: `https://www.sanhoti.org/api/sitemap.xml`
   - The sitemap is regenerated on each request, so it's always up-to-date

2. **Update Frequency**: 
   - Google automatically recrawls your sitemap periodically
   - You can manually resubmit if you make major changes

3. **Sitemap Limits**:
   - Google can handle up to 50,000 URLs per sitemap
   - If you exceed this, you may need to split into multiple sitemaps

4. **Indexing Time**:
   - New pages may take days or weeks to appear in search results
   - Be patient and continue creating quality content

## Troubleshooting

### Sitemap Not Found
- Ensure your backend is running and accessible
- Check that the route is properly configured in `backend/src/routes/index.ts`
- Test the URL directly: `https://www.sanhoti.org/api/sitemap.xml`

### Sitemap Format Errors
- Verify the XML is well-formed
- Check for special characters that need escaping
- Ensure all URLs use HTTPS

### Pages Not Indexing
- Check for "noindex" meta tags
- Verify robots.txt isn't blocking pages
- Ensure pages have quality content
- Check for crawl errors in Search Console

## Next Steps

After submitting your sitemap:

1. **Monitor regularly** (weekly or monthly):
   - Check for crawl errors
   - Review search performance
   - Monitor indexing status

2. **Optimize content**:
   - Add location-based keywords naturally
   - Create unique, valuable content
   - Keep content fresh and updated

3. **Build quality backlinks**:
   - Get listed on local directories
   - Partner with other organizations
   - Share on social media

4. **Track results**:
   - Monitor your ranking for "Bengali Association near me"
   - Track organic traffic growth
   - Analyze which pages perform best

## Support

If you encounter issues:
- Check Google Search Console Help: https://support.google.com/webmasters
- Review your server logs for errors
- Ensure all routes are working correctly

