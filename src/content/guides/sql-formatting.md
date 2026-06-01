# SQL Formatting: Readability Rules and Team Conventions

Well-formatted SQL improves code readability, simplifies debugging, and makes collaboration easier. Establishing consistent formatting conventions helps teams work effectively with database queries.

## Why SQL Formatting Matters

Raw SQL queries can be difficult to parse:
```sql
SELECT u.id,u.name,u.email,o.order_id,o.total FROM users u LEFT JOIN orders o ON u.id=o.user_id WHERE u.status='active' AND o.created_at>'2024-01-01' ORDER BY o.created_at DESC
```

Formatted, the same query becomes readable:
```sql
SELECT
  u.id,
  u.name,
  u.email,
  o.order_id,
  o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC
```

## Core Formatting Rules

### Keyword Capitalization
SQL keywords in UPPERCASE distinguishes them from table and column names:
- `SELECT`, `FROM`, `WHERE`, `JOIN`, `ORDER BY`

This is a convention, not a requirement. Consistency matters most.

### Line Breaks
Place major clauses on new lines:
- `SELECT`
- `FROM`
- `WHERE`
- `GROUP BY`
- `ORDER BY`
- `LIMIT`

### Indentation
Indent continued content:
- Column lists after SELECT
- Conditions after WHERE
- Join conditions

Our [SQL Formatter](/tools/sql-formatter) applies these rules automatically.

## Column Handling

### Multiple Columns
List each column on its own line for complex queries:
```sql
SELECT
  user_id,
  first_name,
  last_name,
  email,
  created_at
FROM users
```

### Select All
Use `SELECT *` sparingly in production code. Explicit column lists are clearer and more maintainable.
