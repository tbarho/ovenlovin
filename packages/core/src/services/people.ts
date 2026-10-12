import { eq, and, isNull, desc } from "drizzle-orm";
import { person, personRule } from "@ovenlovin/db";
import type { Person, PersonRule } from "../schemas/people";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { BaseService } from "./base";

export class PeopleService extends BaseService {
  async getPerson(id: string): Promise<Person | null> {
    const [result] = await this._db
      .select()
      .from(person)
      .where(and(eq(person.id, id), isNull(person.deletedAt)))
      .limit(1);

    return result ? this.mapPerson(result) : null;
  }

  async listPeopleByHousehold(
    householdId: string,
    pagination?: Pagination
  ): Promise<PaginatedResponse<Person>> {
    const { limit } = this.getPaginationParams(pagination);

    const results = await this._db
      .select()
      .from(person)
      .where(and(eq(person.householdId, householdId), isNull(person.deletedAt)))
      .orderBy(desc(person.createdAt))
      .limit(limit + 1);

    const people = results.map((r) => this.mapPerson(r));

    return this.buildPaginatedResponse(people, limit);
  }

  async createPerson(
    data: Omit<Person, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Person> {
    const [created] = await this._db
      .insert(person)
      .values({
        householdId: data.householdId,
        userId: data.userId ?? null,
        displayName: data.displayName,
        birthYear: data.birthYear ?? null,
        birthMonth: data.birthMonth ?? null,
        sex: data.sex ?? null,
        activityProfile: data.activityProfile ?? null,
        notes: data.notes ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create person");
    return this.mapPerson(created);
  }

  async updatePerson(
    id: string,
    data: Partial<Omit<Person, "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy">>
  ): Promise<Person | null> {
    const [updated] = await this._db
      .update(person)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(person.id, id), isNull(person.deletedAt)))
      .returning();

    return updated ? this.mapPerson(updated) : null;
  }

  async deletePerson(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(person)
      .set({ deletedAt: new Date() })
      .where(and(eq(person.id, id), isNull(person.deletedAt)))
      .returning();

    return !!deleted;
  }

  async getRulesForPerson(personId: string): Promise<PersonRule[]> {
    const results = await this._db
      .select()
      .from(personRule)
      .where(and(eq(personRule.personId, personId), isNull(personRule.deletedAt)))
      .orderBy(desc(personRule.createdAt));

    return results.map((r) => this.mapPersonRule(r));
  }

  async createRule(
    data: Omit<PersonRule, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<PersonRule> {
    const [created] = await this._db
      .insert(personRule)
      .values({
        personId: data.personId,
        kind: data.kind,
        target: data.target,
        severity: data.severity,
        includeMayContain: data.includeMayContain ?? false,
        includeCrossContact: data.includeCrossContact ?? false,
        sharedFacility: data.sharedFacility ?? "ignore",
        includeUnmappedIngredients: data.includeUnmappedIngredients ?? false,
        includeDescendants: data.includeDescendants ?? true,
        treatCoconutAsTreeNut: data.treatCoconutAsTreeNut ?? true,
        label: data.label ?? null,
        note: data.note ?? null,
        activeFrom: data.activeFrom ?? null,
        activeUntil: data.activeUntil ?? null,
        setBy: data.setBy,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create rule");
    return this.mapPersonRule(created);
  }

  async updateRule(
    id: string,
    data: Partial<Omit<PersonRule, "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy">>
  ): Promise<PersonRule | null> {
    const [updated] = await this._db
      .update(personRule)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(personRule.id, id), isNull(personRule.deletedAt)))
      .returning();

    return updated ? this.mapPersonRule(updated) : null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(personRule)
      .set({ deletedAt: new Date() })
      .where(and(eq(personRule.id, id), isNull(personRule.deletedAt)))
      .returning();

    return !!deleted;
  }

  private mapPerson(row: typeof person.$inferSelect): Person {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      userId: row.userId ?? null,
      displayName: row.displayName,
      birthYear: row.birthYear ?? null,
      birthMonth: row.birthMonth ?? null,
      sex: row.sex ?? null,
      activityProfile: row.activityProfile ?? null,
      notes: row.notes ?? null,
    };
  }

  private mapPersonRule(row: typeof personRule.$inferSelect): PersonRule {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      personId: row.personId,
      kind: row.kind,
      target: row.target,
      severity: row.severity,
      includeMayContain: row.includeMayContain ?? false,
      includeCrossContact: row.includeCrossContact ?? false,
      sharedFacility: row.sharedFacility ?? "ignore",
      includeUnmappedIngredients: row.includeUnmappedIngredients ?? false,
      includeDescendants: row.includeDescendants ?? true,
      treatCoconutAsTreeNut: row.treatCoconutAsTreeNut ?? true,
      label: row.label ?? null,
      note: row.note ?? null,
      activeFrom: row.activeFrom ?? null,
      activeUntil: row.activeUntil ?? null,
      setBy: row.setBy,
    };
  }
}
