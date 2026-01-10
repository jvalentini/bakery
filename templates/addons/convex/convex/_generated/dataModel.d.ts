/**
 * Stub type declarations for Convex data model.
 * Replaced by `convex dev` with schema-specific types.
 */

export type Id<TableName extends string> = string & { __tableName: TableName }

export type Doc<TableName extends string> = {
  _id: Id<TableName>
  _creationTime: number
  [key: string]: unknown
}

export type DataModel = Record<string, unknown>
