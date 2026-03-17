export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController }) {
  return `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Help hub</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.5">Jump to the section you need.</div>
      <div class="helpHubNav" style="margin-top:10px">
        <button class="chip" type="button" data-helpjump="home">Home</button>
        <button class="chip" type="button" data-helpjump="trips">Trips</button>
        <button class="chip" type="button" data-helpjump="reports">Reports</button>
        <button class="chip" type="button" data-helpjump="settings">Settings</button>
        <button class="chip" type="button" data-helpjump="newtrip">New Trip</button>
        <button class="chip" type="button" data-helpjump="backups">Backup & Restore</button>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Quick start</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Start with one trip</b>, then use Home for snapshots and Reports for trends.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>New Trip</b> and save your first entry.</li>
          <li>Check <b>Home</b> for totals, latest trip, and range context.</li>
          <li>Open <b>Reports</b> when you need deeper date-range summaries.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" class="helpSectionTitle">Home</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> quick status checks before or after a trip.</div>
        <ul style="margin:8px 0 0 18px">
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
          <li>Pick a date window.</li>
          <li>Add optional dealer/area filters.</li>
          <li>Switch between charts and table views.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" class="helpSectionTitle">Settings</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <div><b>Use it for:</b> updates, lists, backups, and diagnostics.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates:</b> check build status and load latest update safely.</li>
          <li><b>List Management:</b> maintain Dealers and Areas.</li>
          <li><b>Backup & Restore:</b> export and recover your trip data.</li>
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
          <li>Store a copy in iCloud Drive or Google Drive.</li>
        </ol>
        <div style="margin-top:8px"><b>Restore backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>Restore Backup</b>.</li>
          <li>Review preview details.</li>
          <li>Choose <b>Merge</b> or <b>Replace</b>.</li>
        </ol>
      </div>
    </div>

    <div class="card">
      <b class="helpSectionTitle">Updates & troubleshooting</b>
      <div class="sep"></div>
      <div class="muted helpSectionLead">
        <ul style="margin:0 0 0 18px">
          <li>If the app looks stale, open <b>Settings</b> and use <b>Load latest update</b>.</li>
          <li>For install help: iPhone/iPad → Safari Share → <b>Add to Home Screen</b>; Android → Chrome menu → <b>Install app</b>.</li>
          <li>If behavior seems off after an update, reload once and recheck in Help/Settings status lines.</li>
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
      <div class="hint">Version & diagnostics.</div>
    </div>

    <div class="card">
      <b>App details</b>
      <div class="sep"></div>
      <div class="muted small">Build: <b>${displayBuildVersion}</b></div>
      <div class="muted small" style="margin-top:8px">Data stays on this device unless you choose to export a backup file.</div>
      <div class="muted small" style="margin-top:6px">Legal: <a class="settingsEmail" href="legal/terms.html">Terms</a> • <a class="settingsEmail" href="legal/privacy.html">Privacy</a> • <a class="settingsEmail" href="legal/license.html">License</a></div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy diagnostics info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
}
