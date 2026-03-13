export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController }) {
  return `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Help quick links</b>
      <div class="sep"></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="chip" type="button" data-helpjump="home">Home</button>
        <button class="chip" type="button" data-helpjump="trips">Trips</button>
        <button class="chip" type="button" data-helpjump="newtrip">New Trip</button>
        <button class="chip" type="button" data-helpjump="reports">Reports</button>
        <button class="chip" type="button" data-helpjump="settings">Settings</button>
        <button class="chip" type="button" data-helpjump="backups">Backups</button>
      </div>
    </div>

    <div class="card">
      <b style="font-size:1.05rem">Start here</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>New to Bank the Catch?</b> Start with one trip, then use Home and Reports to check progress.</div>
        <ol style="margin:8px 0 0 18px">
          <li>Open <b>New Trip</b> and save your first entry.</li>
          <li>Go to <b>Home</b> for a quick totals snapshot.</li>
          <li>Open <b>Reports</b> when you want date-range trends.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> After your first save, create a backup in <b>Settings → Backup & Restore</b> so your records stay protected.</div>
      </div>
    </div>

    <div class="card">
      <b style="font-size:1.05rem">Install & Offline</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this section is for:</b> Keep Bank the Catch on your home screen and available even with weak signal.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>iPhone/iPad:</b> Safari → Share → <b>Add to Home Screen</b>.</li>
          <li><b>Android:</b> Chrome menu → <b>Install app</b> (or Add to Home screen).</li>
          <li>If the app looks out of date, open <b>Settings</b>, check update status, then use <b>Load latest update</b> for a safe reload.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" style="font-size:1.05rem">Home</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Your quick check-in screen for totals and recent trips.</div>
        <ul style="margin:8px 0 0 18px">
          <li>Totals and recent trips follow your selected filter (YTD / Month / Last 7 days).</li>
          <li>Use Home before or after a trip when you want a quick app-health check.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_trips" style="font-size:1.05rem">Trips</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Your trip log. Browse saved trips and open one to edit details.</div>
        <ul style="margin:8px 0 0 18px">
          <li>Tap a trip card to view or edit it.</li>
          <li>If you see a duplicate warning on save, check date/dealer/area first, then choose <b>Save anyway</b> only if it is truly a different trip.</li>
          <li>Use <b>New Trip</b> to add another trip.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_newtrip" style="font-size:1.05rem">New Trip</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Record one harvest trip.</div>
        <div style="margin-top:8px"><b>How to use it:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Set the <b>Date</b>.</li>
          <li>Select or type a <b>Dealer</b>.</li>
          <li>Enter <b>Pounds</b> and <b>Amount</b>.</li>
          <li>Choose an <b>Area</b>.</li>
          <li>Tap <b>Save Trip</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> Quick chips can fill Area/Dealer fields faster.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_reports" style="font-size:1.05rem">Reports</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Compare totals and trends across date ranges, dealers, and areas.</div>
        <div style="margin-top:8px"><b>How to use it:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Pick a date window (preset or advanced range).</li>
          <li>Optional: add dealer/area filters.</li>
          <li>Switch between <b>Charts</b> and <b>Tables</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> If numbers look off, check your filters first.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" style="font-size:1.05rem">Settings</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Manage app-health status, lists, backups, and support tools.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates:</b> Check your current build and safely reload when needed.</li>
          <li><b>List Management:</b> Add/edit Dealers and Areas used in trip entry.</li>
          <li><b>Backups:</b> Create or restore backups.</li>
          <li><b>Advanced:</b> Copy debug info, reload app, erase all data.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" style="font-size:1.05rem">Backups & Restore</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this section is for:</b> Protect your trip records before phone changes, resets, restores, or major updates.</div>
        <div style="margin-top:8px"><b>Create backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Go to Settings → Backup & Restore.</li>
          <li>Tap <b>Create Backup</b>.</li>
          <li>Move the file to trusted storage (iCloud Drive / Google Drive).</li>
        </ol>
        <div style="margin-top:8px"><b>Restore backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open Settings → <b>Backup & Restore</b>.</li>
          <li>Review the preview details.</li>
          <li>Choose <b>Merge</b> or <b>Replace</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> Create a fresh backup before restoring so you keep a known-safe rollback copy.</div>
      </div>
    </div>

    <div class="card">
      <b>Build info</b>
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
      <div class="muted small">Version: <b>${displayBuildVersion}</b></div>
      <div class="muted small" style="margin-top:8px">All data stays on this device unless you choose to export/backup files for safekeeping.</div>
      <div class="muted small" style="margin-top:6px">Legal: <a class="settingsEmail" href="legal/terms.html">Terms</a> • <a class="settingsEmail" href="legal/privacy.html">Privacy</a> • <a class="settingsEmail" href="legal/license.html">License</a></div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy Debug Info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
}
