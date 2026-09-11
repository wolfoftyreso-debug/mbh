import { requireProfessional } from "@/server/auth/session";
import { hasAcceptedAgreement } from "@/server/domain/professionals/service";
import { AGREEMENT_VERSIONS, brand } from "@/lib/config/brand";
import { PageHeader, Alert } from "@/components/ui/card";
import { AcceptAgreementButton } from "@/components/professional/accept-agreement";

export default async function AgreementPage() {
  const viewer = await requireProfessional();
  const accepted = await hasAcceptedAgreement(viewer.userId, "PROFESSIONAL_CONFIDENTIALITY");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={`Version ${AGREEMENT_VERSIONS.PROFESSIONAL_CONFIDENTIALITY}`} title="Professional confidentiality agreement" />
      <div className="space-y-4 rounded-lg border border-line bg-surface p-6 text-sm text-ink-2">
        <p>As a professional on {brand.name} you receive material that customers have not published and may consider commercially sensitive, personal or proprietary. By accepting this agreement you undertake, for every assignment you work on, that customer materials will not be:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>disclosed to anyone outside the assignment,</li>
          <li>sold, licensed or otherwise transferred,</li>
          <li>published or publicly described, in whole or in part,</li>
          <li>copied beyond what the work genuinely requires,</li>
          <li>used to train external systems,</li>
          <li>uploaded to third-party services that are not authorized by the assignment&apos;s confidentiality and AI policy — including external AI assistants, translation tools, grammar tools and document processors,</li>
          <li>added to a public portfolio without explicit customer permission recorded on the platform.</li>
        </ul>
        <p>Where an assignment permits AI assistance, you use it through the platform so that processing remains governed by the customer&apos;s policy. You accept that access to confidential material is logged and that violations may lead to suspension, revocation of verification and liability under applicable law.</p>
        <p>You confirm that you will genuinely perform any service you sign for and that you will never sign a version you have not personally reviewed.</p>
        <p className="text-xs text-ink-3">Assignment-specific NDAs may be added by customers in the future and will be recorded separately.</p>
      </div>
      <div className="mt-6">{accepted ? <Alert tone="success">You have accepted the current version of this agreement.</Alert> : <AcceptAgreementButton />}</div>
    </div>
  );
}
