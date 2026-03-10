# Turning JSON Samples Into Types: A Practical Approach

TypeScript interfaces provide type safety for JSON data. Generating types from sample JSON accelerates development, but understanding the limitations ensures you get useful, accurate types.

## Why Generate Types from JSON?

### API Integration
When working with external APIs, sample responses help create type definitions quickly.

### Data Modeling
Sample data provides a starting point for defining data structures.

### Documentation
Types generated from examples serve as documentation for data shapes.

### Rapid Prototyping
Quickly create types during exploration and iteration.

## How Type Inference Works

Our [JSON to TypeScript](/tools/json-to-typescript) tool examines sample data and infers types:

```json
{
  "id": 1,
  "name": "John Doe",
  "isActive": true
}
```

Generates:
```typescript
interface Root {
  id: number;
  name: string;
  isActive: boolean;
}
```

## Type Inference Rules

### Primitive Types
- Numbers (integers and floats) → `number`
- Strings → `string`
- Booleans → `boolean`
- Null → `null`

### Complex Types
- Objects → Nested interfaces
- Arrays → Array types with element inference

### Nested Objects
Each nested object becomes its own interface:
```json
{
  "user": {
    "name": "John"
  }
}
```

Generates:
```typescript
interface User {
  name: string;
}

interface Root {
  user: User;
}
```
