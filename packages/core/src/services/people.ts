import { eq, and, isNull, desc, asc, inArray, sql } from "drizzle-orm";
import { person, personRule, preference } from "@ovenlovin/db";
import type { Person, PersonRule, Preference } from "../schemas/people";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { BaseService } from "./base";
import { PeopleOrderError, orderedPersonIds } from "./people-order";

export { PeopleOrderError, movePersonId, orderedPersonIds } from "./people-order";

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
      .orderBy(asc(person.sortOrder), asc(person.createdAt), asc(person.id))
      .limit(limit + 1);

    const people = results.map((r) => this.mapPerson(r));

    return this.buildPaginatedResponse(people, limit);
  }

  async createPerson(
    data: Omit<Person, "id" | "createdAt" | "updatedAt" | "deletedAt" | "sortOrder"> & {
      sortOrder?: number;
    }
  ): Promise<Person> {
    const [countRow] = await this._db
      .select({ next: sql<number>`coalesce(max(${person.sortOrder}), -1) + 1` })
      .from(person)
      .where(and(eq(person.householdId, data.householdId), isNull(person.deletedAt)));

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
        sortOrder: data.sortOrder ?? Number(countRow?.next ?? 0),
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create person");
    return this.mapPerson(created);
  }

  async reorderPeople(householdId: string, personIds: string[]): Promise<Person[]> {
    const current = await this.listPeopleByHousehold(householdId, { limit: 200 });
    const ordered = orderedPersonIds(
      current.items.map((item) => item.id),
      personIds
    );

    await this._db.transaction(async (tx) => {
      for (const [index, id] of ordered.entries()) {
        await tx
          .update(person)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(
            and(eq(person.id, id), eq(person.householdId, householdId), isNull(person.deletedAt))
          );
      }
    });

    const next = await this.listPeopleByHousehold(householdId, { limit: 200 });
    if (next.items.map((item) => item.id).join() !== ordered.join()) {
      throw new PeopleOrderError("Could not persist the household order. Refresh and try again.");
    }
    return next.items;
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
    const now = new Date();
    return this._db.transaction(async (tx) => {
      await tx
        .update(personRule)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(personRule.personId, id), isNull(personRule.deletedAt)));

      await tx
        .update(preference)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(preference.personId, id), isNull(preference.deletedAt)));

      const [deleted] = await tx
        .update(person)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(person.id, id), isNull(person.deletedAt)))
        .returning();

      return !!deleted;
    });
  }

  async getRulesForPerson(personId: string): Promise<PersonRule[]> {
    const results = await this._db
      .select()
      .from(personRule)
      .where(and(eq(personRule.personId, personId), isNull(personRule.deletedAt)))
      .orderBy(desc(personRule.createdAt));

    return results.map((r) => this.mapPersonRule(r));
  }

  async getRulesForPeople(personIds: string[]): Promise<PersonRule[]> {
    if (personIds.length === 0) return [];

    const results = await this._db
      .select()
      .from(personRule)
      .where(and(inArray(personRule.personId, personIds), isNull(personRule.deletedAt)))
      .orderBy(desc(personRule.createdAt));

    return results.map((r) => this.mapPersonRule(r));
  }

  async getRule(id: string): Promise<PersonRule | null> {
    const [result] = await this._db
      .select()
      .from(personRule)
      .where(and(eq(personRule.id, id), isNull(personRule.deletedAt)))
      .limit(1);

    return result ? this.mapPersonRule(result) : null;
  }

  async findMatchingRule(input: {
    personId: string;
    kind: PersonRule["kind"];
    target: string;
    severity: PersonRule["severity"];
  }): Promise<PersonRule | null> {
    const [result] = await this._db
      .select()
      .from(personRule)
      .where(
        and(
          eq(personRule.personId, input.personId),
          eq(personRule.kind, input.kind),
          eq(personRule.target, input.target),
          eq(personRule.severity, input.severity),
          isNull(personRule.deletedAt)
        )
      )
      .limit(1);

    return result ? this.mapPersonRule(result) : null;
  }

  async createRule(
    data: Omit<PersonRule, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<PersonRule> {
    const existing = await this.findMatchingRule({
      personId: data.personId,
      kind: data.kind,
      target: data.target,
      severity: data.severity,
    });
    if (existing) return existing;

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
        treatCoconutAsTreeNut: data.treatCoconutAsTreeNut ?? false,
        label: data.label ?? null,
        note: data.note ?? null,
        activeFrom: data.activeFrom ?? null,
        activeUntil: data.activeUntil ?? null,
        setBy: data.setBy,
        createdBy: data.createdBy,
        createdByApiKeyId: data.createdByApiKeyId ?? null,
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

  async getPreferencesForPerson(personId: string, type?: string): Promise<Preference[]> {
    const conditions = [eq(preference.personId, personId), isNull(preference.deletedAt)];
    if (type) conditions.push(eq(preference.type, type));

    const results = await this._db
      .select()
      .from(preference)
      .where(and(...conditions))
      .orderBy(desc(preference.createdAt));

    return results.map((row) => this.mapPreference(row));
  }

  async getPreferencesForPeople(personIds: string[], type?: string): Promise<Preference[]> {
    if (personIds.length === 0) return [];

    const conditions = [inArray(preference.personId, personIds), isNull(preference.deletedAt)];
    if (type) conditions.push(eq(preference.type, type));

    const results = await this._db
      .select()
      .from(preference)
      .where(and(...conditions))
      .orderBy(desc(preference.createdAt));

    return results.map((row) => this.mapPreference(row));
  }

  async getPreference(id: string): Promise<Preference | null> {
    const [result] = await this._db
      .select()
      .from(preference)
      .where(and(eq(preference.id, id), isNull(preference.deletedAt)))
      .limit(1);

    return result ? this.mapPreference(result) : null;
  }

  async createPreference(
    data: Omit<Preference, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Preference> {
    const value = data.value.trim();
    if (!value) {
      throw new Error("A preference needs a value. Type a food, cuisine, or style.");
    }

    const [created] = await this._db
      .insert(preference)
      .values({
        personId: data.personId,
        type: data.type,
        value,
        weight: data.weight ?? 1,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create preference");
    return this.mapPreference(created);
  }

  async deletePreference(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(preference)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(preference.id, id), isNull(preference.deletedAt)))
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
      sortOrder: row.sortOrder ?? 0,
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
      treatCoconutAsTreeNut: row.treatCoconutAsTreeNut ?? false,
      label: row.label ?? null,
      note: row.note ?? null,
      activeFrom: row.activeFrom ?? null,
      activeUntil: row.activeUntil ?? null,
      setBy: row.setBy,
      createdByApiKeyId: row.createdByApiKeyId ?? null,
    };
  }

  private mapPreference(row: typeof preference.$inferSelect): Preference {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      personId: row.personId,
      type: row.type,
      value: row.value,
      weight: row.weight ?? 1,
    };
  }
}
