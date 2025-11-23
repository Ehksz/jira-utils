#!/usr/bin/env node

import { writeLiteralTypesFile } from "./utils";
import path from "path";
import { execSync } from "child_process";
import fs from "fs";
import { JiraConfig } from "./types";
import {
  getAllClientIssues,
  getSpecialIssues,
  getAllInternalIssues, getMyIssueKeys
} from ".";

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

  const clientIssues = await getAllClientIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: uniqueProjectKeysThatImAssigneedTo,
    batchSize: 50,
    delayMs: 250,
  });

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
  const outputPath = path.join(packageDir, "src", "literals.generated.ts");

  writeLiteralTypesFile(allIssues, outputPath);

  execSync("npm run build", {
    cwd: packageDir,
    stdio: "inherit",
  });
}

main().catch((error) => {
  console.error("❌ Failed:", error.message);
  process.exit(1);
});
