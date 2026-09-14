import { mysqlTable, int, text, timestamp } from 'drizzle-orm/mysql-core'

export const todos = mysqlTable('todos', {
  id: int().primaryKey().autoincrement(),
  title: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
})
