# Debug

You are tasked with helping debug issues during manual testing or implementation. This command allows you to investigate problems by examining logs, application state, and git history without editing files. Think of this as a way to bootstrap a debugging session without using the primary window's context.

## Initial Response

When invoked WITH a plan/ticket file:
```
I'll help debug issues with [file name]. Let me understand the current state.

What specific problem are you encountering?
- What were you trying to test/implement?
- What went wrong?
- Any error messages?

I'll investigate the logs, application state, and git state to help figure out what's happening.
```

When invoked WITHOUT parameters:
```
I'll help debug your current issue.

Please describe what's going wrong:
- What are you working on?
- What specific problem occurred?
- When did it last work?

I can investigate logs, application state, and recent changes to help identify the issue.
```

## Environment Information

You have access to these key locations and tools:

**Logs** (Bun application logs):
- Bun development server output
- Package-specific service logs from monorepo packages
- Browser console logs for web packages
- Test output from `bun test`

**Database**:
- Check package.json dependencies to understand database setup
- May use bun:sqlite, Bun.sql (Postgres), or other Bun-native database tools
- Database location depends on package configuration

**Git State**:
- Check current branch, recent commits, uncommitted changes
- Main branch: `master`

**Service Status**:
- Check Bun processes: `ps aux | grep bun`
- Check if specific package services are running
- Use `lsof` to check port usage
- Development servers typically run on various ports per package

## Process Steps

### Step 1: Understand the Problem

After the user describes the issue:

1. **Read any provided context** (plan or ticket file):
   - Understand what they're implementing/testing
   - Note which phase or step they're on
   - Identify expected vs actual behavior

2. **Quick state check**:
   - Current git branch and recent commits
   - Any uncommitted changes
   - When the issue started occurring

### Step 2: Investigate the Issue

Spawn parallel Task agents for efficient investigation:

```
Task 1 - Check Application State:
Analyze the running application and logs:
1. Check Bun development servers and their output
2. Look for package-specific service errors 
3. Check for TypeScript compilation errors
4. If web packages exist, check browser console for client-side errors
5. Look for build or bundling errors from Bun
Return: Key errors/warnings with context
```

```
Task 2 - Package and Dependencies State:
Check the monorepo package state:
1. Verify package.json dependencies are installed: `bun install`
2. Check if packages can build: `bun run build` (if build script exists)
3. Look for workspace dependency conflicts
4. Check package-specific configuration files
5. Verify inter-package dependencies are correct
Return: Package and dependency findings
```

```
Task 3 - Git and File State:
Understand what changed recently:
1. Check git status and current branch
2. Look at recent commits: git log --oneline -10
3. Check uncommitted changes: git diff
4. Verify package structure and files exist
5. Check for TypeScript errors: `bun run typecheck` (if available)
Return: Git state and any file issues
```

### Step 3: Present Findings

Based on the investigation, present a focused debug report:

```markdown
## Debug Report

### What's Wrong
[Clear statement of the issue based on evidence]

### Evidence Found

**From Application State**:
- [Error/warning from Bun console]
- [Client-side errors if web packages]
- [Build or bundling failures]

**From Package State**:
- [Dependency issues or conflicts]
- [Workspace configuration problems]
- [Inter-package dependency issues]

**From Git/Files**:
- [Recent changes that might be related]
- [TypeScript or build errors]

### Root Cause
[Most likely explanation based on evidence]

### Next Steps

1. **Try This First**:
   ```bash
   [Specific command or action]
   ```

2. **If That Doesn't Work**:
   - Reinstall dependencies: `bun install`
   - Clear Bun cache if needed
   - Check for TypeScript errors: `bun run typecheck`
   - Rebuild packages: `bun run build` (if available)
   - Check package-specific dev servers and ports

### Can't Access?
Some issues might be outside my reach:
- Browser console errors (F12 in browser)
- External service integrations
- Package-specific configuration issues requiring domain knowledge

Would you like me to investigate something specific further?
```

## Important Notes

- **Focus on manual testing scenarios** - This is for debugging during implementation
- **Always require problem description** - Can't debug without knowing what's wrong
- **Read files completely** - No limit/offset when reading context
- **Understand monorepo structure** - Packages may have different purposes and dependencies
- **No file editing** - Pure investigation only
- **Check package-specific scripts** - Each package may have different dev/build commands

## Quick Reference

**Check Application State**:
```bash
# Check running Bun processes
ps aux | grep bun

# Check specific package development servers
# Port numbers vary by package configuration
```

**Package Health**:
```bash
# Install/check dependencies
bun install

# Check workspace status
bun run --filter="*" typecheck  # if available

# Build all packages
bun run --filter="*" build      # if available
```

**Service Check**:
```bash
ps aux | grep bun           # Is Bun running?
lsof -i                     # What ports are in use?
```

**Git State**:
```bash
git status
git log --oneline -10
git diff
```

**Common Issues**:
- Dependency conflicts: Check workspace dependencies and versions
- Build errors: Check TypeScript configuration and compilation
- Service startup: Verify package scripts and configuration
- Port conflicts: Check if multiple services compete for same port

Remember: This command helps you investigate without burning the primary window's context. Perfect for when you hit an issue during manual testing and need to dig into logs, database, or application state.