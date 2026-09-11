-- Integrity guarantees enforced by the database itself.

-- 1. Signed artifact versions are immutable: content, hash and status can never change.
CREATE OR REPLACE FUNCTION humanauth_protect_signed_version() RETURNS trigger AS $$
BEGIN
  IF OLD.immutable = true THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.artifact_id IS DISTINCT FROM OLD.artifact_id
       OR NEW.immutable IS DISTINCT FROM OLD.immutable
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('SIGNED','DELETED')) THEN
      RAISE EXCEPTION 'Signed artifact versions are immutable (version %)', OLD.id USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    -- Retention deletion keeps the hash and metadata; only the content may be cleared.
    IF NEW.status = 'DELETED' AND NEW.content IS NOT NULL THEN
      RAISE EXCEPTION 'Deleted versions must not retain content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_protect_signed_version ON artifact_version;
--> statement-breakpoint
CREATE TRIGGER trg_protect_signed_version BEFORE UPDATE ON artifact_version
  FOR EACH ROW EXECUTE FUNCTION humanauth_protect_signed_version();
--> statement-breakpoint
-- 2. Append-only tables: ledger entries, audit events, signatures and status history can never be updated or deleted.
CREATE OR REPLACE FUNCTION humanauth_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_ledger_append_only ON ledger_entry;
--> statement-breakpoint
CREATE TRIGGER trg_ledger_append_only BEFORE UPDATE OR DELETE ON ledger_entry
  FOR EACH ROW EXECUTE FUNCTION humanauth_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_audit_append_only ON audit_event;
--> statement-breakpoint
CREATE TRIGGER trg_audit_append_only BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION humanauth_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_signature_append_only ON signature;
--> statement-breakpoint
CREATE TRIGGER trg_signature_append_only BEFORE UPDATE OR DELETE ON signature
  FOR EACH ROW EXECUTE FUNCTION humanauth_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_status_history_append_only ON assignment_status_history;
--> statement-breakpoint
CREATE TRIGGER trg_status_history_append_only BEFORE UPDATE OR DELETE ON assignment_status_history
  FOR EACH ROW EXECUTE FUNCTION humanauth_append_only();
--> statement-breakpoint

-- 3. Financial sanity: payments and offers must be non-negative integers.
ALTER TABLE payment ADD CONSTRAINT payment_amount_nonnegative CHECK (amount_minor >= 0 AND platform_fee_minor >= 0 AND refunded_minor >= 0 AND refunded_minor <= amount_minor);
--> statement-breakpoint
ALTER TABLE offer ADD CONSTRAINT offer_price_nonnegative CHECK (price_minor >= 0);
--> statement-breakpoint
ALTER TABLE review ADD CONSTRAINT review_rating_range CHECK (rating BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE rating ADD CONSTRAINT rating_score_range CHECK (score BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE ledger_entry ADD CONSTRAINT ledger_currency_format CHECK (currency ~ '^[A-Z]{3}$');
