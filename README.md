
# Jira Utils

TypeScript utilities for Jira API with auto-generated type literals from your Jira instance.

## Installation

```bash
npm install git+https://github.com/ehksz/jira-utils.git
```

## Setup

### 1. Create Configuration File

Create `jira.config.json` in your project root:

```json
{
  "host": "your-domain.atlassian.net",
  "email": "your-email@company.com",
  "apiToken": "your-api-token",
  "projectKeys": ["PROJ1", "PROJ2"],
  "specialProjectKeys": ["SPECIAL-123", "SPECIAL-456"],
  "internalProjectKeys": ["INTERNAL1", "INTERNAL2"]
}
```

> 🔒 Add `jira.config.json` to `.gitignore`

### 2. Generate Types

```bash
npx jira-generate-types
```

This fetches your Jira data and generates strongly-typed literals for statuses, projects, priorities, issue types, labels, and users.

## Usage

```typescript
import { getAllClientIssues, getAllInternalIssues, getSpecialIssues } from 'jira-utils'
import type { StatusName, ProjectKey, PriorityName } from 'jira-utils'

// Fetch client issues
const clientIssues = await getAllClientIssues({
  host: 'your-domain.atlassian.net',
  email: 'your-email@company.com',
  apiToken: 'your-api-token',
  projectKeys: ['PROJ1', 'PROJ2'],
  batchSize: 50,
  delayMs: 1000,
  highestNumber: 15
})

// Fetch internal issues
const internalIssues = await getAllInternalIssues({
  host: 'your-domain.atlassian.net',
  email: 'your-email@company.com',
  apiToken: 'your-api-token',
  projectKeys: ['INTERNAL1'],
  batchSize: 50,
  delayMs: 1000
})

// Fetch special issues by key
const specialIssues = await getSpecialIssues({
  host: 'your-domain.atlassian.net',
  email: 'your-email@company.com',
  apiToken: 'your-api-token',
  projectKeys: ['SPECIAL-123', 'SPECIAL-456'],
  batchSize: 50,
  delayMs: 1000
})
```

### Generated Types

After running `npx jira-generate-types`, you get autocomplete for:

```typescript
import type {
  StatusName,              // "To Do" | "In Progress" | "Done"
  ProjectKey,              // "PROJ1" | "PROJ2"
  PriorityName,            // "High" | "Medium" | "Low"
  IssueTypeName,           // "Bug" | "Story" | "Task"
  Label,                   // All labels from your Jira
  AssigneeDisplayName,     // All assignee names
  AssigneeAccountId,       // All assignee IDs
} from 'jira-utils'
```

### Field Transformation

Issues are automatically transformed from Jira's custom fields to readable names:

```typescript
// Raw: customfield_12001 → Standardized: requirementId
// Raw: customfield_12108 → Standardized: skillsNotes
// Raw: customfield_12221 → Standardized: account
```

Use `standardizeJiraIssue()` and `destandardizeJiraIssue()` from `'jira-utils'` for manual conversion.

## API

### `getAllClientIssues(options)`
Fetches client project issues and issues assigned to current user.

### `getAllInternalIssues(options)`
Fetches all internal project issues.

### `getSpecialIssues(options)`
Fetches specific issues by key.

### `fetchAllJiraIssues(options)`
Low-level function for custom JQL queries with pagination.

## Updating Types

When Jira configuration changes:

```bash
npx jira-generate-types
```

## License

MIT © Xavier Viera
