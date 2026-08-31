import { Link } from 'react-router-dom';

// DRAFT — placeholder content only. Replace with the real, reviewed Terms &
// Agreement before this is relied on for anything. Not legal advice.
const LAST_UPDATED = 'DRAFT — not yet finalized';

const SECTIONS = [
  {
    title: '1. Introduction',
    body: `These Terms and Agreement ("Terms") govern access to and use of Easy Books
      (the "Service"), provided by GeoInfosys ("we", "us", "our"). By creating an
      account or using the Service, you agree to these Terms. If you do not
      agree, do not use the Service.`,
  },
  {
    title: '2. The Service',
    body: `Easy Books is an accounting/ERP and school-management platform. Features
      and availability may change, be added, or be removed at our discretion,
      with reasonable notice for material changes.`,
  },
  {
    title: '3. Accounts & Access',
    body: `You are responsible for maintaining the confidentiality of your login
      credentials and for all activity under your account. Notify us promptly
      of any unauthorized use. Access is role-based; each user should only be
      granted the role appropriate to their responsibilities.`,
  },
  {
    title: '4. Your Data',
    body: `You retain ownership of the data you input into the Service (student
      records, financial records, documents, etc.). We process it only to
      provide the Service to you. We do not sell your data. You are
      responsible for the accuracy of data you enter and for complying with
      applicable data-protection obligations toward your own students,
      guardians, employees, and customers.`,
  },
  {
    title: '5. Payments & Fees',
    body: `Subscription fees, setup charges, and any usage-based charges (e.g. SMS
      credits) are as agreed separately with you. Fees are non-refundable
      except where required by law or explicitly agreed in writing.`,
  },
  {
    title: '6. Acceptable Use',
    body: `You agree not to misuse the Service — including attempting to bypass
      security controls, accessing data you're not authorized to see, or
      using the Service for any unlawful purpose.`,
  },
  {
    title: '7. Availability & Support',
    body: `We aim to keep the Service available and will make reasonable efforts to
      fix issues promptly, but we do not guarantee uninterrupted, error-free
      operation. Support is provided through the channels we make available to
      you.`,
  },
  {
    title: '8. Limitation of Liability',
    body: `To the maximum extent permitted by law, we are not liable for indirect,
      incidental, or consequential damages arising from use of the Service.
      Our total liability for any claim is limited to the fees you paid us in
      the 12 months preceding the claim.`,
  },
  {
    title: '9. Termination',
    body: `Either party may terminate the agreement per the terms agreed at
      sign-up. On termination, we will make your data available for export
      for a reasonable period before deletion, unless a longer retention is
      legally required.`,
  },
  {
    title: '10. Changes to These Terms',
    body: `We may update these Terms from time to time. Material changes will be
      communicated to you before they take effect.`,
  },
  {
    title: '11. Contact',
    body: `Questions about these Terms can be sent to our support contact.`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        </div>

        <div className="mb-2 inline-block px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wide">
          Draft — placeholder, not final
        </div>
        <h1 className="text-2xl font-bold mb-1">Terms and Agreement</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-semibold mb-1.5">{s.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 pt-6 border-t text-xs text-muted-foreground">
          This is a draft placeholder for planning purposes only. It has not been
          reviewed and must be replaced with a finalized version before being
          relied upon.
        </p>
      </div>
    </div>
  );
}
