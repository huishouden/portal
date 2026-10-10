import { describe, expect, test } from 'bun:test';
import { notifyingApps, REMINDER_APPS } from './notify';
import type { HouseholdApp } from './apps';

const app = (repo: string): HouseholdApp => ({ repo, name: repo, description: '', url: `/${repo}/`, icon: '', contactRoles: [] });
const all = ['tasks', 'groceries', 'home', 'pet', 'health', 'car', 'bills', 'spending', 'baby'].map(app);

describe('which apps a person can switch reminders for', () => {
  test('only the apps that write reminders, in the household order', () => {
    expect(notifyingApps(all, 'admin').map((a) => a.repo)).toEqual(['tasks', 'home', 'pet', 'health', 'car', 'bills', 'baby']);
    expect(REMINDER_APPS).toHaveLength(7);
  });
  test('no Bills for a helper or a kid, no Health for a kid', () => {
    expect(notifyingApps(all, 'helper').map((a) => a.repo)).toEqual(['tasks', 'home', 'pet', 'health', 'car', 'baby']);
    expect(notifyingApps(all, 'kid').map((a) => a.repo)).toEqual(['tasks', 'home', 'pet', 'car', 'baby']);
  });
});
