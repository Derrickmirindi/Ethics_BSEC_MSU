# BSEC / Community Research Standard

Interactive educational website for the BSEC (Baltimore Social-Environmental Collaborative)
Community Research Standard — a community-centered framework of 17 connected questions on
trust, partnership practice, empowerment, and accountability in community-engaged research.

**Live site:** https://derrickmirindi.github.io/Ethics_BSEC_MSU/
<img width="1454" height="652" alt="image" src="https://github.com/user-attachments/assets/6491e230-0458-4b11-84ac-4f8818621b64" />


Conceptualized by Derrick Mirindi & Tonya Sanders Thach
School of Architecture and Planning, Morgan State University

## Sections

| Section | Purpose |
| --- | --- |
| Overview | Framing, interactive 3D model of the framework, headline counts |
| Framework | The 17 questions grouped into five domains, filterable, with per-question detail |
| Assessment | Step-by-step reflection with progress tracking and local draft saving |
| Analysis | Domain means, distributions, item table, reading guidance, action prompts, exports |
| Dimensions | Survey dimensions (Q3–Q15), their framework sources, and their relation to the Belmont principles |

## Repository layout

```
index.html            page markup, metadata, and section content
bsec-logo.webp        BSEC logo (header)
favicon.png           site icon; apple-touch-icon.png for iOS home screens
bsec-updates.css      brand, link design, motion background and dimensions-table styles
bg-motion.js          3D motion background (WebGL, no dependencies; honors reduced motion)
index-*.css           built stylesheet
index-*.js            built JavaScript bundle (loads scene-*.js on demand)
inter-*.woff2   Inter web fonts
.nojekyll       serve files as-is on GitHub Pages (no Jekyll processing)
```

All asset references in `index.html` are relative (`./file`), so the site works from the
repository subpath on GitHub Pages as well as from any other directory.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Notes on responsible use

This is an educational prototype for adult reflection (18+). It stores responses only in the
visitor's own browser, requests no email addresses or phone numbers, and is not a validated
instrument. Real participant data should be collected through an institution-approved research
platform after ethics review. The framework adapts principles described in the Stanford Haas
Center's [Principles of Ethical and Effective Service (2019)](https://haas.stanford.edu/sites/g/files/sbiybj16071/files/media/file/principlesshort2019_0.pdf);
it is an adaptation, not a claim of Stanford or Morgan State endorsement.

