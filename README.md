# רומי חביבי — portfolio

A standalone, Hebrew / RTL website designed for Netlify. Vanilla HTML, CSS and JavaScript; no build command or package installation. Includes looping video, equal-prominence discipline links, video projects, photography filters and lightbox, About, Contact, and an owner-only content dashboard.

## Second-cut interaction and design update

Project disciplines and photo categories now update the gallery in place, retaining scroll position, keyboard focus and browser Back support without restarting the page's decorative animation. The visual update adds animated Hebrew headline entrances, a moving typography strip, a subtle drifting gradient background, cobalt/orange color blocks, scroll reveals, subtle desktop card tilt and playful hover details. The floating **תנועה** control pauses decorative animation independently of the hero-video pause button. System reduced-motion preferences disable animation and hero autoplay. The small `motion.js` module handles progressive enhancement; core content remains usable without animation support.

## What is ready, and what still needs connecting

- The design and public pages work immediately using **fictional placeholder projects**, Unsplash sample images and a sample Sintel trailer.
- Photography entries can contain a cover image plus up to 100 additional images. Add gallery-image URLs one per line or select multiple files in the dashboard; if no cover is set, the first selected image becomes the cover. Visitors browse the set in the existing lightbox.
- The hero video is preloaded for immediate playback and Cloudinary-hosted videos receive automatic quality/format optimization. Project videos load when opened rather than downloading every video on every visit.
- Persistent editing, uploads and password login use **Supabase**. They require the one-time setup below. The Tasklet preview provides a clearly marked, temporary editing demo, not permanent storage.
- Contact submissions use **Netlify Forms**. Enable form detection and notification delivery in your Netlify dashboard. There is no outgoing email service built into the website.
- No account has been created and nothing has been published on your behalf.

## Full-project review update

Repeated source reviews and desktop/mobile interaction checks hardened the editor, navigation, media handling and deployment setup:

- Photo filters preserve scroll and focus; gallery dialogs are named, lock background scrolling and support keyboard navigation.
- Drafts are protected on navigation, including browser Back/Forward and alternate admin hashes. Saves/uploads block conflicting editor actions.
- Saves use a server-managed revision to prevent one browser tab silently overwriting another. A conflict keeps the unsaved form visible: copy its text, reload the site, and reapply the changes.
- Content is validated before rendering and saving; photography requires a valid image. Converting a video project to photography selects a valid category.
- Public reading is independent of expired admin sessions. Refresh requests are shared, connection timeouts show recoverable errors, and configuration failures are not silently presented as an intentional demo.
- Long text/name wrapping, contrast, reduced motion and modal focus were improved. YouTube Live and Vimeo privacy-hash links are supported.

These checks do not replace testing the deployed Netlify site and real Supabase permissions.

## 1. Put the project in a Git repository

Unzip the supplied archive and put the contents of `romi-portfolio/` at the repository root. Keep `index.html`, `netlify.toml` and `netlify/functions/` at that root. Do not deploy the ZIP itself. You may omit `tasklet.config.json`; it is only used for the Tasklet preview.

In Netlify, choose **Add new project → Import an existing project** and connect the repository. The included configuration sets:

- Build command: leave empty.
- Publish directory: `.`
- Functions directory: `netlify/functions`

Use repository-based deployment, rather than Netlify Drop: the small configuration function must also deploy.

## 2. Create private content storage

1. Create a Supabase project.
2. In **Authentication → Users**, create your admin user with an email and a strong password. Create it as a confirmed user; do not add a public signup form. Disable new-user signups in Authentication settings. No credentials go into source files.
3. Copy that user's UUID. In `setup/supabase.sql`, replace `REPLACE_WITH_ADMIN_USER_UUID` with it.
4. Run the SQL in the Supabase SQL editor. It creates one portfolio record and the public `portfolio-media` bucket. It only permits that record's owner to change content or upload files. An unrelated authenticated account cannot edit this portfolio.
   If Supabase was already configured, rerun the updated SQL after inserting the same admin UUID; this updates server-side validation for photography galleries without replacing saved content.
5. In Netlify's environment-variable settings, add:
   - `SUPABASE_URL`: your project URL, e.g. `https://your-project.supabase.co`.
   - `SUPABASE_ANON_KEY`: your **public anon / publishable** key. Never use the service-role key or a secret key. Public keys are intentionally sent to browsers; security is provided by database policies.
6. Deploy once after adding these values. Environment variables must be available to Functions.

The site starts with the included placeholders even when the database record is initially empty. Visit `https://your-site.netlify.app/#admin`, sign in, edit and click Save. All later content changes go directly into storage. **No subsequent deployment is needed to add or edit work.** Code, design and environment-variable changes still require a deployment.

### Existing Supabase installations

Back up your content before rerunning the updated SQL. It adds the `revision` column, server-managed revision/timestamp trigger, and content validation, without replacing an existing document or transferring ownership. Use the **existing owner's UUID**. The transaction aborts on incompatible columns, unexpected portfolio policies, a different owner, invalid stored content, or an existing private media bucket; review and migrate those explicitly rather than deleting live data to bypass an error.

On a reused Supabase project, inspect **all `storage.objects` policies** before making the site public. Broad policies inherited from another application can allow unwanted uploads, overwrites or deletions even when this site's policy is correct. The installer intentionally does not delete policies that other buckets may rely on. The stated owner-only/no-overwrite behavior assumes no other applicable storage mutation policy. Test it with both the owner and an unrelated user.

## 3. Edit your portfolio

The footer's **ניהול האתר** link opens the studio. Its URL is not a security boundary: server-side Supabase policies enforce ownership.

- Edit the name, introduction, About text, images and contact introduction. Open **עריכת שאר הטקסטים באתר** in the settings panel to update the homepage and page headings, links, navigation, form copy, accessibility labels, status messages and other built-in site text. Enter line breaks directly in multiline fields. Text wrapped in braces, such as `{count}` or `{title}`, is replaced with the relevant value and should be left in place when editing those templates.
- Add / edit / delete / reorder projects.
- Choose **בימוי**, **עריכה**, or **צילום**; photography projects have **קוספליי** or **אופנה** categories.
- Use an image HTTPS URL or upload JPG, PNG, WEBP, AVIF or GIF. Still images other than GIF are converted in the browser to WebP at 82% quality and resized to a maximum 2000 px on the longest side before upload. GIFs are kept unchanged to preserve animation. Supported video uploads are MP4 / WEBM. Maximum source file size: 50 MB. Storage limits and pricing depend on your Supabase plan.
- Click Save after uploading a file; uploading alone does not attach it to your content.
- For YouTube or Vimeo projects, paste the regular video link. For other platforms, use the actual HTTPS **embed URL**, not an iframe HTML snippet. Dailymotion embeds provided through Iframely need their iframe URL; the site leaves Iframely's player unsandboxed so its nested player can work. The platform must permit framing. DRM, private videos, platform restrictions and missing permissions cannot be overridden.
- For the hero, use a direct HTTPS `.mp4` / `.webm` link. Cloudinary videos with a standard versioned delivery URL automatically receive `q_auto/f_auto` optimizations; for other sources, upload a web-sized, compressed video (ideally 1080p or smaller). It plays muted, loops, and has a pause control. A poster remains visible when autoplay or loading is blocked. Reduced-motion preferences turn off autoplay.
- Photography opens an image viewer with next/previous controls and keyboard arrows; Escape closes it.
- Login sessions are stored for the current browser tab and refreshed while active. Sign out when using a shared device.

All uploaded files in the media bucket are public. Never upload confidential material. Deleting a project removes its listing, not the underlying file. Delete orphaned files in Supabase Storage to reclaim space.

## 4. Enable contact messages

The static HTML includes a `portfolio-contact` form for Netlify to detect. In your Netlify project, enable Forms / form detection, then trigger a fresh deploy so Netlify scans the form declaration. Confirm `portfolio-contact` appears in **Forms**, submit a real test message through the deployed site's contact page, and confirm it appears as a submission before configuring **form submission notifications** to your chosen email address. Enabling detection alone does not send a message, and the Tasklet preview explicitly does not send.

If Forms is not enabled, you should not consider the contact page operational. Netlify pricing, quotas and spam filtering apply. The form uses a honeypot and HTML validation; it does not claim to offer legal-compliance or advanced spam guarantees.

## 5. Before making the site public

- Replace **every placeholder** title, image and text with your real work. Uncheck "sample" for real projects. Replace the sample hero video. Its sample credit disappears automatically when you choose a different video.
- Use only media you own or have permission to publish. Sample video: Sintel / Blender Foundation, CC BY 3.0; https://www.sintel.org/. Sample photos: Unsplash URLs in `data.js`; they are not Romi's work, and the sample photography categories do not claim accurate depiction.
- Check Hebrew wording, mobile layout, all video embeds and your contact notifications.
- Test that logged-out visitors and a different Supabase user cannot save or upload. Verify the owner can.
- Set backups and appropriate storage limits in Supabase. You can export the `portfolio` row from the dashboard.
- Add your domain in Netlify and complete its DNS / HTTPS setup.
- Consider a privacy policy appropriate to your jurisdiction if collecting personal data through the contact form. No analytics are included.

## Local testing

### VS Code Live Server — visual preview

Open the extracted `romi-portfolio` folder in VS Code, right-click `index.html`, and select **Open with Live Server**. Use the URL provided on `localhost` or `127.0.0.1` (usually `http://127.0.0.1:5500`). If the Netlify function is absent, these local addresses automatically show a clearly labeled demo. You can browse all pages and try the editor using HTTPS media links. Edits are held in memory only and disappear on reload; file uploads and real contact submissions are unavailable. Open the site through Live Server, not by double-clicking an HTML file. If accessing Live Server through a LAN IP, switch to its loopback URL for this demo mode.

### Netlify Dev — function/configuration testing

Install Node.js, then run these commands from the project folder:

```sh
npx netlify-cli dev
```

Open the local URL printed by the command. This runs the Netlify configuration function as well as the static site. Without storage environment variables, it returns an explicit unconfigured status and the site shows labeled placeholders. To test real login and storage, configure the public Supabase values described above for local development (Netlify Dev can read them from a local `.env` file; never commit that file). Contact submissions are deliberately disabled on loopback hosts; test Netlify Forms on the deployed site.

A missing function on a **public** deployment still shows an actionable setup error: the local preview fallback never hides a broken public installation. The Tasklet preview also supplies a temporary demo mode. Neither demo mode provides permanent storage or real contact delivery.

Files: `index.html` (shell), `styles.css` (design), `app.js` (pages/viewer/contact), `admin.js` (studio), `store.js` (auth/database/uploads), `schema.js` (content validation), `ui.js` (confirmation dialogs), `motion.js` (decorative movement), `media.js` (URL validation/embed conversion), `data.js` (clearly marked samples), `netlify.toml` (hosting/security headers), `setup/supabase.sql` (storage, validation and access rules).
