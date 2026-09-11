import { NavLink } from "@/components/layout/nav-link";
import { getT } from "@/server/i18n";

export async function SettingsNav() {
  const { t } = await getT();
  return (
    <nav className="mb-6 flex gap-1 border-b border-line pb-2">
      <NavLink href="/settings">{t("set.nav.account")}</NavLink>
      <NavLink href="/settings/notifications">{t("set.nav.notifications")}</NavLink>
      <NavLink href="/settings/security">{t("set.nav.security")}</NavLink>
      <NavLink href="/settings/privacy">{t("set.nav.privacy")}</NavLink>
    </nav>
  );
}
