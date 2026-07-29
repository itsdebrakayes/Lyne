/**
 * Desktop first-launch setup.
 *
 * The installer-style wizard: it runs once, the first time this machine opens
 * the app, and it is about THIS COMPUTER — the licence, where downloaded
 * reports should go, whether the app should come back after a restart. It is
 * not about the organisation; branches and services are configured once by an
 * executive inside the app.
 *
 * Kept short on purpose. Four screens, sensible defaults already filled in, and
 * a Finish that works even if somebody clicks straight through — nobody reads
 * these, and a wizard that punishes skipping is a wizard that gets cancelled.
 *
 * Everything is stored by the Electron main process in the app's own userData,
 * not in localStorage: these are machine settings and must survive a sign-out
 * or a different member of staff signing in on the same terminal.
 */
import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, FolderOpen, Monitor, Shield } from 'lucide-react';
import { Note } from '@/design/ui';
import '@/design/qx.css';
import './desktop-setup.css';

type Api = {
  getSettings: () => Promise<any>;
  setSettings: (patch: any) => Promise<any>;
  pickFolder: (current?: string) => Promise<string | null>;
  openFolder: (dir: string) => Promise<unknown>;
  setLoginLaunch: (on: boolean) => Promise<boolean>;
};
const electron = (): Api | null => (window as any).electronAPI ?? null;

const SCREENS = ['welcome', 'licence', 'downloads', 'preferences', 'done'] as const;
type Screen = (typeof SCREENS)[number];

export default function DesktopSetup({ onFinish }: { onFinish?: () => void }) {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [accepted, setAccepted] = useState(false);
  const [downloadDir, setDownloadDir] = useState('');
  const [launchOnLogin, setLaunchOnLogin] = useState(true);
  const [notify, setNotify] = useState(true);
  const [meta, setMeta] = useState<{ version?: string; platform?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    electron()?.getSettings().then((s) => {
      setDownloadDir(s.downloadDir || s.defaultDownloadDir || '');
      setLaunchOnLogin(s.launchOnLogin ?? true);
      setNotify(s.notify ?? true);
      setMeta({ version: s.version, platform: s.platform });
    }).catch(() => {});
  }, []);

  const idx = SCREENS.indexOf(screen);
  const canContinue = screen === 'licence' ? accepted : true;

  const finish = async () => {
    setSaving(true);
    try {
      const api = electron();
      if (api) {
        await api.setSettings({ downloadDir, launchOnLogin, notify, setupCompleted: true });
        await api.setLoginLaunch(launchOnLogin);
      }
      onFinish?.();
    } finally {
      setSaving(false);
    }
  };

  const pick = async () => {
    const chosen = await electron()?.pickFolder(downloadDir);
    // null means they cancelled — keep whatever was already chosen.
    if (chosen) setDownloadDir(chosen);
  };

  return (
    <div className="qx ds">
      <div className="ds-window">
        <header className="ds-titlebar">
          <span className="ds-mark">Q</span>
          <b>QMe Now Setup</b>
          {meta.version ? <small>Version {meta.version}</small> : null}
        </header>

        <div className="ds-body">
          <aside className="ds-side">
            <div className="ds-sidemark">Q</div>
            <p>Queue management for branches that serve the public.</p>
          </aside>

          <main className="ds-content">
            {screen === 'welcome' ? (
              <>
                <h1>Welcome To QMe Now</h1>
                <p className="ds-lead">
                  This will set up QMe Now on this computer. It takes under a minute, and you can
                  change any of it later from Settings.
                </p>
                <ul className="ds-list">
                  <li><Shield size={16} />Accept the licence terms</li>
                  <li><Download size={16} />Choose where downloaded reports are saved</li>
                  <li><Monitor size={16} />Decide whether QMe Now starts with this machine</li>
                </ul>
              </>
            ) : null}

            {screen === 'licence' ? (
              <>
                <h1>Licence Agreement</h1>
                <p className="ds-lead">Please read this before continuing.</p>
                <div className="ds-licence">
                  <p><b>QMe Now — Software Licence</b></p>
                  <p>
                    This software is licensed, not sold. Your organisation is granted a
                    non-exclusive, non-transferable licence to install and use QMe Now on
                    computers it owns or controls, for the term of its subscription.
                  </p>
                  <p>
                    <b>Data.</b> Queue records, staff details and the contact details customers
                    provide belong to your organisation. QMe Now processes them on your behalf and
                    does not sell them or use them to train anything.
                  </p>
                  <p>
                    <b>Availability.</b> The software is provided without warranty of
                    uninterrupted service. Branch operations should have a manual fallback for
                    periods when the system or its network is unavailable.
                  </p>
                  <p>
                    <b>Restrictions.</b> You may not resell, sublicense, or reverse engineer the
                    software, or use it to process data for an organisation other than your own.
                  </p>
                  <p>
                    <b>Termination.</b> On termination you may export your data in a portable
                    format for thirty days, after which it is deleted.
                  </p>
                </div>
                <label className="ds-accept">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>I have read and accept the licence terms</span>
                </label>
              </>
            ) : null}

            {screen === 'downloads' ? (
              <>
                <h1>Where Should Reports Be Saved?</h1>
                <p className="ds-lead">
                  Reports you generate — performance summaries, quarterly reviews, branch packs —
                  download as Word or PDF files. Choose where they land.
                </p>
                <div className="ds-folder">
                  <FolderOpen size={20} />
                  <span title={downloadDir}>{downloadDir || 'No folder chosen yet'}</span>
                  <button type="button" className="ds-btn" onClick={pick}>Change…</button>
                </div>
                <Note icon={Download} title="A Shared Folder Works Well Here"
                  body="If several people prepare reports on this machine, pointing this at a shared drive means nobody has to hunt for the file afterwards." />
              </>
            ) : null}

            {screen === 'preferences' ? (
              <>
                <h1>A Couple Of Preferences</h1>
                <p className="ds-lead">Both can be changed later in Settings.</p>
                <label className="ds-row">
                  <span className="t">
                    <b>Start QMe Now When This Computer Starts</b>
                    <small>
                      Recommended on a branch terminal, so the queue comes back on its own after a
                      power cut without someone needing to know to launch it.
                    </small>
                  </span>
                  <input type="checkbox" checked={launchOnLogin} onChange={(e) => setLaunchOnLogin(e.target.checked)} />
                </label>
                <label className="ds-row">
                  <span className="t">
                    <b>Show Desktop Notifications</b>
                    <small>Alerts when a line goes over target, or a counter stalls with people waiting.</small>
                  </span>
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                </label>
              </>
            ) : null}

            {screen === 'done' ? (
              <>
                <div className="ds-tick"><Check size={30} /></div>
                <h1>Setup Complete</h1>
                <p className="ds-lead">
                  QMe Now is ready on this computer. Sign in with the account your administrator
                  gave you to get started.
                </p>
                <div className="ds-summary">
                  <div><span>Reports Save To</span><b title={downloadDir}>{downloadDir || 'Default downloads folder'}</b></div>
                  <div><span>Starts With This Computer</span><b>{launchOnLogin ? 'Yes' : 'No'}</b></div>
                  <div><span>Desktop Notifications</span><b>{notify ? 'On' : 'Off'}</b></div>
                </div>
              </>
            ) : null}
          </main>
        </div>

        <footer className="ds-foot">
          <span className="ds-steps">
            {SCREENS.map((s, i) => <i key={s} className={i === idx ? 'on' : i < idx ? 'done' : ''} />)}
          </span>
          <div className="ds-actions">
            {idx > 0 && screen !== 'done' ? (
              <button type="button" className="ds-btn" onClick={() => setScreen(SCREENS[idx - 1])}>
                <ChevronLeft size={16} />Back
              </button>
            ) : null}
            {screen === 'done' ? (
              <button type="button" className="ds-btn primary" disabled={saving} onClick={finish}>
                {saving ? 'Finishing…' : 'Finish'}<Check size={16} />
              </button>
            ) : (
              <button type="button" className="ds-btn primary" disabled={!canContinue}
                onClick={() => setScreen(SCREENS[idx + 1])}>
                {screen === 'welcome' ? 'Get Started' : 'Next'}<ChevronRight size={16} />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
