## Rule: Use Type Guards Instead of Type Assertions

When working with union document types (e.g. `IamDocument`) in NestJS and TypeScript:

- Always use Type Guards to narrow document types.
- Avoid using type assertions (`as SomeDocument`) whenever possible.
- Repository implementations must validate the document discriminator (`type`) before returning a specific document type.
- Keep the database layer generic (`DocumentScope<IamDocument>`). Do not make the shared database connection generic for individual document types.
- Place reusable Type Guards in a dedicated file (e.g. `document.guards.ts`) and reuse them across repositories.

### ✅ Good

```ts
const document = await this.db.get(id);

if (!isSessionDocument(document)) {
  return null;
}

return document;
```

### ❌ Avoid

```ts
const document = await this.db.get(id);

return document as SessionDocument;
```

### Rationale

- Improves type safety.
- Eliminates unsafe type assertions.
- Makes repositories easier to maintain.
- Keeps the infrastructure layer generic while allowing repositories to safely narrow document types.
- Scales well as new document types are added.