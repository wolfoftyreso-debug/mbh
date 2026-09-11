# Data model

All primary keys are ULIDs (strings). Timestamps are `timestamptz`. Money is integer minor units + ISO currency.

| Area | Tables |
| --- | --- |
| Auth | user, session, account, verification |
| Organizations | organization, organization_member |
| Reference | language, domain (materialized path taxonomy), service_category |
| Professional | professional_profile, professional_language, expertise_claim, expertise_verification, credential, credential_verification, credential_document, identity_verification, portfolio_item, service_listing |
| Assignment | assignment, assignment_participant, assignment_status_history, assignment_stage, knowledge_source, assignment_invitation, offer, message, message_attachment, attachment, file_blob, portfolio_permission_change |
| Artifacts | artifact, artifact_version, artifact_version_file, revision_request, review_comment, contribution, signature |
| Records | authorship_record, published_work, review, rating |
| Finance | payment, ledger_entry, payout, dispute |
| Ops | notification, notification_preference, audit_event, admin_action, ai_usage_event, agreement_acceptance, privacy_request, rate_limit_bucket, platform_setting |

## Retention classes

| Class | Examples | Deletion behaviour |
| --- | --- | --- |
| Public profile data | display name, bio, verified credentials | Removed/unpublished on deletion |
| Private account data | e-mail, phone, sessions | Anonymized on deletion |
| Verification documents | identity/credential uploads | Retention date set at upload (90 days); never public |
| Customer work | versions, files, messages | Deletable per retention; signed version keeps hash + metadata (content cleared, status DELETED) |
| Financial data | payment, ledger_entry, payout | Retained (legal) |
| Audit/security | audit_event, admin_action, signature | Retained, append-only |
