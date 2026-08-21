# CouchDB Connection Management Rule

## Purpose

This rule defines how CouchDB connections must be managed inside the NestJS application.

The application must use the centralized `CouchDbService` as the single source of truth for CouchDB connections.

Creating new CouchDB connections inside repositories, modules, or other services is not allowed.

---

## Rule

Do not create new CouchDB connections outside `CouchDbService`.

---

## Prohibited Pattern

```ts
private couch!: nano.ServerScope;
private db!: nano.DocumentScope<MyDocument>;

onModuleInit() {
this.couch = nano(this.config.url);
this.db = this.couch.use(this.config.database);
}
```

The above pattern creates a separate CouchDB connection and bypasses the existing connection management layer.

---

## Required Pattern

Repositories and services must receive `CouchDbService` through dependency injection and use the existing database instance.

Example:

```ts
constructor(
private readonly couchDbService: CouchDbService,
) {}

private get db() {
return this.couchDbService.getDatabase();
}
```

---

## Reason

Using multiple CouchDB connections can lead to:

- duplicated connection management
- inconsistent configuration handling
- unnecessary resource usage
- harder testing and mocking
- architectural inconsistency

---

## Architecture Principle

`CouchDbService` owns:

- CouchDB client initialization
- connection configuration
- database selection
- future connection lifecycle management

Repositories are only responsible for data access logic and must not manage CouchDB connections.

---

## Scope

This rule applies to:

- repositories
- application services
- background jobs
- scheduled tasks
- modules
- any new CouchDB-related integration

Any exception requires an explicit architectural decision.
