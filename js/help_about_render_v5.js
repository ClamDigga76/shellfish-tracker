export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController, installModel }) {
  return `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Help hub</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.5">Jump to what you need. Help is the full guide for install, backup, updates, and support.</div>
      <div class="helpHubNav" style="margin-top:10px">
        <button class="chip" type="button" data-helpjump="home">Home</button>
        <button class="chip" type="button" data-helpjump="trips">Trips</button>
        <button class="chip" type="button" data-helpjump="reports">Reports</button>
        <button class="chip" type="button" data-helpjump="settings">Settings</button>
        <button class="chip" type="button" data-helpjump="newtrip">New Trip</button>
        <button class="chip" type="button" data-helpjump="backups">Backup & Restore</button>
        <button class="chip" type="button" data-helpjump="install">Install app</button>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Quick start</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Log one trip first.</b> Home updates right away, and Reports gets more useful after a few trips.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>New Trip</b> and save an entry.</li>
          <li>Check <b>Home</b> for totals and your latest trip snapshot.</li>
          <li>Use <b>Reports</b> when you want trend comparisons.</li>
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
          <li>Tap a trip card to view and edit details.</li>
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
      <b id="help_jump_reports" class="helpSectionTitle">Reports</b>
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
        <ol style="margin:8px 0 0 18px">
          <li>Open Bank the Catch in <b>Safari</b>.</li>
          <li>Tap <b>Share</b> (square with arrow).</li>
          <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Android Chrome</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open Bank the Catch in <b>Chrome</b>.</li>
          <li>Use Chrome’s install prompt or tap the menu.</li>
          <li>Choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> If Settings says <b>Browser mode</b>, open the Home Screen icon after install to switch into Installed mode.</div>
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

    <div class="card">
      <b>Support details</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.6">
        <div>App version: <b>${escapeHtml(String(displayBuildVersion))}</b> (data format ${escapeHtml(String(schemaVersion || ""))})</div>
        <div>Installed mode: <b>${isStandalone ? "yes" : "no"}</b></div>
        <div>Offline update control active: <b>${hasSWController ? "yes" : "no"}</b></div>
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
