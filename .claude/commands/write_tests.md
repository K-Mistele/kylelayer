# write_tests.md - Bun Monorepo Testing Guide

You are tasked with writing tests for the referenced feature, code defined by an implementation plan, or referenced file(s) in this Bun monorepo.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature idea, description, context, or rough specification was provided as a parameter, begin the discovery process with that context
   - If files are referenced, read them FULLY first to understand existing context
   - If no parameters provided, respond with the default prompt below

2. IMPORTANT: **If no parameters provided**, respond with:
```
I'm ready to help you define and write tests. Please provide a feature, implementation plan, file path(s) or directory, and I will analyze it thoroughly by exploring the codebase and proceed to write tests for it.

What feature or capability are you considering? This could be:
- A rough idea ("users need better ways to...")
- A specific feature request ("add support for...")
- A problem you've observed ("customers are struggling with...")
- A business opportunity ("we could provide value by...")

Don't worry about having all the details - we'll explore, refine, and create comprehensive specifications together!

Tip: You can also invoke this command with context: `/write_tests 09-example-feature`
```

Then wait for the user's input.

## Core Testing Principles


### 1. NEVER Mock What You're Testing
- **DON'T** mock core functionality you're testing
- **DON'T** create fake implementations of the actual code under test
- **DON'T** duplicate existing code in the codebase. Import and use actual implementations.
- **DO** test the actual implementation that the application uses
- **DO** use real connections and real flows where possible

### 2. Write Integration Tests, Not Unit Tests
- Test the complete flow as users experience it
- Test actual functions and modules from your packages
- Don't test "layers" - test features and functionality

### 3. One Test File Per Feature
- Name test files after the feature, not the implementation detail
- Place tests in `packages/[package-name]/test/` or create a `test/` directory in the package
- All test files should end with `.test.ts`
- Don't create separate test files for every module - group related functionality

## Test Setup

### Basic Test Setup
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

// Import from your actual packages
import { someModule } from '../src/index'
import { DatabaseClient } from '../src/database'  // if using database

// Track resources for cleanup if needed
const createdResources = {
    // Adapt to your actual data types and resources
    testData: new Set<string>(),
    tempFiles: new Set<string>()
}
```

### Database Setup (if using database)
```typescript
// Use Bun's native database tools
import { Database } from 'bun:sqlite'  // for SQLite
// OR
// import { sql } from 'database-package'  // for other databases

// Example with bun:sqlite
const testDb = new Database(':memory:')  // In-memory test database

beforeAll(async () => {
    // Set up test database schema
    testDb.exec(`
        CREATE TABLE IF NOT EXISTS test_table (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)
})

afterAll(async () => {
    testDb.close()
})
```

## Testing Package Functions

### Test Actual Functions
```typescript
import { someFunction } from '../src/myModule'

test('should process data correctly', async () => {
    // Test the actual function from your package
    const result = await someFunction('test-input')
    
    expect(result).toEqual({
        processed: true,
        value: 'test-input'
    })
})
```

### Testing with Context/State
For functions that require specific context or state:

```typescript
import { MyClass } from '../src/MyClass'

test('should handle state correctly', async () => {
    const instance = new MyClass({ config: 'test' })
    
    const result = await instance.process('data')
    
    expect(result.status).toBe('success')
    expect(instance.getState()).toEqual({ processed: 1 })
})
```

## Test Structure

### Good Test File Structure
```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { MyService } from '../src/MyService'
import { Database } from 'bun:sqlite'

describe('Feature: Data Management', () => {
    // Track created resources for cleanup
    const createdResources = {
        tempFiles: new Set<string>(),
        testData: new Set<string>()
    }
    
    let service: MyService
    let testDb: Database
    
    beforeAll(async () => {
        // Set up test environment
        testDb = new Database(':memory:')
        service = new MyService({ database: testDb })
        
        // Create test schema
        testDb.exec(`
            CREATE TABLE items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `)
    })
    
    afterAll(async () => {
        // Clean up resources
        testDb.close()
        
        // Clean up any temp files
        for (const file of createdResources.tempFiles) {
            await Bun.file(file).unlink().catch(() => {})
        }
    })
    
    test('complete user flow for data operations', async () => {
        // Test the actual flow a user would experience
        const result = await service.createItem('test-item')
        createdResources.testData.add(result.id)
        
        expect(result.name).toBe('test-item')
        expect(result.id).toBeDefined()
        
        // Verify in database
        const retrieved = await service.getItem(result.id)
        expect(retrieved).toEqual(result)
    })
})
```

## What NOT to Do

### Bad Example - Mocking Everything
```typescript
// DON'T DO THIS - Mock the actual functionality you're testing
const mockService = {
    process: jest.fn().mockResolvedValue({ result: 'fake' }),
    save: jest.fn().mockResolvedValue(true)
}

// DON'T DO THIS - Avoid overmocking
const mockDatabase = {
    query: jest.fn().mockResolvedValue([])
}
```

### Bad Example - Testing Implementation Details
```typescript
// DON'T DO THIS - Testing internal validation separately
describe('Input Schema Validation', () => {
    test('should validate input length', () => {
        // This tests the validation library, not your application logic
        const isValid = inputSchema.safeParse('test')
        expect(isValid.success).toBe(true)
    })
})
```

### Bad Example - Too Many Separate Test Files
```typescript
// DON'T create these separate files for one feature:
// - database-operations.test.ts
// - validation.test.ts  
// - utils.test.ts
// - api-layer.test.ts

// DO create one file per logical feature:
// - user-management.test.ts (tests the complete user feature)
```

### Bad Example - Not Cleaning Up Resources
```typescript
// DON'T DO THIS - Create resources without cleanup
test('should create item', async () => {
    const tempFile = '/tmp/test-file.txt'
    await Bun.write(tempFile, 'test data')
    // File is never cleaned up!
})

// DO THIS INSTEAD - Track and clean up
const createdResources = { tempFiles: new Set<string>() }

test('should create item', async () => {
    const tempFile = '/tmp/test-file.txt'
    await Bun.write(tempFile, 'test data')
    createdResources.tempFiles.add(tempFile)  // Track it!
})

afterAll(async () => {
    for (const file of createdResources.tempFiles) {
        await Bun.file(file).unlink().catch(() => {})
    }
})
```

## Test Utilities

### CRITICAL: Resource Tracking Pattern
```typescript
// ALWAYS use this pattern for resource tracking
const createdResources = {
    organizations: new Set<string>(),  // Use Sets to avoid duplicates
    servers: new Set<string>(),
    walkthroughs: new Set<string>(),
    // ... etc
}

// When creating resources:
const [server] = await createMcpServerAction({...})
if (server) createdResources.servers.add(server.id)  // ALWAYS TRACK!

// When creating multiple resources:
const results = await Promise.all([...])
results.forEach(([error, data]) => {
    if (data) createdResources.walkthroughs.add(data.id)  // TRACK EACH ONE!
})
```

### Database Cleanup Helper
```typescript
async function cleanupTestResources(resources: Record<string, Set<string>>) {
    // Clean up in reverse order to respect FK constraints
    const cleanupOrder = [
        { table: 'mcpServerWalkthroughs', field: 'mcpServerId', resourceKey: 'servers' },
        { table: 'walkthroughSteps', field: 'id', resourceKey: 'steps' },
        { table: 'walkthroughs', field: 'id', resourceKey: 'walkthroughs' },
        { table: 'mcpServers', field: 'id', resourceKey: 'servers' },
        { table: 'session', field: 'id', resourceKey: 'sessions' },
        { table: 'user', field: 'id', resourceKey: 'users' },
        { table: 'organization', field: 'id', resourceKey: 'organizations' }
    ]
    
    for (const { table, field, resourceKey } of cleanupOrder) {
        const resourceIds = resources[resourceKey] || new Set()
        for (const id of resourceIds) {
            try {
                await db.delete(schema[table])
                    .where(eq(schema[table][field], id))
            } catch (err) {
                // Resource might already be deleted by cascade
            }
        }
    }
}
```

### Creating Test Context
```typescript
async function createTestContext() {
    const org = await db.insert(schema.organization).values({
        id: `org_${nanoid(8)}`,
        name: 'Test Org',
        slug: `test-${nanoid(8)}`,
        createdAt: new Date()
    }).returning()
    
    // Return real IDs that can be used in tests
    return { organizationId: org[0].id }
}
```

## Running Tests

```bash
# Run all tests
bun test

# Run tests with timeout
bun test --timeout 15000

# Run specific test file
bun test packages/mypackage/test/feature.test.ts

# Run tests in a specific package
bun test --filter mypackage

# Run tests with coverage
bun test --coverage
```

### Helpful references for bun:test
- [`bun:test`](https://bun.com/docs/cli/test.md): Bun's test runner uses Jest-compatible syntax but runs 100x faster.
- [Writing tests](https://bun.com/docs/test/writing.md): Write your tests using Jest-like expect matchers, plus setup/teardown hooks, snapshot testing, and more
- [Watch mode](https://bun.com/docs/test/hot.md): Reload your tests automatically on change.
- [Lifecycle hooks](https://bun.com/docs/test/lifecycle.md): Add lifecycle hooks to your tests that run before/after each test or test run
- [Mocks](https://bun.com/docs/test/mocks.md): Mocks functions and track method calls
- [Snapshots](https://bun.com/docs/test/snapshots.md): Add lifecycle hooks to your tests that run before/after each test or test run
- [Dates and times](https://bun.com/docs/test/time.md): Control the date & time in your tests for more reliable and deterministic tests
- [Code coverage](https://bun.com/docs/test/coverage.md): Generate code coverage reports with `bun test --coverage`
- [Test reporters](https://bun.com/docs/test/reporters.md): Add a junit reporter to your test runs
- [Test configuration](https://bun.com/docs/test/configuration.md): Configure the test runner with bunfig.toml
- [Runtime behavior](https://bun.com/docs/test/runtime-behavior.md): Learn how the test runner affects Bun's runtime behavior
- [Finding tests](https://bun.com/docs/test/discovery.md): Learn how the test runner discovers tests
- [DOM testing](https://bun.com/docs/test/dom.md): Write headless tests for UI and React/Vue/Svelte/Lit components with happy-dom

### Supported Matchers:
*   `.not`
*   `.toBe()`
*   `.toEqual()`
*   `.toBeNull()`
*   `.toBeUndefined()`
*   `.toBeNaN()`
*   `.toBeDefined()`
*   `.toBeFalsy()`
*   `.toBeTruthy()`
*   `.toContain()`
*   `.toContainAllKeys()`
*   `.toContainValue()`
*   `.toContainValues()`
*   `.toContainAllValues()`
*   `.toContainAnyValues()`
*   `.toStrictEqual()`
*   `.toThrow()`
*   `.toHaveLength()`
*   `.toHaveProperty()`
*   `.extend`
*   `.anything()`
*   `.any()`
*   `.arrayContaining()`
*   `.assertions()`
*   `.closeTo()`
*   `.hasAssertions()`
*   `.objectContaining()`
*   `.stringContaining()`
*   `.stringMatching()`
*   `.resolves()`
*   `.rejects()`
*   `.toHaveBeenCalled()`
*   `.toHaveBeenCalledTimes()`
*   `.toHaveBeenCalledWith()`
*   `.toHaveBeenLastCalledWith()`
*   `.toHaveBeenNthCalledWith()`
*   `.toHaveReturned()`
*   `.toHaveReturnedTimes()`
*   `.toBeCloseTo()`
*   `.toBeGreaterThan()`
*   `.toBeGreaterThanOrEqual()`
*   `.toBeLessThan()`
*   `.toBeLessThanOrEqual()`
*   `.toBeInstanceOf()`
*   `.toContainEqual()`
*   `.toMatch()`
*   `.toMatchObject()`
*   `.toMatchSnapshot()`
*   `.toMatchInlineSnapshot()`
*   `.toThrowErrorMatchingSnapshot()`
*   `.toThrowErrorMatchingInlineSnapshot()`

## Key Reminders

1. **Test what the app actually uses** - Test actual functions and modules from your packages
2. **Use real implementations** - Avoid excessive mocking of your own code
3. **TRACK EVERY RESOURCE** - Use Sets to track created resources for cleanup
4. **CLEAN UP WHAT YOU CREATE** - Clean up temp files, test databases, etc.
5. **Test user flows** - Not individual technical implementation details
6. **One test file per feature** - Group related functionality together
7. **Use Bun's native tools** - Leverage bun:sqlite, Bun.file, etc. when possible
8. **Test error cases** - Include both happy path and error scenarios
9. **Keep tests fast** - Use in-memory databases and minimal setup

## Example: Complete Feature Test

```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { DataManager } from '../src/DataManager'

describe('Data Management Operations', () => {
    // Track created resources for cleanup
    const createdResources = {
        tempFiles: new Set<string>(),
        testData: new Set<string>()
    }
    
    let testDb: Database
    let dataManager: DataManager
    
    beforeAll(async () => {
        // Set up test environment
        testDb = new Database(':memory:')
        testDb.exec(`
            CREATE TABLE items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `)
        
        dataManager = new DataManager({ database: testDb })
    })
    
    test('should handle complete item lifecycle', async () => {
        // Create
        const item = await dataManager.createItem({
            title: 'Test Item',
            status: 'draft'
        })
        
        expect(item).toBeDefined()
        expect(item.title).toBe('Test Item')
        expect(item.status).toBe('draft')
        createdResources.testData.add(item.id)  // Track it!
        
        // Update
        const updated = await dataManager.updateItem(item.id, {
            title: 'Updated Test Item',
            status: 'published'
        })
        
        expect(updated.title).toBe('Updated Test Item')
        expect(updated.status).toBe('published')
        
        // Verify in database
        const retrieved = await dataManager.getItem(item.id)
        expect(retrieved.title).toBe('Updated Test Item')
        expect(retrieved.status).toBe('published')
        
        // Delete
        await dataManager.deleteItem(item.id)
        
        // Verify deletion
        const deleted = await dataManager.getItem(item.id)
        expect(deleted).toBeNull()
    })
    
    afterAll(async () => {
        // Clean up resources
        testDb.close()
        
        // Clean up any temp files created during tests
        for (const file of createdResources.tempFiles) {
            await Bun.file(file).unlink().catch(() => {})
        }
    })
})
```

Remember: **Test the real thing, not a mock of the thing. Track every resource you create. Clean up what you created.**