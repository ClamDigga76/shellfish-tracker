export function renderHelpViewHTML({ renderPageHeader, escapeHtml, displayBuildVersion, schemaVersion, isStandalone, hasSWController }) {
  return `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Quick Help Links</b>
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
      <b style="font-size:1.05rem">Install & Offline</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this is for:</b> Keep Bank the Catch on your home screen and usable even with weak signal.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>iPhone/iPad:</b> Safari → Share → <b>Add to Home Screen</b>.</li>
          <li><b>Android:</b> Chrome menu → <b>Install app</b> (or Add to Home screen).</li>
          <li>If the app looks out of date, open <b>Settings → Refresh App</b>, then reopen.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" style="font-size:1.05rem">Home</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Fast snapshot of your current totals and recent activity.</div>
        <ul style="margin:8px 0 0 18px">
          <li>Totals and recent trips follow your active filter (YTD / Month / Last 7 days).</li>
          <li>Use Home when you want a quick status check before or after a trip.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_trips" style="font-size:1.05rem">Trips</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Browse saved trips and open one to edit details.</div>
        <ul style="margin:8px 0 0 18px">
          <li>Tap a trip card to view/edit it.</li>
          <li>If you see a duplicate warning on save, check date/dealer/area first, then choose <b>Save anyway</b> only if it is truly a different trip.</li>
          <li>Use <b>New Trip</b> for a fresh entry.</li>
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
        <div style="margin-top:8px"><b>Tip:</b> Quick chips can fill Area/Dealer faster.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_reports" style="font-size:1.05rem">Reports</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Analyze totals, trends, and breakdowns.</div>
        <div style="margin-top:8px"><b>How to use it:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Pick a date window (preset or advanced range).</li>
          <li>Optional: add dealer/area filters.</li>
          <li>Switch between <b>Charts</b> and <b>Tables</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> If numbers look off, recheck filters first.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" style="font-size:1.05rem">Settings</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this screen is for:</b> Manage updates, lists, data safety, and diagnostics.</div>
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates:</b> Check current build and refresh if needed.</li>
          <li><b>List Management:</b> Add/edit Dealers and Areas used in trip entry.</li>
          <li><b>Data:</b> Create or restore backups.</li>
          <li><b>Advanced:</b> Copy Debug Info, Refresh App, Erase All Data.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" style="font-size:1.05rem">Backups & Restore</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>What this is for:</b> Protect your trip records before phone changes, resets, or major updates.</div>
        <div style="margin-top:8px"><b>Create backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Go to Settings → Data.</li>
          <li>Tap <b>Create Backup</b>.</li>
          <li>Move the file to safe storage (iCloud Drive / Google Drive).</li>
        </ol>
        <div style="margin-top:8px"><b>Restore backup:</b></div>
        <ol style="margin:8px 0 0 18px">
          <li>Open Settings → Data → <b>Restore Backup</b>.</li>
          <li>Review the preview details.</li>
          <li>Choose <b>Merge</b> or <b>Replace</b>.</li>
        </ol>
        <div style="margin-top:8px"><b>Tip:</b> Make a fresh backup before restoring.</div>
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
      <div class="muted small" style="margin-top:8px">All data stays on this device unless you choose to export/backup files.</div>
      <div class="muted small" style="margin-top:6px">Legal: <a class="settingsEmail" href="legal/terms.html">Terms</a> • <a class="settingsEmail" href="legal/privacy.html">Privacy</a> • <a class="settingsEmail" href="legal/license.html">License</a></div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy Debug Info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
}
