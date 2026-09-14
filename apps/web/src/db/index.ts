import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from './schema.ts'

export const db = drizzle(process.env.DATABASE_URL!, {
  schema,
  mode: 'default',
})
