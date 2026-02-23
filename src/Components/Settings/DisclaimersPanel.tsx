import { ShieldCheck, Database, EyeOff, Server } from 'lucide-react'

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

export const DisclaimersPanel = () => (
  <div className="h-full overflow-y-auto">
    <div className="px-4 py-3 md:p-5 space-y-5">
      {/* PHI/PII Statement */}
      <div className="px-4 py-3 rounded-xl border border-themeblue2/20 bg-themeblue2/5">
        <div className="flex items-center gap-2 mb-1.5">
          <EyeOff size={16} className="text-themeblue2" />
          <span className="text-sm font-semibold text-primary">No PHI / PII</span>
        </div>
        <p className="text-xs text-tertiary/70 leading-relaxed">
          This application does <strong className="text-primary">not</strong> collect, store, or transmit Protected Health Information (PHI) or Personally Identifiable Information (PII). No patient data is recorded or sent to any server.
        </p>
      </div>

      <Section icon={<Database size={16} className="text-themeblue2" />} title="What We Store">
        <p>When you create an account, the following profile information is stored to support application functionality:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li>Name, rank, and component (service branch)</li>
          <li>Medical credential (e.g. EMT-B, PA-C) name</li>
          <li>Unit Identification Code (UIC) and clinic association</li>
          <li>App preferences (theme, note content settings, text expanders)</li>
          <li>Training completion progress</li>
          <li>Notification preferences</li>
        </ul>
      </Section>

      <Section icon={<ShieldCheck size={16} className="text-themeblue2" />} title="Security">
        <p>Authentication is handled via Supabase with encrypted credentials. App lock PINs are hashed and salted before storage. Your profile data is only accessible to you and authorized administrators.</p>
      </Section>

      <Section icon={<Server size={16} className="text-themeblue2" />} title="Local Data">
        <p>To support offline first and push to server on connectivity, the following data is encrypted and cached locally on <strong className='text-primary'>your device</strong>:</p>
        <ul className="list-disc list-outside ml-4 space-y-0.5">
          <li>Profile information (Name, rank, component, medical credential, UIC, clinic association)</li>
          <li>App preferences (theme, note content settings, text expanders)</li>
          <li>Notification and security preferences</li>
          <li>Training completion progress</li>
        </ul>
        <p>Local data can be permanently deleted from your device at any time by signing out.</p>
      </Section>
    </div>
  </div>
)
