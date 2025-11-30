# kAInban Landing Page

This is the landing page for kAInban, hosted on GitHub Pages.

## Deployment

This landing page is automatically deployed to GitHub Pages from the `docs/` directory.

### Setup GitHub Pages:

1. Go to your GitHub repository settings
2. Navigate to **Pages** (under Code and automation)
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select `main` (or `users`) and `/docs` folder
5. Click **Save**

Your landing page will be available at: `https://qureshi-inc.github.io/kAInban/`

### Custom Domain (Optional):

To use a custom domain:
1. Add a `CNAME` file in the `docs/` directory with your domain name
2. Configure your DNS provider to point to GitHub Pages
3. Enable HTTPS in repository settings

## Local Development

To test the landing page locally, simply open `index.html` in your browser or use a local server:

```bash
cd docs
python3 -m http.server 8000
```

Then visit `http://localhost:8000`
