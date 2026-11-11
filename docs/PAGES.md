# GitHub Pages setup (v1.2.2)

The live demo is the static Command Center. Data is embedded in `command-center/js/embedded-data.js`, so no server-side build is required.

## Recommended setting

In the GitHub repository:

**Settings → Pages → Build and deployment**

- Source: **Deploy from a branch**
- Branch: **`main`**
- Folder: **`/ (root)`**

A `.nojekyll` file is included so GitHub does not process the site with Jekyll. The repository root `index.html` redirects to `command-center/`.

Expected URL after publishing:

`https://gracianb.github.io/customer-health-intelligence/`

(also `.../command-center/`)

No GitHub Actions workflow is required for this setup.
