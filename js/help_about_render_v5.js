export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController, installModel }) {
  return `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Help hub</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.5">Jump to the section you need. Help is the main place for install, support, and backup guidance.</div>
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
        <div><b>Start with one trip</b>, then use Home for your first snapshot and Reports after you have enough trips to compare.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>New Trip</b> and save your first entry.</li>
          <li>Check <b>Home</b> for totals, your latest trip, and the next best step.</li>
          <li>Open <b>Reports</b> after more trips are saved for clearer dealer, area, and monthly trends.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" class="helpSectionTitle">Home</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> quick status checks before or after a trip.</div>
        <ul style="margin:8px 0 0 18px">
          <li>If you are brand new, Home points you to <b>New Trip</b> first.</li>
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
        <div style="margin-top:8px"><b>Tip:</b> chips fill in after more saved trips. Use list pickers first if chips are empty.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_reports" class="helpSectionTitle">Reports</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> date-range trends by dealer, area, and month.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Start here after your first trip, and expect stronger insights after a few saved trips.</li>
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
          <li><b>Updates:</b> check status and reload the latest version when needed.</li>
          <li><b>Install App:</b> see whether you are in Browser or Installed mode, then jump here for full steps.</li>
          <li><b>Backup & Restore:</b> run the action there, then use this Help page when you need the how-to.</li>
          <li><b>List Management:</b> maintain Dealers and Areas.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" class="helpSectionTitle">Backup & Restore guidance</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Create backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open Settings → <b>Backup & Restore</b>.</li>
          <li>Tap <b>Create Backup</b>.</li>
          <li>Store one copy in iCloud Drive or Google Drive, and keep one older backup too.</li>
        </ol>
        <div style="margin-top:8px"><b>Restore backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>Restore Backup</b>.</li>
          <li>Review preview details before confirming.</li>
          <li>Choose <b>Merge</b> or <b>Replace</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Practical tip:</b> If you switch phones, browsers, or app mode, create a fresh backup first.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_install" class="helpSectionTitle">Install app</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Current mode:</b> ${escapeHtml(String(installModel?.statusPill || (isStandalone ? "Installed" : "Browser")))}</div>
        <div style="margin-top:8px">${escapeHtml(String(installModel?.statusLine || "Bank the Catch can run in your browser or as an installed Home Screen app."))}</div>
        <div style="margin-top:8px">Settings shows your current mode. Help is the full install guide.</div>
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
        <div style="margin-top:8px"><b>Tip:</b> If Settings says <b>Browser</b>, you are not in the installed app yet. After install, open Bank the Catch from the Home Screen icon.</div>
        <div style="margin-top:8px"><b>Need more help?</b> Use support: <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a>.</div>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Support, updates & troubleshooting</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <ul style="margin:0 0 0 18px">
          <li>If the app looks stale, open <b>Settings</b> and first use <b>Reload latest version</b>. If the status warns about mismatch or stale cache risk, use <b>Reset cache &amp; reload</b>.</li>
          <li>Use <b>Settings → Install App</b> to check whether you are in Browser or Installed mode, then use this Help section for the matching steps.</li>
          <li>If behavior seems off after an update, reload once, then reopen Help or Settings and recheck the status lines.</li>
          <li>For support, email <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a>.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b>Build details</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.6">
        <div>App: <b>${escapeHtml(String(displayBuildVersion))}</b> (schema ${escapeHtml(String(schemaVersion || ""))})</div>
        <div>Standalone: <b>${isStandalone ? "yes" : "no"}</b></div>
        <div>SW controller: <b>${hasSWController ? "yes" : "no"}</b></div>
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
      <div class="muted small" style="margin-top:6px">Support: <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
      <div class="muted small" style="margin-top:6px">Legal: <a class="settingsEmail" href="legal/terms.html">Terms</a> • <a class="settingsEmail" href="legal/privacy.html">Privacy</a> • <a class="settingsEmail" href="legal/license.html">License</a></div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy diagnostics info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
}
