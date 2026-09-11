import { NavLink } from "@/components/layout/nav-link";

export function SettingsNav() {
  return (
    <nav className="mb-6 flex gap-1 border-b border-line pb-2">
      <NavLink href="/settings">Account</NavLink>
      <NavLink href="/settings/notifications">Notifications</NavLink>
      <NavLink href="/settings/security">Security</NavLink>
      <NavLink href="/settings/privacy">Privacy & data</NavLink>
    </nav>
  );
}
