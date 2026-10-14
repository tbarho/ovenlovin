/**
 * MCP Resources
 *
 * Resources provide read-only access to household data:
 * - Household profile
 * - Per-person rules
 * - Schedule templates
 */

import { HouseholdService, PeopleService, ScheduleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import type { AuthContext } from "../auth/index";

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * List available resources for the authenticated household
 */
export async function listResources(_context: AuthContext): Promise<MCPResource[]> {
  // TODO: Implement dynamic resource listing
  // - List people in household
  // - Return resource URIs for each person's rules
  // - Include schedule resources

  return [
    {
      uri: `ovenlovin://household/${_context.householdId}/profile`,
      name: "Household Profile",
      description: "Household name, members, and basic settings",
      mimeType: "application/json",
    },
    {
      uri: `ovenlovin://household/${_context.householdId}/schedule`,
      name: "Weekly Schedule",
      description: "Weekly meal schedule template with busy levels and constraints",
      mimeType: "application/json",
    },
    {
      uri: `ovenlovin://household/${_context.householdId}/people`,
      name: "People & Rules",
      description: "Household members with their dietary rules and preferences",
      mimeType: "application/json",
    },
  ];
}

/**
 * Read a specific resource by URI
 */
export async function readResource(uri: string, _context: AuthContext): Promise<unknown> {
  const url = new URL(uri);

  if (url.protocol !== "ovenlovin:") {
    throw new Error("Invalid resource URI protocol");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts[0] !== "household") {
    throw new Error("Invalid resource type");
  }

  const householdId = pathParts[1];
  if (householdId !== _context.householdId) {
    throw new Error("Access denied: household mismatch");
  }

  const resourceType = pathParts[2];

  switch (resourceType) {
    case "profile":
      return getHouseholdProfile(_context);
    case "schedule":
      return getHouseholdSchedule(_context);
    case "people":
      return getHouseholdPeople(_context);
    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}

async function getHouseholdProfile(_context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const household = await new HouseholdService(db).getHousehold(_context.householdId);
  const people = await new PeopleService(db).listPeopleByHousehold(_context.householdId, {
    limit: 100,
  });
  return {
    id: _context.householdId,
    name: household?.name ?? "Household",
    memberCount: people.items.length,
  };
}

async function getHouseholdSchedule(_context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  return new ScheduleService(db).getSchedule(_context.householdId);
}

async function getHouseholdPeople(_context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const people = await new PeopleService(db).listPeopleByHousehold(_context.householdId, {
    limit: 100,
  });
  return {
    people: people.items.map((person) => ({
      id: person.id,
      displayName: person.displayName,
      sortOrder: person.sortOrder,
    })),
  };
}
