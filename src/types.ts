
import {
    StatusName,
    StatusId,
    StatusCategoryKey,
    StatusCategoryName,
    ProjectKey,
    ProjectName,
    PriorityName,
    PriorityId,
    IssueTypeName,
    ReporterDisplayName,
    ReporterEmailAddress,
    ReporterAccountId,
    AssigneeDisplayName,
    AssigneeEmailAddress,
    AssigneeAccountId,
    CreatorDisplayName,
    CreatorEmailAddress,
    CreatorAccountId,
    Label,
  } from "./literals.generated"

  import { FIELD_MAP } from "./constants";

  export interface JiraConfig {
    host: string,
    email: string,
    apiToken: string,
    projectKeys: string[]
    specialProjectKeys: string[]
    internalProjectKeys: string[]
    bitbucketToken: string
    workspace: string
  }

  export interface PaginatedPullRequests {
    values: BitbucketPullRequest[];
    next?: string;
  }

  export interface JiraClientOptions {
    host: string,
    email: string,
    apiToken: string,
    jqlQuery: string,
    batchSize: number,
    delayMs: number
  }
  export interface GetBitbucketRepoByJiraProjectOptions {
    username: string,
    apiToken: string,
    projectKey: string,
    workspace: string
  }

  export interface JiraClientIssuesOptions extends Omit<JiraClientOptions, 'jqlQuery'> {
    projectKeys: string[]
    highestNumber?: number
  }
  export interface JiraInternalIssuesOptions extends Omit<JiraClientOptions, 'jqlQuery'> {
    projectKeys: string[]
  }
  export interface JiraSpecialIssuesOptions extends Omit<JiraClientOptions, 'jqlQuery'> {
    projectKeys: string[]
  }

  export type FieldMapKeys = keyof typeof FIELD_MAP;
  export type FieldMapValues = (typeof FIELD_MAP)[FieldMapKeys];
  
  export interface JiraUser {
    self: string
    accountId: ReporterAccountId | AssigneeAccountId | CreatorAccountId
    emailAddress: ReporterEmailAddress | AssigneeEmailAddress | CreatorEmailAddress
    avatarUrls: Record<"16x16" | "24x24" | "32x32" | "48x48", string>
    displayName: ReporterDisplayName | AssigneeDisplayName | CreatorDisplayName
    active: boolean
    timeZone: string
    accountType: string
  }
  
  export interface JiraStatusCategory {
    self: string
    id: number
    key: StatusCategoryKey
    colorName: string
    name: StatusCategoryName
  }
  
  export interface JiraStatus {
    self: string
    description: string
    iconUrl: string
    name: StatusName
    id: StatusId
    statusCategory: JiraStatusCategory
  }
  
  export interface JiraPriority {
    self: string
    iconUrl: string
    name: PriorityName
    id: PriorityId
  }
  
  export interface JiraProjectCategory {
    self: string
    id: string
    description: string
    name: string
  }
  
  export interface JiraProject {
    self: string
    id: string
    key: ProjectKey
    name: ProjectName
    projectTypeKey: string
    simplified: boolean
    avatarUrls: Record<"16x16" | "24x24" | "32x32" | "48x48", string>
    projectCategory: JiraProjectCategory
  }
  
  export interface JiraIssueType {
    self: string
    id: string
    description: string
    iconUrl: string
    name: IssueTypeName
    subtask: boolean
    hierarchyLevel: number
  }
  
  export interface JiraCommentList {
    comments: JiraComment[]
    self: string
    maxResults: number
    total: number
    startAt: number
  }
  
  export interface JiraComment {
    self: string
    id: string
    author: JiraUser
    body: string
    updateAuthor: JiraUser
    created: string
    updated: string
    jsdPublic: boolean
  }
  
  export interface JiraProgress {
    progress: number
    total: number
  }
  
  export interface JiraVotes {
    self: string
    votes: number
    hasVoted: boolean
  }
  
  export interface JiraWatches {
    self: string
    watchCount: number
    isWatching: boolean
  }
  
  export interface JiraTimetracking {
    originalEstimate?: string
    remainingEstimate?: string
    timeSpent?: string
    originalEstimateSeconds?: number
    remainingEstimateSeconds?: number
    timeSpentSeconds?: number
  }
  
  export type JiraCustomFieldsRaw = {
    customfield_12001?: string | null
    customfield_12108?: string | null
    customfield_12221?: string | null
    customfield_12225?: string | null
    customfield_12235?: { languageCode: string; displayName: string } | null
    customfield_12236?: { self: string; id: string; value: string }[] | null
    customfield_12269?: { self: string; value: string; id: string } | null
    customfield_12273?: number | null
    customfield_12281?: string | null
    customfield_12285?: string | null
    customfield_11303?: string | null
    customfield_10001?: unknown[] | null
    customfield_10002?: string | null
  }
  
  export type JiraCustomFieldsStandardized = {
    requirementId?: string | null
    skillsNotes?: string | null
    account?: string | null
    approach?: string | null
    requestLanguage?: { languageCode: string; displayName: string } | null
    devices?: { self: string; id: string; value: string }[] | null
    overageCalculator?: { self: string; value: string; id: string } | null
    workRatioAutomation?: number | null
    acceptanceCriteria?: string | null
    productboardUrl?: string | null
    startDate?: string | null
    sprint?: unknown[] | null
    epicLink?: string | null
  }
  
  export interface JiraBaseFields {
    statuscategorychangedate: string
    fixVersions: unknown[]
    statusCategory: JiraStatusCategory
    resolution: unknown | null
    lastViewed: string | null
    priority: JiraPriority
    labels: Label[]
    aggregatetimeoriginalestimate: number | null
    timeestimate: number | null
    issuelinks: unknown[]
    assignee: JiraUser | null
    status: JiraStatus
    components: { name: string }[]
    aggregatetimeestimate: number | null
    creator: JiraUser
    subtasks: unknown[]
    reporter: JiraUser
    aggregateprogress: JiraProgress
    progress: JiraProgress
    votes: JiraVotes
    worklog: JiraCommentList
    issuetype: JiraIssueType
    timespent: number | null
    project: JiraProject
    aggregatetimespent: number | null
    resolutiondate: string | null
    workratio: number
    watches: JiraWatches
    created: string
    updated: string
    timeoriginalestimate: number | null
    description: string | null
    timetracking: JiraTimetracking
    security: unknown | null
    attachment: unknown[]
    summary: string
    environment: string | null
    duedate: string | null
    comment: JiraCommentList
  }
  
  export type JiraRawFields = JiraBaseFields & JiraCustomFieldsRaw
  export type JiraStandardizedFields = JiraBaseFields & JiraCustomFieldsStandardized
  
  export interface JiraRawIssue {
    expand?: string | undefined
    id: string
    self?: string
    key: string
    fields: JiraRawFields
    renderedFields: JiraRawFields
  }
  
  export interface JiraStandardizedIssue {
    expand: string
    id: string
    self: string
    key: string
    fields: JiraStandardizedFields
    renderedFields: JiraStandardizedFields
  }

export type IssueLike = JiraRawIssue | JiraStandardizedIssue
export type LiteralCollection = Record<string, Set<string>>
export type LiteralAggregates = Record<string, string[]>

// bitbucket types

export interface Link {
  href: string;
}

export interface Links {
  self: Link;
  avatar?: Link;
  html?: Link;
}

export interface CloneLink {
  name: string;
  href: string;
}

export interface RepositoryLinks extends Links {
  pullrequests: Link;
  commits: Link;
  forks: Link;
  watchers: Link;
  branches: Link;
  tags: Link;
  downloads: Link;
  source: Link;
  clone: CloneLink[];
  hooks: Link;
}

export interface Owner {
  display_name: string;
  links: Links & {
    html: Link;
  };
  type: string;
  uuid: string;
  username: string;
}

export interface Workspace {
  type: string;
  uuid: string;
  name: string;
  slug: string;
  links: Links & {
    html: Link;
  };
}
  
export interface Project {
  type: string;
  key: string;
  uuid: string;
  name: string;
  links: Links & {
    html: Link;
  };
}

export interface MainBranch {
  name: string;
  type: string;
}

export interface OverrideSettings {
  default_merge_strategy: boolean;
  branching_model: boolean;
}

export interface BitbucketRepository {
  type: string;
  full_name: string;
  links: RepositoryLinks;
  name: string;
  slug: string;
  description: string;
  scm: string;
  website: string | null;
  owner: Owner;
  workspace: Workspace;
  is_private: boolean;
  project: Project;
  fork_policy: string;
  created_on: string;
  updated_on: string;
  size: number;
  language: string;
  uuid: string;
  mainbranch: MainBranch;
  override_settings: OverrideSettings;
  parent: any | null;
  enforced_signed_commits: boolean | null;
  has_issues: boolean;
  has_wiki: boolean;
}

export interface GetPullRequestsByIssueKeyOptions {
  username: string,
  apiToken: string,
  issueKey: string,
  workspace: string
}


interface User {
  display_name: string;
  links: Links;
  type: "user";
  uuid: string;
  account_id: string;
  nickname: string;
}

interface Commit {
  hash: string;
  links: Links;
  type: "commit";
}

interface Branch {
  name: string;
  links?: Record<string, never>;
}

interface Repository {
  type: "repository";
  full_name: string;
  links: Links;
  name: string;
  uuid: string;
}

interface BranchSource {
  branch: Branch;
  commit: Commit;
  repository: Repository;
}

interface Summary {
  type: "rendered";
  raw: string;
  markup: "markdown";
  html: string;
}

interface PullRequestLinks {
  self: Link;
  html: Link;
  commits: Link;
  approve: Link;
  "request-changes": Link;
  diff: Link;
  diffstat: Link;
  comments: Link;
  activity: Link;
  merge: Link;
  decline: Link;
  statuses: Link;
}

export interface BitbucketPullRequest {
  comment_count: number;
  task_count: number;
  type: "pullrequest";
  id: number;
  title: string;
  description: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  draft: boolean;
  merge_commit: Commit;
  close_source_branch: boolean;
  closed_by: User;
  author: User;
  reason: string;
  created_on: string;
  updated_on: string;
  destination: BranchSource;
  source: BranchSource;
  links: PullRequestLinks;
  summary: Summary;
}