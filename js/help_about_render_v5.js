function renderInstallStepIcon(name) {
  const icons = {
    safari: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="6.5"></circle><path d="M12 12 L16.8 7.8"></path><path d="M12 12 L8.9 15.9"></path></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="14" height="10" rx="2"></rect><path d="M12 14V4"></path><path d="M8.5 7.5 12 4l3.5 3.5"></path></svg>',
    addhome: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="4"></rect><path d="M12 8.5v7"></path><path d="M8.5 12h7"></path></svg>',
    add: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="m8.8 12.2 2.1 2.2 4.3-4.6"></path></svg>',
    chrome: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.3"></circle><path d="M12 3v9l7.7 4.4"></path><path d="M4.3 8.2h7.7"></path></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="18" r="1.8"></circle></svg>',
    install: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v9"></path><path d="m8.7 10.4 3.3 3.4 3.3-3.4"></path><rect x="5" y="15" width="14" height="4.5" rx="1.8"></rect></svg>',
    confirm: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="m8.8 12.2 2.1 2.2 4.3-4.6"></path></svg>'
  };
  return icons[name] || icons.confirm;
}

function renderInstallStepCards(items, platformClass = "") {
  return `
    <div class="installStepCards ${platformClass}">
      ${items.map((item) => `
        <div class="installStepCard">
          <div class="installStepBadge">${item.step}</div>
          <div class="installStepGlyph">${renderInstallStepIcon(item.icon)}</div>
          <div class="installStepLabel">${item.label}</div>
        </div>
      `).join("")}
    </div>
  `;
}

export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController, installModel }) {
  return `
    ${renderPageHeader("help")}

    <div class="card helpHubCard">
      <div class="helpHubHeader">
        <b class="helpHubTitle">Help hub</b>
        <span class="helpHubPill">Quick links</span>
      </div>
      <div class="muted small helpHubLead">Jump to the section you need. Help covers install, backup, updates, and troubleshooting.</div>
      <div class="helpHubRows" role="list" aria-label="Help sections">
        <button class="helpHubRow" type="button" data-helpjump="home" role="listitem"><span class="helpHubRowIcon">🏠</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Home</span><span class="helpHubRowDesc">Latest trip and season snapshot</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="trips" role="listitem"><span class="helpHubRowIcon">🗂️</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Trips</span><span class="helpHubRowDesc">Review saved trips and edit entries</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="reports" role="listitem"><span class="helpHubRowIcon">📈</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Insights</span><span class="helpHubRowDesc">Trend comparisons across saved trips</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="newtrip" role="listitem"><span class="helpHubRowIcon">📝</span><span class="helpHubRowBody"><span class="helpHubRowLabel">New Trip</span><span class="helpHubRowDesc">Log pounds, pay, dealer, and area</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="settings" role="listitem"><span class="helpHubRowIcon">⚙️</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Settings</span><span class="helpHubRowDesc">Updates, install status, and lists</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="backups" role="listitem"><span class="helpHubRowIcon">💾</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Backup & Restore</span><span class="helpHubRowDesc">Protect and move your trip history</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
        <button class="helpHubRow" type="button" data-helpjump="install" role="listitem"><span class="helpHubRowIcon">📲</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Install app</span><span class="helpHubRowDesc">Browser and installed mode steps</span></span><span class="helpHubRowChevron" aria-hidden="true">›</span></button>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Quick start</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Log one trip first.</b> Home updates right away, and Insights gets more useful after a few trips.</div>
        <ol style="margin:8px 0 0 18px">
          <li><b>Save a trip</b> — enter pounds, pay, dealer, and area.</li>
          <li><b>Check Home</b> — see your latest trip and season preview.</li>
          <li><b>Use Insights</b> — compare trends after a few trips are saved.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" class="helpSectionTitle">Home</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> quick status checks before or after a trip.</div>
        <ul style="margin:8px 0 0 18px">
          <li>On first run, Home points you to <b>New Trip</b>.</li>
          <li>Totals and trend cards follow your selected range.</li>
          <li>If stats look light, widen the range first.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_trips" class="helpSectionTitle">Trips</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> browsing and editing saved entries.</div>
        <ul style="margin:8px 0 0 18px">
          <li>Review saved trips from the card. Use <b>Edit Trip</b> when you need to change an entry.</li>
          <li>Use filters to narrow by range, dealer, or area.</li>
          <li>Duplicate warning on save means: check date/dealer/area before saving anyway.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_newtrip" class="helpSectionTitle">New Trip</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> logging one harvest trip at a time.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Set <b>Date</b>.</li>
          <li>Enter <b>Pounds</b> and <b>Amount</b>.</li>
          <li>Choose <b>Dealer</b> and <b>Area</b>.</li>
          <li>Tap <b>Save Trip</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> chips fill in as you save more trips. Use list pickers first if chips are empty.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_reports" class="helpSectionTitle">Insights</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> date-range trends by dealer, area, and month.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Insights start after your first trip and improve as you log more.</li>
          <li>Pick a date window.</li>
          <li>Add optional dealer/area filters, then switch between charts and table views.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" class="helpSectionTitle">Settings</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> quick actions and status checks.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates:</b> Check current build and latest build status, then run <b>Reload latest build</b> or <b>Reset cache &amp; reload</b> when prompted.</li>
          <li><b>Install App:</b> Browser mode and Installed mode are both valid. Installed mode is recommended for app-like use.</li>
          <li><b>Backup &amp; Restore:</b> Create backup, restore backup, and rollback / undo last restore.</li>
          <li><b>List Management:</b> maintain Dealers and Areas.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" class="helpSectionTitle">Backup & Restore guidance</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Create backup</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open Settings → <b>Backup & Restore</b>.</li>
          <li>Tap <b>Create Backup</b>.</li>
          <li>Keep one current copy and one older copy in iCloud Drive or Google Drive.</li>
        </ol>
        <div style="margin-top:8px"><b>Restore backup</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>In Settings, tap <b>Restore Backup</b>.</li>
          <li>Review preview details before confirming.</li>
          <li>Choose <b>Merge</b> or <b>Replace</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> Before switching phones, browsers, or app modes, create backup first.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_install" class="helpSectionTitle">Install app</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Current mode:</b> ${escapeHtml(String(installModel?.statusPill || (isStandalone ? "Installed" : "Browser")))}</div>
        <div style="margin-top:8px">${escapeHtml(String(installModel?.statusLine || "Bank the Catch can run in Browser mode or Installed mode. Both are valid. Installed mode is recommended for app-like use."))}</div>
        <div style="margin-top:8px"><b>Storage note:</b> storage can differ by mode or device, so backup is the safe bridge when you switch.</div>
        <div style="margin-top:8px">Settings shows quick mode + action status. This section has the full install steps.</div>
        <div style="margin-top:8px"><b>iPhone/iPad Safari</b></div>
        ${renderInstallStepCards([
          { step: 1, icon: "safari", label: "Safari" },
          { step: 2, icon: "share", label: "Share" },
          { step: 3, icon: "addhome", label: "Add to Home Screen" },
          { step: 4, icon: "add", label: "Add" }
        ], "ios")}
        <div class="muted small" style="margin-top:8px">Tap the Share button — the square with the arrow — then choose Add to Home Screen.</div>
        <div style="margin-top:8px"><b>Android Chrome</b></div>
        ${renderInstallStepCards([
          { step: 1, icon: "chrome", label: "Chrome" },
          { step: 2, icon: "menu", label: "Menu" },
          { step: 3, icon: "install", label: "Install app" },
          { step: 4, icon: "confirm", label: "Confirm" }
        ], "android")}
        <div class="muted small" style="margin-top:8px">Tap the Chrome Menu in the top-right, then choose Install app or Add to Home screen.</div>
        <div style="margin-top:8px"><b>Tip:</b> After install: open Bank the Catch from your Home Screen app icon to switch into Installed mode.</div>
        <div style="margin-top:8px"><b>Need help?</b> Email <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a>.</div>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Support, updates & troubleshooting</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <ul style="margin:0 0 0 18px">
          <li>If the app looks stale, open <b>Settings</b> and run <b>Reload latest build</b>. If prompted, run <b>Reset cache &amp; reload</b>.</li>
          <li>Use <b>Settings → Install App</b> for a quick mode check, then follow the install steps above when needed.</li>
          <li>If things still seem off after updating, reopen the app, then check current build vs latest build status again.</li>
          <li>For support, email <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a>.</li>
        </ul>
      </div>
    </div>
  `;
}

export function renderAboutViewHTML({ renderPageHeader, displayBuildVersion }) {
  return `
    ${renderPageHeader("about")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backSettings">← Back</button>
        <b>About</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">App identity, support, and legal.</div>
    </div>

    <div class="card">
      <b>App details</b>
      <div class="sep"></div>
      <div class="muted small">Build: <b>${displayBuildVersion}</b></div>
      <div class="muted small" style="margin-top:8px">Bank the Catch is a mobile-first shellfish tracking app.</div>
      <div class="muted small" style="margin-top:6px">Support: <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a></div>
      <div class="muted small" style="margin-top:6px">Install and backup guides live in Help.</div>
      <div class="muted small" style="margin-top:6px">Legal: <a class="settingsEmail" href="legal/terms.html">Terms</a> • <a class="settingsEmail" href="legal/privacy.html">Privacy</a> • <a class="settingsEmail" href="legal/license.html">License</a></div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy support bundle</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
}
