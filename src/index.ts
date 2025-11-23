import {
  BitbucketPullRequest,
  BitbucketRepository,
  GetBitbucketRepoByJiraProjectOptions,
  PaginatedPullRequests,
  GetPullRequestsByIssueKeyOptions,
  JiraClientIssuesOptions,
  JiraClientOptions,
  JiraInternalIssuesOptions,
  JiraRawIssue,
  JiraSpecialIssuesOptions,
  JiraStandardizedIssue,
} from "./types";

import { Version2Client, HttpException } from "jira.js";
import { SearchAndReconcileResults } from "jira.js/dist/esm/types/version2/models";
import { omitBy, sortBy, uniqBy } from "lodash-es";
import { Issue } from "jira.js/dist/esm/types/version2/models";
import { standardizeJiraIssue, wait } from "./utils";
import axios, { AxiosError } from "axios";
import { Bitbucket, APIClient as BitbucketAPIClient } from "bitbucket";

const createBitbucketClient = ({
  username,
  apiToken,
}: {
  username: string;
  apiToken: string;
}) => {
  return new Bitbucket({
    baseUrl: "https://api.bitbucket.org/2.0",
    auth: {
      username,
      password: apiToken,
    },
  });
};


export async function fetchAllJiraIssues({
  host,
  email,
  apiToken,
  jqlQuery,
  batchSize = 50,
  delayMs = 250,
}: JiraClientOptions): Promise<JiraStandardizedIssue[]> {
  let allIssues: JiraStandardizedIssue[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  const jiraClient = new Version2Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });

  while (hasMore) {
    try {
      const response: SearchAndReconcileResults =
        await jiraClient.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: jqlQuery,
          maxResults: batchSize,
          expand: "renderedFields,names,schema,transitions,operations,editmeta",
          fields: ["*all"],
          ...(pageToken && { nextPageToken: pageToken }),
        });
      const { issues, nextPageToken } = response;

      if (issues && Array.isArray(issues) && Array.isArray(allIssues)) {
        const strippedIssues: Issue[] = issues.map((i) => {
          const noCustomFields = omitBy(i.fields, (value, key) =>
            key.startsWith("customfield_")
          );
          return { ...i, fields: noCustomFields } as Issue;
        });
        allIssues = [...allIssues, ...strippedIssues].map((issue) =>
          standardizeJiraIssue(issue as JiraRawIssue)
        );
      }

      hasMore = !!nextPageToken;
      pageToken = nextPageToken;

      if (hasMore) {
        await wait(delayMs);
      }
    } catch (error) {
      throw error;
    }
  }

  return allIssues;
}

export async function getMyProjectKeys({
  host,
  email,
  apiToken,
}: {
  host: string;
  email: string;
  apiToken: string;
}): Promise<string[]> {
  const jiraClient = new Version2Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });

  try {
    const projects = await jiraClient.projects.searchProjects({
      maxResults: 1000,
    });

    const projectKeys = projects.values
      ?.map((project) => project.key)
      .filter(Boolean) as string[];

    return projectKeys;
  } catch (error) {
    console.error("Failed to fetch user projects:", error);
    if (error instanceof HttpException && error.response) {
      const response = error.response as { data?: Record<string, any> };
      if (response.data && typeof response.data === "object") {
        console.error(
          "Jira error details:",
          JSON.stringify(response.data, null, 2)
        );
      }
    }
    return [];
  }
}

export async function getMyIssueKeys({
  host,
  email,
  apiToken,
  batchSize = 100,
  delayMs = 250,
}: {
  host: string;
  email: string;
  apiToken: string;
  batchSize?: number;
  delayMs?: number;
}): Promise<string[]> {
  const jiraClient = new Version2Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });

  let allIssueKeys: string[] = [];
  let pageToken: string | undefined = undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const response: SearchAndReconcileResults =
        await jiraClient.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: "assignee = currentUser() ORDER BY created DESC",
          maxResults: batchSize,
          fields: ["key"],
          ...(pageToken && { nextPageToken: pageToken }),
        });

      const { issues, nextPageToken } = response;

      if (issues && Array.isArray(issues)) {
        const keys = issues
          .map((issue) => issue.key)
          .filter(Boolean) as string[];
        allIssueKeys = [...allIssueKeys, ...keys];
      }

      hasMore = !!nextPageToken;
      pageToken = nextPageToken;

      if (hasMore) {
        await wait(delayMs);
      }
    }

    return allIssueKeys;
  } catch (error) {
    console.error("Failed to fetch user issue keys:", error);
    if (error instanceof HttpException && error.response) {
      const response = error.response as { data?: Record<string, any> };
      if (response.data && typeof response.data === "object") {
        console.error(
          "Jira error details:",
          JSON.stringify(response.data, null, 2)
        );
      }
    }
    return [];
  }
}

export const getBitbucketRepoByJiraProject = async ({
  username,
  apiToken,
  projectKey,
  workspace,
}: GetBitbucketRepoByJiraProjectOptions): Promise<{
  repos: BitbucketRepository[] | null;
  bitbucketClient: BitbucketAPIClient;
}> => {
  const bitbucketClient = new Bitbucket({
    baseUrl: "https://api.bitbucket.org/2.0",
    auth: {
      username,
      password: apiToken,
    },
  });

  const repos = await bitbucketClient.repositories.list({
    workspace,
    q: `project.key="${projectKey}"`,
  });

  if (repos.data && repos.data.values && repos.data.values.length > 0) {
    return {
      repos: repos.data.values as unknown as BitbucketRepository[],
      bitbucketClient,
    };
  }

  return { repos: null, bitbucketClient };
};


export async function getUserOpenPullRequests(
  { workspace, selectedUser, username, apiToken, issueKey }: { workspace: string, selectedUser: string, username: string, apiToken: string, issueKey: string }
) {
  const bitbucket = axios.create({
    baseURL: 'https://api.bitbucket.org/2.0',
    auth: {
      username,
      password: apiToken
    },
    headers: {
      'Accept': 'application/json'
    }
  });

  const allPullRequests: BitbucketPullRequest[] = [];
  let url: string | null = `/workspaces/${workspace}/pullrequests/${selectedUser}`;

  while (url) {
    const response = await bitbucket.get(url, {
      params: { q: `source.branch.name ~ "${issueKey}" AND state = "OPEN"` }
    });
    const data = response.data as PaginatedPullRequests;

    allPullRequests.push(...data.values);
    url = data.next || null;
  }

  return allPullRequests.map(pr => ({ branchName: pr.source?.branch?.name ?? null, title: pr.title, prLink: pr.links?.html?.href ?? null  })).filter(pr => pr.branchName !== null && pr.prLink !== null);
}

export const getPullRequestsByIssueKey = async ({
  username,
  apiToken,
  issueKey,
  workspace,
}: GetPullRequestsByIssueKeyOptions) => {
  const client = createBitbucketClient({ username, apiToken });

  const firstPage = await client.repositories.list({
    workspace,
    pagelen: 100,
    role: "contributor",
    page: "1",
  });

  let allRepositories = firstPage.data
    .values as unknown as BitbucketRepository[];

  let totalPages = 1;
  if (firstPage.data.size && firstPage.data.pagelen) {
    totalPages = Math.ceil(firstPage.data.size / firstPage.data.pagelen);
  }

  if (totalPages > 1) {
    const repoPromises = [];
    for (let i = 2; i <= totalPages; i++) {
      repoPromises.push(
        client.repositories.list({
          workspace,
          pagelen: 100,
          page: i.toString(),
        })
      );
    }

    const remainingPages = await Promise.all(repoPromises);
    const remainingRepos = remainingPages
      .map((resp) => resp.data.values as unknown as BitbucketRepository[])
      .flat();

    allRepositories = [...allRepositories, ...remainingRepos];
  }

  const pullRequestPromises = allRepositories.map(async (repo) => {
    try {
      return await client.repositories.listPullRequests({
        workspace,
        repo_slug: repo.slug,
        q: `source.branch.name ~ "${issueKey}" AND state = "OPEN"`,
        pagelen: 15,
      });
    } catch (error) {
      return { data: { values: [] } };
    }
  });

  const pullRequests = await Promise.all(pullRequestPromises);
  const allPRs = pullRequests.map((pr) => pr.data.values).flat();

  const filteredPRs = allPRs.filter((pr) => pr !== undefined && pr !== null);
  return filteredPRs;
};

export const getAllClientIssues = async ({
  host,
  email,
  apiToken,
  projectKeys,
  batchSize = 50,
  delayMs = 1000,
  highestNumber = 15,
}: JiraClientIssuesOptions) => {
  try {
    const jqlQuery = `project IN (${projectKeys
      .map((key) => `"${key}"`)
      .join(", ")}) AND assignee = currentUser() ORDER BY created DESC`;
    const assignedToMe = await fetchAllJiraIssues({
      host,
      email,
      apiToken,
      jqlQuery,
      batchSize,
      delayMs,
    });

    let projectIssues = await fetchAllJiraIssues({
      host,
      email,
      apiToken,
      jqlQuery: `project in (${projectKeys
        .map((key) => `"${key}"`)
        .join(
          ", "
        )}) AND issuetype = "Project" AND summary !~ "old" AND summary !~ "deprecated" ORDER BY created DESC`,
      batchSize,
      delayMs,
    });

    const additionalIssues = await Promise.all(
      projectKeys.map(async (key) => {
        const keysUntilHighestNumber = Array.from(
          { length: highestNumber },
          (_, i) => `${key}-${i + 1}`
        );

        return await fetchAllJiraIssues({
          host,
          email,
          apiToken,
          jqlQuery: `issuekey in (${keysUntilHighestNumber
            .map((key) => `"${key}"`)
            .join(
              ", "
            )}) AND summary !~ "old" AND summary !~ "deprecated" ORDER BY created DESC`,
          batchSize: 50,
          delayMs: 1000,
        });
      })
    );

    projectIssues = [...projectIssues, ...additionalIssues.flat()];

    const dedupedProjectIssues = sortBy(
      uniqBy(projectIssues, "key"),
      "created"
    );

    const allIssues = [
      ...(dedupedProjectIssues || []),
      ...(assignedToMe || []),
    ];

    return allIssues;
  } catch (error) {
    if (error instanceof AxiosError) {
    }
    if (error instanceof HttpException) {
    }

    return [];
  }
};

export const getAllInternalIssues = async ({
  host,
  email,
  apiToken,
  projectKeys,
  batchSize = 50,
  delayMs = 1000,
}: JiraInternalIssuesOptions) => {
  try {
    const jqlQuery = `project IN (${projectKeys
      .map((key) => `"${key}"`)
      .join(
        ", "
      )}) AND summary !~ "old" AND summary !~ "deprecated" ORDER BY created DESC`;
    const allIssues = await fetchAllJiraIssues({
      host,
      email,
      apiToken,
      jqlQuery,
      batchSize,
      delayMs,
    });
    return allIssues || [];
  } catch (error) {
    console.error("Failed to fetch internal Jira issues:", error);
    if (error instanceof HttpException && error.response) {
      const response = error.response as { data?: Record<string, any> };
      if (response.data && typeof response.data === "object") {
        console.error(
          "Jira error details:",
          JSON.stringify(response.data, null, 2)
        );
      }
    }
    return [];
  }
};

export const getSpecialIssues = async ({
  host,
  email,
  apiToken,
  projectKeys,
  batchSize = 50,
  delayMs = 1000,
}: JiraSpecialIssuesOptions) => {
  const keys = projectKeys.map((key) => `"${key}"`).join(", ");
  try {
    const jqlQuery = `issuekey in (${keys}) AND summary !~ "old" AND summary !~ "deprecated" ORDER BY created DESC`;

    const allIssues = await fetchAllJiraIssues({
      host,
      email,
      apiToken,
      jqlQuery,
      batchSize,
      delayMs,
    });

    return allIssues || [];
  } catch (error) {
    console.error("Failed to fetch special Jira issues:", error);
    if (error instanceof HttpException && error.response) {
      const response = error.response as { data?: Record<string, any> };
      if (response.data && typeof response.data === "object") {
        console.error(
          "Jira error details:",
          JSON.stringify(response.data, null, 2)
        );
      }
    }
    return [];
  }
};
