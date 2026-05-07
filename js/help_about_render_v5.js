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

    <div class="helpHubRows helpHubRowsDirect" role="list" aria-label="Help sections">
        <details class="helpHubRowWrap" data-help-accordion data-help-key="quickstart" role="listitem"><summary class="helpHubRow" id="help_jump_quickstart"><span class="helpHubRowIcon">🚀</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Quick start</span><span class="helpHubRowDesc">Fast first-run checklist</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Bank the Catch helps you track trips, pounds, total pay, price/lb, dealers, and areas. Add a trip with pounds and price per pound, then Home and Insights update automatically.</b></div><ol style="margin:8px 0 0 18px"><li>Add a trip in <b>New Trip</b>.</li><li>Enter pounds and price per pound.</li><li>Review your <b>Home numbers</b>.</li><li>Use <b>Insights</b> as you add more trips.</li><li>Create backups to keep your trip records safe.</li></ol></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="home" role="listitem"><summary class="helpHubRow" id="help_jump_home"><span class="helpHubRowIcon">🏠</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Home</span><span class="helpHubRowDesc">Season Preview and quick status</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Use it for:</b> Season Preview checks before or after a trip.</div><ul style="margin:8px 0 0 18px"><li>On first run, Home points you to <b>New Trip</b>.</li><li>Totals and trend cards follow your selected range.</li><li>Tap a Home number card for a closer look.</li><li>Use Overview for a simple season summary.</li></ul></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="trips" role="listitem"><summary class="helpHubRow" id="help_jump_trips"><span class="helpHubRowIcon">🗂️</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Trips</span><span class="helpHubRowDesc">Review your saved trip logbook</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Use it for:</b> reviewing your saved trip records/logbook.</div><ul style="margin:8px 0 0 18px"><li>Trip cards are for review. Use <b>Edit Trip</b> to change an entry and <b>Share Card</b> to export/share a trip card.</li><li>Use filters to narrow by range, dealer, or area. Open <b>More Filters</b> for pounds, pay, and price per pound.</li><li>Duplicate warning on save means: check date/dealer/area before saving anyway.</li></ul></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="reports" role="listitem"><summary class="helpHubRow" id="help_jump_reports"><span class="helpHubRowIcon">📈</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Insights</span><span class="helpHubRowDesc">Deeper season details</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Use it for:</b> deeper season details by date range, dealer, area, and month.</div><ol style="margin:8px 0 0 18px"><li>Use <b>Insights</b> as you add more trips.</li><li>Insights helps you see more season detail by dealer, area, and month.</li><li>Pick a date window.</li><li>Add optional dealer/area filters, then switch between charts and table views.</li></ol></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="newtrip" role="listitem"><summary class="helpHubRow" id="help_jump_newtrip"><span class="helpHubRowIcon">📝</span><span class="helpHubRowBody"><span class="helpHubRowLabel">New Trip</span><span class="helpHubRowDesc">Log pounds, pay, dealer, and area</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Use it for:</b> logging one harvest trip at a time.</div><ol style="margin:8px 0 0 18px"><li>Set <b>Date</b>.</li><li>Enter pounds and price per pound.</li><li>Choose <b>Dealer</b> and <b>Area</b>.</li><li>Tap <b>Save Trip</b>.</li></ol><div style="margin-top:8px"><b>How pay is tracked:</b> Pounds show how much you dug. Price per pound is the dealer's pay rate. Bank the Catch uses those numbers to track your trip pay. If your check total is different, open <b>Check total different?</b></div><div style="margin-top:8px"><b>Tip:</b> chips fill in as you save more trips. Use list pickers first if chips are empty.</div></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="settings" role="listitem"><summary class="helpHubRow" id="help_jump_settings"><span class="helpHubRowIcon">⚙️</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Settings</span><span class="helpHubRowDesc">Help, backups, updates, lists, install, and support</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Use it for:</b> quick actions and status checks.</div><ul style="margin:8px 0 0 18px"><li><b>Help:</b> open <b>Help / App guide</b>.</li><li><b>Backup:</b> open <b>Backup and restore trips</b> for <b>Create Backup</b> and <b>Restore</b>.</li><li><b>Updates:</b> open <b>App version and updates</b>.</li><li><b>Lists:</b> manage <b>Areas &amp; dealers</b>.</li><li><b>Install:</b> open <b>App setup on this device</b>.</li><li><b>About:</b> check <b>Version, support, and legal</b>.</li><li><b>Support:</b> use <b>Troubleshooting and reset tools</b>.</li></ul></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="backups" role="listitem"><summary class="helpHubRow" id="help_jump_backups"><span class="helpHubRowIcon">💾</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Backup and restore trips</span><span class="helpHubRowDesc">Protect and move your trip history</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Create backup</b></div><ol style="margin:8px 0 0 18px"><li>Open Settings → <b>Backup and restore trips</b>.</li><li>Tap <b>Create Backup</b>.</li><li>Keep one current backup and one older backup off-device in <b>iCloud Drive</b> (Apple) or <b>Google Drive</b> (Android).</li></ol><div style="margin-top:8px"><b>Restore</b></div><ol style="margin:8px 0 0 18px"><li>In Settings, tap <b>Restore</b>.</li><li>Review preview details before confirming.</li><li>Choose <b>Merge</b> or <b>Replace</b>.</li></ol><div style="margin-top:8px"><b>Tip:</b> Create a backup before switching phones, browsers, or app icons.</div></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="install" role="listitem"><summary class="helpHubRow" id="help_jump_install"><span class="helpHubRowIcon">📲</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Install app</span><span class="helpHubRowDesc">Installed app steps</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><div><b>Current mode:</b> ${escapeHtml(String(installModel?.statusPill || (isStandalone ? "Installed" : "Browser")))}</div><div style="margin-top:8px">${escapeHtml(String(installModel?.statusLine || "Use the installed app for the best experience. Add Bank the Catch to your Home Screen, then open it from the app icon."))}</div><div style="margin-top:8px"><b>Tip:</b> Create a backup before switching phones, browsers, or app icons.</div><div style="margin-top:8px">Settings shows quick mode + action status. This section has the full install steps.</div><div style="margin-top:8px"><b>iPhone/iPad Safari</b></div>${renderInstallStepCards([{ step: 1, icon: "safari", label: "Safari" },{ step: 2, icon: "share", label: "Share" },{ step: 3, icon: "addhome", label: "Add to Home Screen" },{ step: 4, icon: "add", label: "Add" }], "ios")}<div class="muted small" style="margin-top:8px">Tap the Share button — the square with the arrow — then choose Add to Home Screen.</div><div style="margin-top:8px"><b>Android Chrome</b></div>${renderInstallStepCards([{ step: 1, icon: "chrome", label: "Chrome" },{ step: 2, icon: "menu", label: "Menu" },{ step: 3, icon: "install", label: "Install app" },{ step: 4, icon: "confirm", label: "Confirm" }], "android")}<div class="muted small" style="margin-top:8px">Tap the Chrome Menu in the top-right, then choose Install app or Add to Home screen.</div><div style="margin-top:8px"><b>Tip:</b> After install: open Bank the Catch from your Home Screen app icon.</div><div style="margin-top:8px"><b>Need help?</b> Email <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a>.</div></div></details>
        <details class="helpHubRowWrap" data-help-accordion data-help-key="updates" role="listitem"><summary class="helpHubRow" id="help_jump_updates"><span class="helpHubRowIcon">🛟</span><span class="helpHubRowBody"><span class="helpHubRowLabel">Updates & troubleshooting</span><span class="helpHubRowDesc">Finish updates first, then use reset tools if needed</span></span><span class="helpHubRowChevron" aria-hidden="true">⌄</span></summary><div class="helpHubRowContent muted helpSectionLead"><ul style="margin:0 0 0 18px"><li>If you see <b>Finish app update</b>, tap <b>Finish update</b> when ready. It only reloads Bank the Catch on this device. Your saved trips stay safe.</li><li>If the app still looks stale after that, open <b>Settings → App version and updates</b> and run <b>Reload latest build</b>.</li><li>Use <b>Reset cache &amp; reload</b> as the stronger troubleshooting step when normal update reload does not fix it.</li><li>For support, email <a class="settingsEmail" href="mailto:jmwlegacyllc@gmail.com">jmwlegacyllc@gmail.com</a> and include a short note about what happened plus copied troubleshooting info.</li></ul></div></details>
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
