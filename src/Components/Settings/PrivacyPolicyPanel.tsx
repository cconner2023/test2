import type { ReactNode } from 'react'
import { ShieldCheck, Database, EyeOff, Server, Trash2, UserCheck, Activity, Camera, Baby, Cookie, Globe, FileCheck } from 'lucide-react'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'

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

/**
 * Bump when this policy changes materially, and bump ACK_VERSION
 * (UserAcknowledgment.tsx) with it: the gate re-prompts on ACK_VERSION only,
 * and this number is what policy_acceptances records for document 'privacy'.
 */
export const PRIVACY_POLICY_VERSION = 2

/** Policy body without the drawer scroll shell; also rendered inline in the acceptance gate. */
export const PrivacyPolicyContent = () => (
  <>
      {/* ── Intro ── */}
      <div className="px-1">
        <p className="text-[10pt] text-tertiary leading-relaxed">
          We are committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
        </p>
        <p className="text-[9pt] text-tertiary mt-1">Last updated: November 2026</p>
      </div>

      {/* ── Data Collection ── */}
      <div>
        <SectionHeader>Data Collection</SectionHeader>
        <SectionCard>
          <Row icon={<EyeOff size={18} className="text-themeblue2" />} title="No Patient Data Collected" border={false}>
            <p>This application does <strong className="text-primary">not</strong> collect, store, or transmit Protected Health Information (PHI). Medical documentation is not recorded on or sent to our servers.</p>
          </Row>
          <Row icon={<Database size={18} className="text-themeblue2" />} title="Information We Collect">
            <p>If you create an account, we collect and store:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li><strong className="text-primary">Profile:</strong> Name, rank, component (service branch), medical credential</li>
              <li><strong className="text-primary">Unit info:</strong> Unit Identification Code (UIC) and cluster association</li>
              <li><strong className="text-primary">Preferences:</strong> Theme, note content settings, text expanders</li>
              <li><strong className="text-primary">Training:</strong> Training task completion progress</li>
              <li><strong className="text-primary">Account:</strong> Email address and authentication credentials</li>
              <li><strong className="text-primary">Activity:</strong> Timestamp of your last activity (optional), updated periodically via background heartbeat</li>
              <li><strong className="text-primary">Messaging:</strong> All message contents are end-to-end encrypted (E2EE).  The server sees encryption not messaging content</li>
              <li><strong className="text-primary">Property:</strong> Property locations and quantities</li>
              <li><strong className="text-primary">Location:</strong> During active missions, your field position is optionally stored as part of the mission calendar event, E2EE and scoped only to mission participants who opt-in. Location is never collected outside of this opt-in active mission context</li>
            </ul>
            <p className="mt-1">Guest users can use most base app features without creating an account. Data is not collected from guest users.</p>
          </Row>
        </SectionCard>
      </div>

      {/* ── Usage & Storage ── */}
      <div>
        <SectionHeader>Usage & Storage</SectionHeader>
        <SectionCard>
          <Row icon={<UserCheck size={18} className="text-themeblue2" />} title="How We Use Your Information" border={false}>
            <p>Your information is used solely for:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li>Logging training completion and enabling supervisor validation</li>
              <li>Storing your app preferences</li>
              <li>Authenticating your identity</li>
              <li>Associating you with your unit for training administration</li>
            </ul>
            <p className="mt-1">We do <strong className="text-primary">not</strong> sell, share, or distribute your information to outside third parties. Training completion data is used for analytics within the unit structure. Your data is not used for advertising, or any purpose beyond the features listed above.</p>
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
        </SectionCard>
      </div>

      {/* ── Access & Control ── */}
      <div>
        <SectionHeader>Access & Control</SectionHeader>
        <SectionCard>
          <Row icon={<ShieldCheck size={18} className="text-themeblue2" />} title="Data Access" border={false}>
            <p>Your profile data is accessible only to:</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li><strong className="text-primary">You</strong> : full access to your own data</li>
              <li><strong className="text-primary">Supervisors</strong> : training completion status for personnel in their unit</li>
              <li><strong className="text-primary">Administrators</strong> : account management and support</li>
            </ul>
          </Row>
          <Row icon={<Activity size={18} className="text-themeblue2" />} title="Activity Monitoring">
            <p>To maintain platform security and manage resources, an optional background heartbeat periodically records the date and time of your last activity while the app is open. This updates your profile and each registered device so you can review your own active sessions in <strong className="text-primary">Settings &gt; Sessions &amp; Devices</strong>.</p>
            <p className="mt-1">Activity tracking is enabled by default. No location, usage, or behavioral data is collected; only a timestamp.</p>
            <p className="mt-1">Accounts with no recorded activity for more than 90 consecutive days may be placed in hibernation. Disabling activity tracking means no heartbeat is sent, which may cause your account to be flagged as inactive.</p>
            <p className="mt-1">You can opt out at any time in <strong className="text-primary">Settings &gt; Security &gt; Activity Tracking</strong>.</p>
          </Row>
          <Row icon={<Camera size={18} className="text-themeblue2" />} title="Device Permissions">
            <p>This app requests access to your camera and location only for specific features. You can review and grant these permissions at any time in <strong className="text-primary">Settings &gt; Security &gt; Permissions</strong>.</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5 mt-1">
              <li><strong className="text-primary">Camera:</strong> Used for QR code scanning (device linking, contact lookup) and property item identification. The camera is activated only when you explicitly trigger a scan. Any images or recordings are only shared with the server if you choose to do so.</li>
              <li><strong className="text-primary">Location:</strong> Used to share your field position with mission participants during active operations. Location sharing is tied to calendar missions and does not run in the background outside of this opt-in active mission context.</li>
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
        </SectionCard>
      </div>

      {/* ── Children, Cookies, Third Parties ── */}
      <div>
        <SectionHeader>Age, Cookies & Third Parties</SectionHeader>
        <SectionCard>
          <Row icon={<Baby size={18} className="text-themeblue2" />} title="Children's Privacy" border={false}>
            <p>We do not ask for your birthdate when creating an account. You confirm by accepting this privacy policy that you are at least 18 years old</p>
            <p className="mt-1">We do not knowingly collect personal information from anyone under 18, including children under 13 as defined by the Children's Online Privacy Protection Act (COPPA). If we learn that an account belongs to someone under 18, we will delete the account and all associated data. If you believe a minor has provided us information, report it through the Feedback panel.</p>
          </Row>
          <Row icon={<Cookie size={18} className="text-themeblue2" />} title="Cookies & Local Storage">
            <p>This application does <strong className="text-primary">not</strong> use cookies, advertising identifiers, analytics trackers, or cross-site tracking of any kind.</p>
            <p className="mt-1">To function offline and keep you signed in, the app stores data on your device using browser storage (local storage, IndexedDB, and the service worker cache). This storage is strictly for the app to work, is never shared with third parties, and is removed when you sign out or clear your browser data.</p>
          </Row>
          <Row icon={<Globe size={18} className="text-themeblue2" />} title="Third-Party Services">
            <p>The app connects directly to the following services. Like any web request, these services receive your device's IP address and basic browser information; they do not receive your profile or message contents.</p>
            <ul className="list-disc list-outside ml-4 space-y-0.5">
              <li><strong className="text-primary">Supabase:</strong> account, authentication, and data storage</li>
              <li><strong className="text-primary">Cloudflare R2:</strong> storage for file attachments, which are encrypted on your device before upload</li>
              <li><strong className="text-primary">Google Firebase Cloud Messaging:</strong> delivery of push notifications, if you enable them</li>
              <li><strong className="text-primary">Map providers</strong> (OpenStreetMap, OpenTopoMap, Esri ArcGIS, USGS National Map): map tiles and place search, only when you use map features</li>
            </ul>
            <p className="mt-1">The app does not load fonts, scripts, or other content from third-party content delivery networks.</p>
          </Row>
          <Row icon={<FileCheck size={18} className="text-themeblue2" />} title="Acceptance Records">
            <p>When you accept the User Acknowledgment and this Privacy Policy, we record which version you accepted, the date and time, and your confirmation that you are 18 or older. These records are visible only to you and administrators, and are deleted with your account.</p>
            <p className="mt-1">Guest users' acceptance is not recorded; guests are asked to accept each time the app is opened.</p>
          </Row>
        </SectionCard>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 rounded-xl border border-tertiary/10 bg-tertiary/5">
        <p className="text-[9pt] text-tertiary leading-relaxed">
          This privacy policy may be updated periodically. When it changes materially, you will be asked to review and accept the updated version before continuing to use the application. Questions or concerns about this policy can be submitted through the Feedback panel.
        </p>
      </div>
  </>
)

export const PrivacyPolicyPanel = () => (
  <div className="h-full overflow-y-auto">
    <div className="px-5 pb-4 space-y-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
      <PrivacyPolicyContent />
    </div>
  </div>
)
