## JOIN Formatting

### Join Clarity
Each JOIN should be clearly visible:
```sql
FROM orders o
INNER JOIN users u ON o.user_id = u.id
LEFT JOIN payments p ON o.id = p.order_id
```

### Complex Join Conditions
For multiple join conditions, align for readability:
```sql
LEFT JOIN products p
  ON o.product_id = p.id
  AND p.status = 'active'
```

## WHERE Clause Organization

### Multiple Conditions
Align AND/OR for clarity:
```sql
WHERE status = 'active'
  AND created_at > '2024-01-01'
  AND (role = 'admin' OR role = 'moderator')
```

### Logical Grouping
Group related conditions with parentheses and consistent formatting.

## Subquery Formatting

Indent subqueries to show nesting:
```sql
SELECT *
FROM users
WHERE id IN (
  SELECT user_id
  FROM orders
  WHERE total > 100
)
```

## Team Conventions

### Establishing Standards
- Document formatting rules
- Use automated formatters
- Include in code review checklist
- Configure IDE/editor settings

### Consistency Over Preference
Individual preferences matter less than team consistency. Choose a standard and apply it universally.

## Related Tools

SQL formatting often combines with:
- [JSON formatting](/tools/json-formatter) for API data
- [Diff checking](/tools/diff-checker) for comparing query versions
- [CSS minification](/tools/css-minifier) for related formatting tasks

## SQL Dialects

Different databases have variations:
- MySQL, PostgreSQL, SQLite, SQL Server
- Formatting conventions remain similar
- Keyword differences may exist

Our tool uses common formatting that works across most dialects.

## Limitations

Our formatter:
- Provides basic formatting
- May not handle all dialect-specific syntax
- Complex queries may need manual adjustment
- Does not validate SQL syntax

## When to Skip Formatting

Some contexts prefer compact SQL:
- Simple one-line queries
- Programmatically generated SQL
- Stored procedures with specific formatting

## Summary

Consistent SQL formatting improves readability and maintainability. Establish team conventions, use automated formatters for consistency, and prioritize clarity over personal preference. Well-formatted SQL makes debugging faster and code reviews more effective.
