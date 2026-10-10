import { can, MONEY_APPS, type Role } from '@huishouden/pwa-kit/roles';
import type { HouseholdApp } from './apps';

/** The apps that write reminders, which a person can switch off for themselves. */
export const REMINDER_APPS = ['pet', 'health', 'bills', 'tasks', 'home', 'baby', 'car'];

/**
 * The apps whose reminders this role may be offered a switch for: no Bills for roles that can't see
 * money, no Health for kids, who never get personal reminders.
 */
export function notifyingApps(apps: HouseholdApp[], role: Role | null): HouseholdApp[] {
  return apps.filter((a) => REMINDER_APPS.includes(a.repo) && (can(role, 'see-money') || !MONEY_APPS.includes(a.repo)) && !(a.repo === 'health' && role === 'kid'));
}
