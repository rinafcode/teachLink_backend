export class CreateSchemaVersionDto {
  /** Logical name of the schema (e.g., 'courses') */
  schemaName: string;

  /** Full JSON definition of the current schema */
  definition: Record<string, any>;

  /** Optional human readable description of the change */
  description?: string;

  /** Optional author identifier */
  authorId?: string;
}
