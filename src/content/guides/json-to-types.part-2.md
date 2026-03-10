## Limitations of Sample-Based Inference

### Optional Properties
A single sample can't indicate which properties are optional:
```typescript
// Generated (all required)
interface User {
  id: number;
  name: string;
  nickname: string;  // Actually optional!
}

// May need manual adjustment
interface User {
  id: number;
  name: string;
  nickname?: string;
}
```

### Union Types
Single samples miss type variations:
```typescript
// Sample shows: { status: "active" }
// But status could also be "inactive" or "pending"

// Generated:
status: string;

// Better:
status: "active" | "inactive" | "pending";
```

### Array Element Variations
If array elements vary, the sample may not capture all possibilities.

## Best Practices

### Use Representative Samples
Include samples with:
- All possible fields
- Various data scenarios
- Edge cases

### Review and Adjust
Always review generated types:
- Add optional markers
- Refine union types
- Add documentation comments

### Multiple Samples
Compare types from multiple samples to catch variations.

## When to Use Generated Types

### Good Uses
- Starting point for new integrations
- Quick prototyping
- Understanding API shapes
- Documentation generation

### Not Recommended
- Final production types without review
- Security-critical data structures
- Complex business logic types

## Related Tools

Type generation connects to:
- [JSON formatting](/tools/json-formatter) for preparing samples
- [Regex testing](/tools/regex-tester) for validation patterns
- [Diff checking](/tools/diff-checker) for comparing type versions

## Alternative Approaches

### OpenAPI/Swagger
For documented APIs, generate types from OpenAPI specs instead.

### GraphQL Codegen
GraphQL schemas provide more accurate type generation.

### io-ts / Zod
Runtime validation libraries that generate types from schemas.

## Manual Enhancement

After generation, consider adding:
```typescript
interface User {
  /** Unique user identifier */
  id: number;
  /** User's display name */
  name: string;
  /** Account status - affects access permissions */
  status: "active" | "inactive" | "pending";
  /** Optional profile picture URL */
  avatarUrl?: string;
}
```

## Limitations

Our tool:
- Infers from single sample only
- Cannot detect optional properties
- Uses simple type inference
- May need manual refinement

## Summary

JSON to TypeScript generation provides a quick starting point for type definitions. Understand its limitations: optional properties aren't detected, union types aren't inferred, and samples may not represent all data variations. Use generated types as a foundation, then review and enhance for production use.
