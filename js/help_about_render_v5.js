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
      <b style="font-size:1.05rem">Install / Offline</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>iPhone/iPad:</b> Safari → Share → <b>Add to Home Screen</b>.</div>
        <div style="margin-top:6px"><b>Android:</b> Chrome menu → <b>Install app</b> (or Add to Home screen).</div>
        <div style="margin-top:6px">Installed PWAs can lag behind updates due to cached files—use <b>Refresh App</b> if something looks wrong.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" style="font-size:1.05rem">Home</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Totals</b> and the recent list follow your current filter (YTD / Month / Last 7 days).</li>
          <li>Use Home when you just want a quick “how am I doing?” snapshot.</li>
          <li>If you install the app, Home works offline too.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_trips" style="font-size:1.05rem">Trips</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li>Browse your trips. Tap a trip to view/edit (if available).</li>
          <li>Duplicate warning may appear when saving a trip that looks similar—use “Save anyway” only when it’s truly a different trip.</li>
          <li>Use <b>New Trip</b> to add a fresh harvest entry.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_newtrip" style="font-size:1.05rem">New Trip</b>
      <div class="sep"></div>
      <ol class="muted helpText" style="margin:8px 0 0 18px;line-height:1.62;font-size:.97rem">
        <li>Enter <b>Date</b>.</li>
        <li>Pick or type a <b>Dealer</b>.</li>
        <li>Enter <b>Pounds</b> and <b>Amount</b>.</li>
        <li>Pick an <b>Area</b>.</li>
        <li>Tap <b>Save Trip</b>.</li>
      </ol>
      <div class="hint">Tip: chips are quick-picks—tap to fill faster.</div>
    </div>

    <div class="card">
      <b id="help_jump_reports" style="font-size:1.05rem">Reports</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li>Reports uses the same date filter idea as Home, plus optional advanced range controls.</li>
          <li>Switch between <b>Charts</b> and <b>Tables</b> to see the same data different ways.</li>
          <li>If something looks off, double-check your filter/range first.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" style="font-size:1.05rem">Settings</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates</b>: check for updates and see build details.</li>
          <li><b>List Management</b>: edit Areas and Dealers used by New Trip.</li>
          <li><b>Data</b>: create/restore backup files (see Backups below).</li>
          <li><b>Advanced</b>: Copy Debug, Refresh App, Erase All Data.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" style="font-size:1.05rem">Backups & Restore</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Create Backup</b> makes a file containing your trips and lists. Keep it somewhere safe.</li>
          <li><b>Where to store it:</b> move the file into a cloud-synced folder so it’s included in your normal phone backups (iPhone: Files → iCloud Drive; Android: Files → Google Drive or Drive-synced folder).</li>
          <li><b>Restore Backup</b> lets you preview, then choose Merge or Replace. Best practice: create a backup first.</li>
          <li>If an update seems “stuck”, use <b>Refresh App</b> in Settings → Advanced (it clears cached files and reloads).</li>
        </ul>
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
