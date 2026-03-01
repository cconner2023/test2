import { ShieldCheck, Database, EyeOff, Server, Trash2, UserCheck, Scale, Activity } from 'lucide-react'

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-primary mb-1">{title}</h3>
      <div className="text-xs text-tertiary/70 leading-relaxed space-y-1.5">{children}</div>
    </div>
  </div>
)

export const PrivacyPolicyPanel = () => (
  <div className="h-full overflow-y-auto">
    <div className="px-4 py-3 md:p-5 space-y-5">
      <div className="px-4 py-3 rounded-xl border border-themeblue2/20 bg-themeblue2/5">
        <div className="flex items-center gap-2 mb-1.5">
          <Scale size={16} className="text-themeblue2" />
          <span className="text-sm font-semibold text-primary">Privacy Policy</span>
        </div>
        <p className="text-xs text-tertiary/70 leading-relaxed">
          We are committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
        </p>
        <p className="text-[10px] text-tertiary/50 mt-1">Last updated: February 2026</p>
      </div>

      <Section icon={<EyeOff size={16} className="text-themeblue2" />} title="No Patient Data Collected">
        <p>This application does <strong className="text-primary">not</strong> collect, store, or transmit Protected Health Information (PHI) or patients' Personally Identifiable Information (PII). No patient data is recorded on or sent to our servers. No patient information is saved locally.</p>
      </Section>

      <Section icon={<Database size={16} className="text-themeblue2" />} title="Information We Collect">
        <p>If you create an account, we collect and store the following to support training, preferences, and application storage:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li><strong className="text-primary">Profile:</strong> Name, rank, component (service branch), medical credential</li>
          <li><strong className="text-primary">Unit info:</strong> Unit Identification Code (UIC) and clinic association</li>
          <li><strong className="text-primary">Preferences:</strong> Theme, note content settings, text expanders</li>
          <li><strong className="text-primary">Training:</strong> Training task completion progress</li>
          <li><strong className="text-primary">Account:</strong> Email address and authentication credentials</li>
          <li><strong className="text-primary">Activity:</strong> Timestamp of your last interaction with the application</li>
          <li><strong className="text-primary">Messaging:</strong> All message contents are end-to-end encrypted (E2EE) and the server is not able to interpret them</li>
          <li><strong className="text-primary">Property:</strong> Property locations, quantities are stored so you always have access to them</li>
        </ul>
        <p className="mt-1">Guest users can use most app features without creating an account. No data is collected from guest users.</p>
      </Section>

      <Section icon={<UserCheck size={16} className="text-themeblue2" />} title="How We Use Your Information">
        <p>Your information is used solely for:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li>Logging training completion and enabling supervisor validation</li>
          <li>Storing your app preferences and your app information so it persists across devices</li>
          <li>Authenticating your identity when you sign in</li>
          <li>Associating you with your unit for training administration</li>
        </ul>
        <p className="mt-1">We do <strong className="text-primary">not</strong> sell, share, or distribute your information to outside third parties. Training completion data may be used for analytics within the unit. Your data is not used for advertising, or any purpose beyond the features listed above.</p>
      </Section>

      <Section icon={<Server size={16} className="text-themeblue2" />} title="Data Storage & Security">
        <p>Server-side data is encrypted with row-level security policies. Authentication credentials are encrypted. App lock PINs are hashed and salted before storage.</p>
        <p className="mt-1">To support offline functionality, the following is encrypted (AES-256-GCM) and cached locally on your device:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li>Profile information</li>
          <li>App preferences</li>
          <li>Training completion progress</li>
        </ul>
      </Section>

      <Section icon={<ShieldCheck size={16} className="text-themeblue2" />} title="Data Access">
        <p>Your profile data is accessible only to:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li><strong className="text-primary">You</strong> — full access to your own data</li>
          <li><strong className="text-primary">Supervisors</strong> — training completion status only for personnel in their unit</li>
          <li><strong className="text-primary">Administrators</strong> — account management and support</li>
        </ul>
      </Section>

      <Section icon={<Activity size={16} className="text-themeblue2" />} title="Activity Monitoring & Account Deactivation">
        <p>To maintain platform security and manage resources, we periodically record only the date and time of your last interaction with our server. This is used to determine whether your account is still active.</p>
        <p className="mt-1">Accounts with no recorded activity for more than 90 consecutive days may be placed in hibernation.</p>
        <p className="mt-1">You can always opt out of activity tracking in <strong className="text-primary">Settings &gt; Security &gt; Activity Tracking</strong></p>
      </Section>

      <Section icon={<Trash2 size={16} className="text-themeblue2" />} title="Your Rights & Data Deletion">
        <p>You have the right to:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li>Use the app without an account (guest mode)</li>
          <li>Request a copy of your stored data</li>
          <li>Request deletion of your account and all associated data</li>
        </ul>
        <p className="mt-1">Local data can be permanently deleted from your device at any time by signing out. To request deletion of your server-side profile, contact an administrator.</p>
      </Section>

      <div className="px-4 py-3 rounded-xl border border-tertiary/10 bg-themewhite2">
        <p className="text-xs text-tertiary/50 leading-relaxed">
          This privacy policy may be updated periodically. Continued use of the application constitutes acceptance of any changes. Questions or concerns about this policy can be submitted through the Feedback panel.
        </p>
      </div>
    </div>
  </div>
)
