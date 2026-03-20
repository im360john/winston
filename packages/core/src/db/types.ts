/**
 * Shared database type helpers.
 *
 * postgres.js v3 types have a known structural mismatch: TransactionSql
 * (passed inside sql.begin() callbacks) extends Omit<Sql, ...> which loses
 * some methods present on Sql, and TypeScript's Omit loses call signatures.
 *
 * We define SqlContext as a minimal interface satisfied by both Sql and
 * TransactionSql. Repositories only need the tagged-template call — they
 * never call `begin()`, `end()`, or other top-level methods.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlContext = (template: TemplateStringsArray, ...values: any[]) => Promise<any[]>;
