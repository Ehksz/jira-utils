import {
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
import { AxiosError } from "axios";

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

      console.log(
        `Fetched ${issues?.length || 0} issues. Total so far: ${
          allIssues.length
        }`
      );

      if (hasMore) {
        await wait(delayMs);
      }
    } catch (error) {
      throw error;
    }
  }

  return allIssues;
}

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
    const jqlQuery = `project IN (${projectKeys.join(
      ", "
    )}) AND assignee = currentUser() ORDER BY created DESC`;
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
      jqlQuery: `project in (${projectKeys.join(
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
        console.log(
          `issuekey in (${keysUntilHighestNumber.join(
            ", "
          )}) AND summary !~ "old" AND summary !~ "deprecated" ORDER BY created DESC`
        );
        return await fetchAllJiraIssues({
          host,
          email,
          apiToken,
          jqlQuery: `issuekey in (${keysUntilHighestNumber.join(
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

    console.log(
      `Successfully fetched all ${allIssues.length} client Jira issues`
    );
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
    const jqlQuery =
      `project IN (${projectKeys.join(
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
    console.log(
      `Successfully fetched all ${allIssues?.length || 0} internal Jira issues`
    );
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
    console.log(`Fetching special Jira issues with JQL: ${jqlQuery}`);

    const allIssues = await fetchAllJiraIssues({
      host,
      email,
      apiToken,
      jqlQuery,
      batchSize,
      delayMs,
    });

    console.log(
      `Successfully fetched all ${allIssues?.length || 0} single Jira issues`
    );
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