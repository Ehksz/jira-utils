#!/usr/bin/env node

import { writeLiteralTypesFile } from "./utils";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";
import { JiraConfig, JiraStandardizedIssue } from "./types";
import {
  getAllClientIssues,
  getSpecialIssues,
  getAllInternalIssues, getMyIssueKeys
} from ".";
import { chunk } from "lodash-es";

async function main() {
  const configPath = path.join(process.cwd(), "jira.config.json");

  if (!fs.existsSync(configPath)) {
    console.error("❌ Missing jira.config.json!");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JiraConfig;

  if (
    !config.host ||
    !config.email ||
    !config.apiToken ||
    !config.projectKeys ||
    !config.specialProjectKeys ||
    !config.internalProjectKeys ||
    !config.workspace
  ) {
    console.error("❌ Invalid jira.config.json!");
    process.exit(1);
  }

  const myIssueKeys = await getMyIssueKeys({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    batchSize: 200,
    delayMs: 250,
  });

  const uniqueProjectKeysThatImAssigneedTo = [
    ...new Set(myIssueKeys.map((key) => key.split("-")[0])),
  ];
  console.log(`Found ${uniqueProjectKeysThatImAssigneedTo.length} unique project keys that I'm assigneed to`);
  const clientIssues: JiraStandardizedIssue[] = [];

  const chunksOfProjectKeys = chunk(uniqueProjectKeysThatImAssigneedTo, 10);
  for (const chunk of chunksOfProjectKeys) {
    const issuesForChunk = await getAllClientIssues({
      host: config.host,
      email: config.email,
      apiToken: config.apiToken,
      projectKeys: chunk,
      batchSize: 50,
      delayMs: 250,
    });
    console.log(`Found ${issuesForChunk.length} client issues for chunk ${chunk.join(", ")}`);
    clientIssues.push(...issuesForChunk);
  }

  const internalIssues = await getAllInternalIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: config.internalProjectKeys,
    batchSize: 50,
    delayMs: 250,
  });

  const specialIssues = await getSpecialIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: config.specialProjectKeys,
    batchSize: 50,
    delayMs: 250,
  });

  const allIssues = [...clientIssues, ...internalIssues, ...specialIssues];

  const packageDir = path.resolve(__dirname, "..");
  const outputPath = path.join(packageDir, "dist", "literals.generated.js");
  const outputPathTs = path.join(packageDir, "dist", "literals.generated.d.ts");

  const timestamp = new Date().toISOString();
  const typeDefinitions = writeLiteralTypesFile(allIssues, outputPathTs);

  const jsContent = `"use strict";
// Auto-generated on ${timestamp}
// ⚠️ Do not edit manually — these are derived from Jira data.
Object.defineProperty(exports, "__esModule", { value: true });
`;

  fs.writeFileSync(outputPath, jsContent, "utf8");

  console.log(`✅ Generated ${outputPathTs}`);
  console.log(`📊 Total issues processed: ${allIssues.length}`);
}

main().catch((error) => {
  console.error("❌ Failed:", error.message);
  process.exit(1);
});
