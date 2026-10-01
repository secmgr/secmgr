import "./home.css";
import { HomeScript } from "./HomeScript.jsx";

const BOOT = [
  "(function(){",
  "var d=document.documentElement,rm=false,seen=false;",
  'try{rm=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}',
  'try{seen=window.sessionStorage.getItem("secmgr-home-seen")==="1"}catch(e){}',
  'd.classList.add("js");',
  'd.classList.add(rm?"reduce":"motion");',
  'if(rm||seen){d.classList.add("no-loader")}else{d.classList.add("is-loading")}',
  'window.setTimeout(function(){d.classList.remove("is-loading");d.classList.add("loader-gone")},2500);',
  "})();",
].join("");

export function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <svg className="sprite" aria-hidden="true" focusable="false" width="0" height="0">
        <defs>
          <clipPath id="sm-ct">
            <circle cx="16" cy="8.422" r="5.2" />
          </clipPath>
          <clipPath id="sm-cb">
            <circle cx="16" cy="23.578" r="5.2" />
          </clipPath>
          <mask id="sm-ma" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
            <rect width="32" height="32" fill="white" />
            <circle cx="20.375" cy="16" r="8.75" fill="none" stroke="black" strokeWidth="4.2" clipPath="url(#sm-ct)" />
          </mask>
          <mask id="sm-mb" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
            <rect width="32" height="32" fill="white" />
            <circle cx="11.625" cy="16" r="8.75" fill="none" stroke="black" strokeWidth="4.2" clipPath="url(#sm-cb)" />
          </mask>
          <symbol id="sm-mark" viewBox="0 0 32 32">
            <circle cx="11.625" cy="16" r="8.75" fill="none" stroke="currentColor" strokeWidth="2" mask="url(#sm-ma)" />
            <circle cx="20.375" cy="16" r="8.75" fill="none" stroke="currentColor" strokeWidth="2" mask="url(#sm-mb)" />
          </symbol>
          <symbol id="sm-type" viewBox="42 0 85 32">
            <path
              fill="currentColor"
              d="M49 22.95Q46.10 22.95 44.65 21.69Q43.20 20.42 43.05 18.45L45.77 18.32Q45.95 19.42 46.67 20.07Q47.40 20.72 49 20.72Q50.25 20.72 50.91 20.32Q51.58 19.92 51.58 19.05Q51.58 18.55 51.35 18.22Q51.13 17.90 50.48 17.66Q49.83 17.42 48.55 17.20Q46.60 16.82 45.51 16.31Q44.42 15.80 43.98 15.04Q43.52 14.27 43.52 13.17Q43.52 11.37 44.90 10.21Q46.27 9.05 48.88 9.05Q50.70 9.05 51.88 9.66Q53.05 10.27 53.65 11.27Q54.25 12.27 54.38 13.42L51.65 13.57Q51.58 12.62 50.94 11.95Q50.30 11.27 48.83 11.27Q47.52 11.27 46.90 11.77Q46.27 12.27 46.27 13.07Q46.27 13.95 46.86 14.39Q47.45 14.82 49.08 15.07Q51.10 15.40 52.24 15.91Q53.38 16.42 53.85 17.19Q54.33 17.95 54.33 19.02Q54.33 20.90 52.85 21.92Q51.38 22.95 49 22.95M61.65 22.95Q59.70 22.95 58.29 22.09Q56.88 21.22 56.11 19.66Q55.35 18.10 55.35 16Q55.35 13.90 56.11 12.34Q56.88 10.77 58.27 9.91Q59.67 9.05 61.57 9.05Q63.38 9.05 64.75 9.89Q66.13 10.72 66.89 12.30Q67.65 13.87 67.65 16.10L67.65 16.77L58.10 16.77Q58.20 18.72 59.14 19.70Q60.07 20.67 61.67 20.67Q62.85 20.67 63.61 20.14Q64.38 19.60 64.70 18.65L67.45 18.82Q66.92 20.70 65.39 21.82Q63.85 22.95 61.65 22.95M58.10 14.77L64.85 14.77Q64.72 13 63.82 12.15Q62.92 11.30 61.57 11.30Q60.15 11.30 59.24 12.19Q58.32 13.07 58.10 14.77M74.92 22.95Q73.02 22.95 71.60 22.09Q70.17 21.22 69.40 19.66Q68.62 18.10 68.62 16Q68.62 13.90 69.40 12.34Q70.17 10.77 71.60 9.91Q73.02 9.05 74.92 9.05Q77.35 9.05 78.95 10.31Q80.55 11.57 80.87 13.87L78.10 14.02Q77.90 12.72 77.05 12.04Q76.20 11.35 74.92 11.35Q73.25 11.35 72.31 12.59Q71.37 13.82 71.37 16Q71.37 18.20 72.31 19.42Q73.25 20.65 74.92 20.65Q76.20 20.65 77.05 19.94Q77.90 19.22 78.10 17.77L80.87 17.92Q80.55 20.22 78.96 21.59Q77.37 22.95 74.92 22.95M85.05 22.65L82.40 22.65L82.40 9.35L84.82 9.35L84.87 11.62Q85.37 10.42 86.35 9.74Q87.32 9.05 88.57 9.05Q90.05 9.05 91.06 9.77Q92.07 10.50 92.50 11.80Q92.95 10.47 93.94 9.76Q94.92 9.05 96.35 9.05Q98.45 9.05 99.60 10.36Q100.75 11.67 100.75 14.10L100.75 22.65L98.10 22.65L98.10 14.75Q98.10 11.27 95.57 11.27Q94.32 11.27 93.57 12.22Q92.82 13.17 92.82 14.85L92.82 22.65L90.30 22.65L90.30 14.85Q90.30 13.17 89.74 12.22Q89.17 11.27 87.82 11.27Q86.55 11.27 85.80 12.22Q85.05 13.17 85.05 14.85M108.70 26.70Q106.32 26.70 104.82 25.65Q103.32 24.60 102.90 22.88L105.65 22.70Q105.92 23.55 106.61 24.02Q107.30 24.50 108.70 24.50Q110.35 24.50 111.24 23.80Q112.13 23.10 112.13 21.67L112.13 19.75Q111.63 20.77 110.57 21.38Q109.52 21.97 108.25 21.97Q106.57 21.97 105.27 21.16Q103.97 20.35 103.25 18.89Q102.52 17.42 102.52 15.52Q102.52 13.62 103.24 12.16Q103.95 10.70 105.22 9.87Q106.50 9.05 108.15 9.05Q109.57 9.05 110.66 9.70Q111.75 10.35 112.22 11.45L112.22 9.35L114.77 9.35L114.77 21.60Q114.77 24.05 113.14 25.38Q111.50 26.70 108.70 26.70M108.67 19.72Q110.22 19.72 111.16 18.60Q112.10 17.47 112.13 15.50Q112.15 13.55 111.20 12.42Q110.25 11.30 108.67 11.30Q107.05 11.30 106.16 12.44Q105.27 13.57 105.27 15.50Q105.27 17.45 106.19 18.59Q107.10 19.72 108.67 19.72M120.30 22.65L117.65 22.65L117.65 9.35L120.07 9.35L120.15 11.87Q120.52 10.57 121.31 9.96Q122.10 9.35 123.32 9.35L124.60 9.35L124.60 11.72L123.32 11.72Q121.80 11.72 121.05 12.47Q120.30 13.22 120.30 14.80"
            />
          </symbol>
          <symbol id="sm-word" viewBox="0 0 127 32">
            <use href="#sm-mark" x="0" y="0" width="32" height="32" />
            <use href="#sm-type" x="42" y="0" width="85" height="32" />
          </symbol>
        </defs>
      </svg>

      <div className="loader" id="loader" aria-hidden="true" data-theme="dark">
        <div className="loader__brand">
          <svg className="loader__mark" viewBox="0 0 32 32" aria-hidden="true">
            <use href="#sm-mark" />
          </svg>
          <svg className="loader__type" viewBox="0 0 85 32" aria-hidden="true">
            <use href="#sm-type" />
          </svg>
        </div>
        <p className="loader__count">
          <span id="loader-pct">0</span>%
        </p>
      </div>

      <a className="skip" href="#main" data-theme="dark">
        Skip to content
      </a>

      <header className="nav" id="nav" data-theme="dark">
        <div className="nav__bar">
          <a className="nav__brand" href="#top">
            <svg viewBox="0 0 127 32" aria-hidden="true">
              <use href="#sm-word" />
            </svg>
            <span className="sr-only">secmgr, back to top</span>
          </a>
          <nav className="nav__links" aria-label="Primary">
            <ul>
              <li>
                <a href="#product">Product</a>
              </li>
              <li>
                <a href="https://github.com/secmgr/secmgr#readme">Docs</a>
              </li>
              <li>
                <a href="https://github.com/secmgr/secmgr/releases">Changelog</a>
              </li>
              <li>
                <a href="https://github.com/secmgr/secmgr">GitHub</a>
              </li>
            </ul>
          </nav>
          <div className="nav__actions">
            <a className="pill pill--quiet nav__signin" href="/sign-in">
              Sign in
            </a>
            <a className="pill pill--glow nav__cta" href="/sign-in">
              Get started
            </a>
            <button
              className="nav__menu"
              type="button"
              aria-expanded="false"
              aria-controls="nav-sheet"
              aria-label="Open menu"
            >
              <span className="ic" data-icon="menu"></span>
              <span className="ic" data-icon="x"></span>
            </button>
          </div>
        </div>
        <div className="nav__sheet" id="nav-sheet" hidden>
          <ul>
            <li>
              <a href="#product">Product</a>
            </li>
            <li>
              <a href="https://github.com/secmgr/secmgr#readme">Docs</a>
            </li>
            <li>
              <a href="https://github.com/secmgr/secmgr/releases">Changelog</a>
            </li>
            <li>
              <a href="https://github.com/secmgr/secmgr">GitHub</a>
            </li>
            <li>
              <a href="/sign-in">Sign in</a>
            </li>
          </ul>
        </div>
      </header>

      <main id="main" tabIndex="-1">
        <div className="stage">
          <section className="hero" id="top" data-theme="dark" aria-labelledby="hero-title">
            <canvas className="hero__canvas" id="hero-canvas" aria-hidden="true"></canvas>
            <div className="hero__chips" id="hero-chips" aria-hidden="true"></div>
            <div className="hero__inner" id="hero-inner">
              <h1 className="hero__title" id="hero-title" data-intro="1">
                The open source
                <br /> <span className="hero__title-light">secret manager for&nbsp;teams.</span>
              </h1>
              <p className="hero__lede" data-intro="2">
                Projects, environments and every value in them. Encrypted, compared, and one command away.
              </p>
              <div className="hero__actions" data-intro="3">
                <a className="pill pill--glow pill--lg" href="/sign-in">
                  Get started<span className="ic" data-icon="arrow-right"></span>
                </a>
                <div className="install">
                  <code className="install__cmd">
                    <span className="install__prompt">$</span> npm i -g secmgr
                  </code>
                  <button
                    className="install__copy"
                    type="button"
                    data-copy="npm i -g secmgr"
                    aria-label="Copy install command"
                  >
                    <span className="ic install__icon-copy" data-icon="copy"></span>
                    <span className="ic install__icon-check" data-icon="check"></span>
                  </button>
                  <span className="install__tip" aria-hidden="true">
                    Copied
                  </span>
                </div>
              </div>
            </div>
            <a className="hero__scroll" href="#manifesto">
              <span>Scroll to explore</span>
              <span className="hero__scroll-btn">
                <span className="ic" data-icon="arrow-down"></span>
              </span>
            </a>
          </section>

          <section className="manifesto" id="manifesto" data-theme="light" data-flip aria-labelledby="manifesto-label">
            <div className="manifesto__sticky">
              <div className="manifesto__inner">
                <p className="eyebrow" id="manifesto-label">
                  <span className="eyebrow__dot"></span>Why secmgr
                </p>
                <p className="manifesto__text" id="manifesto-text">
                  Secrets do not belong in Slack threads, in a <code>.env</code> someone emailed in 2021, or in a doc
                  called <code>passwords-final</code>. They belong <em>somewhere quiet,</em> where every change has an
                  author and nothing leaks by accident.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="chapters" id="product" data-theme="light" data-flip>
          <section
            className="chapter"
            id="import"
            data-theme="light"
            data-flip
            data-chapter="import"
            aria-labelledby="ch-import-title"
          >
            <div className="chapter__grid">
              <div className="chapter__copy" data-reveal>
                <p className="eyebrow">
                  <span className="eyebrow__num">01</span>Import
                </p>
                <h2 className="chapter__title" id="ch-import-title">
                  Paste a .env.
                  <br />
                  That is the import.
                </h2>
                <p className="chapter__body">
                  Paste anywhere on the page or drop the file. Every line is parsed and sorted into new, changed and
                  invalid before a single value is written.
                </p>
                <ul className="chapter__facts">
                  <li>
                    <span className="kbd-group">
                      <kbd className="kbd">&#8984;</kbd>
                      <kbd className="kbd">V</kbd>
                    </span>
                    Paste anywhere to open the import
                  </li>
                  <li>
                    <span className="ic" data-icon="shield-check"></span>Conflicts wait for you: overwrite or skip, per
                    key
                  </li>
                </ul>
              </div>
              <div className="chapter__stage" data-reveal>
                <div
                  className="frame"
                  data-theme="dark"
                  role="img"
                  aria-label="Import preview: a pasted .env with 16 lines becomes 12 new, 3 changed and 1 invalid secret, and a bar offers Save 15 changes."
                >
                  <div className="frame__bar">
                    <span className="frame__dots">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    <span className="frame__title">
                      <span className="mono">lumen-api</span>
                      <span className="frame__slash">/</span>
                      <span className="env-dot" style={{ "--_c": "var(--env-amber)" }}></span>staging
                    </span>
                  </div>
                  <div className="frame__body">
                    <div className="rail">
                      <span className="rail__i is-on" data-icon="key-round"></span>
                      <span className="rail__i" data-icon="git-compare-arrows"></span>
                      <span className="rail__i" data-icon="history"></span>
                      <span className="rail__i" data-icon="settings"></span>
                    </div>
                    <div className="panel imp" id="demo-import"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="chapter chapter--flip"
            id="compare"
            data-theme="light"
            data-flip
            data-chapter="compare"
            aria-labelledby="ch-compare-title"
          >
            <div className="chapter__grid">
              <div className="chapter__copy" data-reveal>
                <p className="eyebrow">
                  <span className="eyebrow__num">02</span>Compare
                </p>
                <h2 className="chapter__title" id="ch-compare-title">
                  See drift before production does.
                </h2>
                <p className="chapter__body">
                  Line up development, staging and production side by side. Missing keys, values that differ and live
                  keys where they do not belong surface on their own.
                </p>
                <ul className="chapter__facts">
                  <li>
                    <span className="ic" data-icon="plus"></span>Add a missing key to production in one click
                  </li>
                  <li>
                    <span className="ic" data-icon="eye-off"></span>Values stay masked until you reveal them
                  </li>
                </ul>
              </div>
              <div className="chapter__stage" data-reveal>
                <div
                  className="frame"
                  data-theme="dark"
                  role="img"
                  aria-label="Compare matrix of development, staging and production: FEATURE_NEW_CHECKOUT is missing in production and STRIPE_SECRET_KEY is a shared live key in staging."
                >
                  <div className="frame__bar">
                    <span className="frame__dots">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    <span className="frame__title">
                      <span className="mono">lumen-api</span>
                      <span className="frame__slash">/</span>compare
                    </span>
                  </div>
                  <div className="frame__body">
                    <div className="rail">
                      <span className="rail__i" data-icon="key-round"></span>
                      <span className="rail__i is-on" data-icon="git-compare-arrows"></span>
                      <span className="rail__i" data-icon="history"></span>
                      <span className="rail__i" data-icon="settings"></span>
                    </div>
                    <div className="panel cmp" id="demo-compare"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="chapter"
            id="cli"
            data-theme="light"
            data-flip
            data-chapter="cli"
            aria-labelledby="ch-cli-title"
          >
            <div className="chapter__grid">
              <div className="chapter__copy" data-reveal>
                <p className="eyebrow">
                  <span className="eyebrow__num">03</span>CLI
                </p>
                <h2 className="chapter__title" id="ch-cli-title">
                  One command.
                  <br />
                  Every environment.
                </h2>
                <p className="chapter__body">
                  Run any process with the environment injected. No .env on disk, nothing to commit by accident, the
                  same command on a laptop and in CI.
                </p>
                <ul className="chapter__cmds" id="cli-cmds">
                  <li data-cmd="0">
                    <code>secmgr run --env staging -- npm run dev</code>
                  </li>
                  <li data-cmd="1">
                    <code>secmgr diff staging production</code>
                  </li>
                  <li data-cmd="2">
                    <code>secmgr pull --env production &gt; .env</code>
                  </li>
                </ul>
              </div>
              <div className="chapter__stage" data-reveal>
                <div
                  className="frame frame--term"
                  data-theme="dark"
                  role="img"
                  aria-label="Terminal: secmgr run --env staging -- npm run dev prints Injected 24 secrets from lumen-api/staging, then the API boots and listens on port 8080."
                >
                  <div className="frame__bar">
                    <span className="frame__dots">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    <span className="frame__title">
                      <span className="mono">~/code/lumen-api</span>
                    </span>
                  </div>
                  <div className="term" id="demo-cli">
                    <div className="term__inner"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="chapter chapter--flip"
            id="activity"
            data-theme="light"
            data-flip
            data-chapter="activity"
            aria-labelledby="ch-activity-title"
          >
            <div className="chapter__grid">
              <div className="chapter__copy" data-reveal>
                <p className="eyebrow">
                  <span className="eyebrow__num">04</span>Activity
                </p>
                <h2 className="chapter__title" id="ch-activity-title">
                  Every change has an author.
                </h2>
                <p className="chapter__body">
                  Every read, reveal and edit is recorded with who, which key, which environment and when. Open any
                  entry to see exactly what changed.
                </p>
                <ul className="chapter__facts">
                  <li>
                    <span className="ic" data-icon="users"></span>Filter by member, action or environment
                  </li>
                  <li>
                    <span className="ic" data-icon="key-round"></span>Service tokens are named, scoped and logged too
                  </li>
                </ul>
              </div>
              <div className="chapter__stage" data-reveal>
                <div
                  className="frame"
                  data-theme="dark"
                  role="img"
                  aria-label="Activity log: Priya Raman updated STRIPE_SECRET_KEY in staging, Jonas Weber revealed DATABASE_URL in production, ci-deploy read 23 secrets from production."
                >
                  <div className="frame__bar">
                    <span className="frame__dots">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    <span className="frame__title">
                      <span className="mono">lumen-labs</span>
                      <span className="frame__slash">/</span>activity
                    </span>
                  </div>
                  <div className="frame__body">
                    <div className="rail">
                      <span className="rail__i" data-icon="key-round"></span>
                      <span className="rail__i" data-icon="git-compare-arrows"></span>
                      <span className="rail__i is-on" data-icon="history"></span>
                      <span className="rail__i" data-icon="settings"></span>
                    </div>
                    <div className="panel act" id="demo-activity"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="features" id="features" data-theme="light" data-flip aria-labelledby="features-title">
          <div className="wrap">
            <div className="features__head" data-reveal>
              <p className="eyebrow">
                <span className="eyebrow__dot"></span>Everything else
              </p>
              <h2 className="section-title" id="features-title">
                Everything a secret needs.
                <br />
                <span className="title-light">Nothing it does not.</span>
              </h2>
            </div>
            <ul className="features__grid">
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="lock-keyhole"></span>
                <h3>Encrypted at rest</h3>
                <p>
                  Every value is sealed with AES-256-GCM under its project&apos;s own key. The database only ever holds
                  ciphertext.
                </p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="shield-check"></span>
                <h3>Protected environments</h3>
                <p>Production carries a lock. Saving to it asks you to type its name first.</p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="timer-reset"></span>
                <h3>Rotation reminders</h3>
                <p>Rotate every N days per secret. A badge appears the day a key is due.</p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="link-2"></span>
                <h3>One-time share links</h3>
                <p>Send a single value through a link that expires after one view or 24 hours.</p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="command"></span>
                <h3>Command menu</h3>
                <p>
                  Press <kbd className="kbd kbd--sm">&#8984;</kbd>
                  <kbd className="kbd kbd--sm">K</kbd> to jump to any project, environment or secret, or run an action.
                </p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="history"></span>
                <h3>Audit log</h3>
                <p>Who did what to which key in which environment, and when. Each entry opens its diff.</p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="square-terminal"></span>
                <h3>CLI and CI tokens</h3>
                <p>Scoped service tokens, read or read and write, with expiry and last used.</p>
              </li>
              <li className="feature" data-reveal>
                <span className="feature__icon" data-icon="container"></span>
                <h3>Self-host with Docker</h3>
                <p>Run the whole thing on your own infrastructure from a single container.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="oss" id="open-source" data-theme="light" data-flip aria-labelledby="oss-title">
          <div className="wrap oss__grid">
            <div className="oss__copy" data-reveal>
              <p className="eyebrow">
                <span className="eyebrow__dot"></span>Open source
              </p>
              <h2 className="oss__title" id="oss-title">
                Read every line.
                <br />
                <span className="title-light">Run it yourself.</span>
              </h2>
              <p className="oss__body">
                secmgr is developed in the open. File an issue, send a patch, or keep every secret on hardware you
                control.
              </p>
              <div className="oss__actions">
                <a className="pill pill--solid pill--lg" href="https://github.com/secmgr/secmgr">
                  <span className="ic" data-icon="star"></span>Star on GitHub
                </a>
                <a className="textlink" href="https://github.com/secmgr/secmgr#run-it-locally">
                  Read the self-host guide<span className="ic" data-icon="arrow-right"></span>
                </a>
              </div>
            </div>
            <div className="oss__code" data-reveal>
              <div className="code" data-theme="dark">
                <div className="code__bar">
                  <span className="code__name">
                    <span className="ic" data-icon="container"></span>self-host.sh
                  </span>
                  <span className="code__badge">Planned command</span>
                  <button
                    className="code__copy"
                    type="button"
                    data-copy="docker run -d -p 3000:3000 -v secmgr-data:/data ghcr.io/secmgr/secmgr"
                    aria-label="Copy docker command"
                  >
                    <span className="ic install__icon-copy" data-icon="copy"></span>
                    <span className="ic install__icon-check" data-icon="check"></span>
                    <span className="code__copy-label">Copy</span>
                  </button>
                </div>
                <pre className="code__pre">
                  <code>
                    <span className="c-com">{"# Run secmgr with a persistent volume"}</span>
                    {"\n"}
                    <span className="c-pr">{"$"}</span>
                    {" docker run -d -p 3000:3000 \\"}
                    {"\n"}
                    {"    -v secmgr-data:/data \\"}
                    {"\n"}
                    {"    "}
                    <span className="c-val">{"ghcr.io/secmgr/secmgr"}</span>
                    {"\n"}
                    {"\n"}
                    <span className="c-com">{"# Point the CLI at your instance"}</span>
                    {"\n"}
                    <span className="c-pr">{"$"}</span>
                    {" secmgr login --host "}
                    <span className="c-val">{"http://localhost:3000"}</span>
                    {"\n"}
                    <span className="c-pr">{"$"}</span>
                    {" secmgr link "}
                    <span className="c-val">{"lumen-api"}</span>
                  </code>
                </pre>
                <p className="code__note">
                  <span className="ic" data-icon="info"></span>The container image is planned. Names and flags may
                  change before the first release.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta" id="get-started" data-theme="dark" aria-labelledby="cta-title">
          <div className="cta__tiles" id="cta-tiles" aria-hidden="true"></div>
          <div className="cta__inner">
            <p className="cta__line" id="cta-title">
              The open source secret manager for teams.
            </p>
            <a className="cta__pill" href="/sign-in">
              Get started<span className="ic" data-icon="arrow-right"></span>
            </a>
            <p className="cta__sub">
              Or install the CLI with <code>npm i -g secmgr</code>
            </p>
          </div>
        </section>
      </main>

      <footer className="footer" data-theme="dark">
        <div className="wrap footer__top">
          <div className="footer__intro">
            <svg className="footer__mark" viewBox="0 0 32 32" aria-hidden="true">
              <use href="#sm-mark" />
            </svg>
            <p className="footer__tag">The open source secret manager for teams.</p>
          </div>
          <nav className="footer__cols" aria-label="Footer">
            <div className="footer__col">
              <h2>Product</h2>
              <ul>
                <li>
                  <a href="#import">Import</a>
                </li>
                <li>
                  <a href="#compare">Compare</a>
                </li>
                <li>
                  <a href="#cli">CLI</a>
                </li>
                <li>
                  <a href="#activity">Activity</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/releases">Changelog</a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>Resources</h2>
              <ul>
                <li>
                  <a href="https://github.com/secmgr/secmgr#readme">Docs</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/tree/main/apps/cli">CLI reference</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr#run-it-locally">Self-hosting</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/blob/main/SECURITY.md#how-secrets-are-protected">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>Community</h2>
              <ul>
                <li>
                  <a href="https://github.com/secmgr/secmgr">GitHub</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/discussions">Discussions</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/issues">Issues</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/blob/main/CONTRIBUTING.md">Contributing</a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>Legal</h2>
              <ul>
                <li>
                  <a href="https://github.com/secmgr/secmgr/blob/main/LICENSE">MIT license</a>
                </li>
                <li>
                  <a href="https://github.com/secmgr/secmgr/blob/main/SECURITY.md">Security policy</a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="footer__giant" aria-hidden="true">
          <svg viewBox="0 0 127 32" id="footer-word" aria-hidden="true">
            <use href="#sm-word" />
          </svg>
        </div>
      </footer>

      <button
        className="theme-toggle"
        id="theme-toggle"
        type="button"
        aria-pressed="false"
        aria-label="Dark mode"
        data-theme="dark"
      >
        <span className="ic theme-toggle__moon" data-icon="moon"></span>
        <span className="ic theme-toggle__sun" data-icon="sun"></span>
      </button>

      <p className="sr-only" id="live" aria-live="polite"></p>
      <HomeScript />
    </>
  );
}
