import type { ReactNode } from 'react'
import { ShieldCheck, Database, EyeOff, Server, Trash2, UserCheck, Scale, Activity, Camera, MapPin } from 'lucide-react'

/* ── row primitive (matches PinSetupPanel / Settings card rows) ── */
const Row = ({ icon, iconColor, title, children, border = true }: {
  icon: ReactNode
  iconColor?: string
  title: string
  children: ReactNode
  border?: boolean
}) => (
  <div className={`flex items-start gap-3 px-4 py-3.5 ${border ? 'border-t border-tertiary/8' : ''}`}>
    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconColor ?? 'bg-themeblue2/15'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-primary">{title}</p>
      <div className="text-[9pt] text-tertiary mt-0.5 leading-relaxed space-y-1.5">{children}</div>
    </div>
  </div>
)

export const PrivacyPolicyPanel = () => (
  <div className="h-full overflow-y-auto">
    <div className="px-5 py-4 space-y-4">

      {/* ── Intro ── */}
      <div className="px-1">
        <p className="text-xs text-tertiary leading-relaxed">
          We are committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
        </p>
        <p className="text-[9pt] text-tertiary mt-1">Last updated: April 2026</p>
      </div>

      {/* ── Data Collection ── */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Data Collection</p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <Row icon={<EyeOff size={18} className="text-themeblue2" />} title="No Patient Data Collected" border={false}>
            <p>This application does <strong className="text-primary">not</strong> collect, store, or transmit Protected Health Information (PHI) or patients' Personally Identifiable Information (PII). No patient data is recorded on or sent to our servers.</p>
          </Row>
          <Row icon={<Database size={18} className="text-themeblue2" />} title="Information We Collect">
            <p>If you create an account, we collect and store:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li><strong className="text-primary">Profile:</strong> Name, rank, component (service branch), medical credential</li>
              <li><strong className="text-primary">Unit info:</strong> Unit Identification Code (UIC) and clinic association</li>
              <li><strong className="text-primary">Preferences:</strong> Theme, note content settings, text expanders</li>
              <li><strong className="text-primary">Training:</strong> Training task completion progress</li>
              <li><strong className="text-primary">Account:</strong> Email address and authentication credentials</li>
              <li><strong className="text-primary">Activity:</strong> Timestamp of your last activity, updated periodically via background heartbeat</li>
              <li><strong className="text-primary">Messaging:</strong> All message contents are end-to-end encrypted (E2EE) and the server is not able to interpret them</li>
              <li><strong className="text-primary">Property:</strong> Property locations and quantities so you always have access to them</li>
              <li><strong className="text-primary">Location:</strong> During active missions, your field position is stored as part of the mission calendar event, Signal-encrypted and scoped only to mission participants. Location is never collected outside of an active mission context</li>
            </ul>
            <p className="mt-1">Guest users can use most app features without creating an account. No data is collected from guest users.</p>
          </Row>
        </div>
      </div>

      {/* ── Usage & Storage ── */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Usage & Storage</p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <Row icon={<UserCheck size={18} className="text-themeblue2" />} title="How We Use Your Information" border={false}>
            <p>Your information is used solely for:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li>Logging training completion and enabling supervisor validation</li>
              <li>Storing your app preferences and information so it persists across devices</li>
              <li>Authenticating your identity when you sign in</li>
              <li>Associating you with your unit for training administration</li>
            </ul>
            <p className="mt-1">We do <strong className="text-primary">not</strong> sell, share, or distribute your information to outside third parties. Training completion data may be used for analytics within the unit. Your data is not used for advertising, or any purpose beyond the features listed above.</p>
          </Row>
          <Row icon={<Server size={18} className="text-themeblue2" />} title="Data Storage & Security">
            <p>Server-side data is encrypted with row-level security policies. Authentication credentials are encrypted. App lock PINs are hashed and salted before storage.</p>
            <p className="mt-1">To support offline functionality, the following is encrypted (AES-256-GCM) and cached locally on your device:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li>Profile information</li>
              <li>App preferences</li>
              <li>Training completion progress</li>
            </ul>
          </Row>
        </div>
      </div>

      {/* ── Access & Control ── */}
      <div>
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">Access & Control</p>
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <Row icon={<ShieldCheck size={18} className="text-themeblue2" />} title="Data Access" border={false}>
            <p>Your profile data is accessible only to:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li><strong className="text-primary">You</strong> — full access to your own data</li>
              <li><strong className="text-primary">Supervisors</strong> — training completion status only for personnel in their unit</li>
              <li><strong className="text-primary">Administrators</strong> — account management and support</li>
            </ul>
          </Row>
          <Row icon={<Activity size={18} className="text-themeblue2" />} title="Activity Monitoring">
            <p>To maintain platform security and manage resources, a background heartbeat periodically records the date and time of your last activity while the app is open. This updates your profile and each registered device so you can review your own active sessions in <strong className="text-primary">Settings &gt; Sessions &amp; Devices</strong>.</p>
            <p className="mt-1">Activity tracking is enabled by default. No location, usage, or behavioral data is collected — only a timestamp.</p>
            <p className="mt-1">Accounts with no recorded activity for more than 90 consecutive days may be placed in hibernation. Disabling activity tracking means no heartbeat is sent, which may cause your account to be flagged as inactive.</p>
            <p className="mt-1">You can opt out at any time in <strong className="text-primary">Settings &gt; Security &gt; Activity Tracking</strong>.</p>
          </Row>
          <Row icon={<Camera size={18} className="text-themeblue2" />} title="Device Permissions">
            <p>This app requests access to your camera and location only for specific features. You can review and grant these permissions at any time in <strong className="text-primary">Settings &gt; Security &gt; Permissions</strong>.</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5 mt-1">
              <li><strong className="text-primary">Camera:</strong> Used for QR code scanning (device linking, contact lookup) and property item identification. The camera is activated only when you explicitly trigger a scan. No images or video are stored or transmitted.</li>
              <li><strong className="text-primary">Location:</strong> Used to share your field position with mission participants during active operations. Location sharing is tied to calendar missions and does not run in the background outside of active mission context.</li>
            </ul>
            <p className="mt-1">If a permission is denied, the associated feature will be unavailable. Permissions can be granted or revoked through your browser or OS settings at any time.</p>
          </Row>
          <Row icon={<Trash2 size={18} className="text-themeblue2" />} title="Your Rights & Data Deletion">
            <p>You have the right to:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li>Use the app without an account (guest mode)</li>
              <li>Request a copy of your stored data</li>
              <li>Delete your account and all associated data at any time</li>
            </ul>
            <p className="mt-1">Local data can be permanently deleted from your device at any time by signing out. You can permanently delete your account and all server-side data at any time in <strong className="text-primary">Settings &gt; Profile &gt; Delete Account</strong>. This action is immediate and irreversible.</p>
          </Row>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 rounded-xl border border-tertiary/10 bg-tertiary/5">
        <p className="text-[9pt] text-tertiary leading-relaxed">
          This privacy policy may be updated periodically. Continued use of the application constitutes acceptance of any changes. Questions or concerns about this policy can be submitted through the Feedback panel.
        </p>
      </div>

    </div>
  </div>
)
