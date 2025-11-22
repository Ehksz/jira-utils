import { JiraRawIssue, JiraStandardizedFields, JiraStandardizedIssue, JiraRawFields, FieldMapKeys, FieldMapValues } from "./types";
import { FIELD_MAP } from "./constants";
import { startCase, toLower } from "lodash-es";
import fs from "fs";
import path from "path";

export const titleCase = (str: string) => startCase(toLower(str));

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function transformFields<
  TSrc extends JiraRawFields,
  TDest extends JiraStandardizedFields
>(source: TSrc): TDest {
  const result = {} as TDest;
  for (const key of Object.keys(source) as (keyof JiraRawFields)[]) {
    if (key in FIELD_MAP) {
      const mapped = FIELD_MAP[key as FieldMapKeys];
      (result as unknown as Record<FieldMapValues, unknown>)[mapped] =
        source[key];
    } else {
      (result as unknown as Record<string, unknown>)[key] = source[key];
    }
  }
  return result;
}

function reverseTransformFields<
  TSrc extends JiraStandardizedFields,
  TDest extends JiraRawFields
>(source: TSrc): TDest {
  const result = {} as TDest;
  for (const key of Object.keys(source) as (keyof JiraStandardizedFields)[]) {
    const rawKey = (Object.entries(FIELD_MAP).find(
      ([_, v]) => v === key
    )?.[0] ?? key) as keyof JiraRawFields;
    (result as Record<string, unknown>)[rawKey as string] = source[key];
  }
  return result;
}

export function standardizeJiraIssue(
    issue: JiraRawIssue
  ): JiraStandardizedIssue {
    return {
      expand: issue.expand || "",
      id: issue.id,
      self: issue.self || "",
      key: issue.key,
      fields: transformFields(issue.fields),
      renderedFields: transformFields(issue.renderedFields),
    };
  }
  
  export function destandardizeJiraIssue(
    issue: JiraStandardizedIssue
  ): JiraRawIssue {
    return {
      expand: issue.expand || "",
      id: issue.id,
      self: issue.self || "",
      key: issue.key,
      fields: reverseTransformFields(issue.fields),
      renderedFields: reverseTransformFields(issue.renderedFields),
    };
  }
  
  // Generate Literals
type IssueLike = JiraRawIssue | JiraStandardizedIssue

type LiteralCollection = Record<string, Set<string>>
type LiteralAggregates = Record<string, string[]>

const USER_PROPS = ["displayName", "emailAddress", "accountId", "accountType", "timeZone"]
const STATUS_PROPS = ["name", "id", "key", "colorName"]
const PROJECT_PROPS = ["key", "name", "projectTypeKey"]
const PRIORITY_PROPS = ["id", "name"]
const ISSUE_TYPE_PROPS = ["id", "name"]
const STATUS_CAT_PROPS = ["id", "key", "colorName", "name"]

function addLiteral(target: LiteralCollection, key: string, value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    if (!target[key]) target[key] = new Set()
    target[key].add(value)
  }
}

function collectFromFields(literals: LiteralCollection, f: any) {
  if (!f || typeof f !== "object") return

  if (f.status) for (const p of STATUS_PROPS) addLiteral(literals, `Status${capitalize(p)}`, f.status[p])
  if (f.status?.statusCategory)
    for (const p of STATUS_CAT_PROPS)
      addLiteral(literals, `StatusCategory${capitalize(p)}`, f.status.statusCategory[p])

  if (f.priority) for (const p of PRIORITY_PROPS) addLiteral(literals, `Priority${capitalize(p)}`, f.priority[p])
  if (f.project) for (const p of PROJECT_PROPS) addLiteral(literals, `Project${capitalize(p)}`, f.project[p])
  if (f.issuetype) for (const p of ISSUE_TYPE_PROPS) addLiteral(literals, `IssueType${capitalize(p)}`, f.issuetype[p])

  if (f.reporter) for (const p of USER_PROPS) addLiteral(literals, `Reporter${capitalize(p)}`, f.reporter[p])
  if (f.assignee) for (const p of USER_PROPS) addLiteral(literals, `Assignee${capitalize(p)}`, f.assignee[p])
  if (f.creator) for (const p of USER_PROPS) addLiteral(literals, `Creator${capitalize(p)}`, f.creator[p])

 
  if (Array.isArray(f.labels)) for (const lb of f.labels) addLiteral(literals, "Label", lb)

  if (Array.isArray(f.components)) {
    for (const c of f.components) {
      if (typeof c === "string") addLiteral(literals, "ComponentName", c)
      else if (c && typeof c === "object") {
        const candidate =
          (c as any).name ??
          (c as any).value ??
          (c as any).displayName ??
          (c as any).key ??
          null
        addLiteral(literals, "ComponentName", candidate)
      }
    }
  }

  for (const k of Object.keys(f)) {
    if (k.startsWith("customfield")) {
      const v = (f as any)[k]
      if (typeof v === "string") addLiteral(literals, normalizeCustomKey(k), v)
      else if (Array.isArray(v)) {
        for (const i of v) {
          if (typeof i === "string") addLiteral(literals, normalizeCustomKey(k), i)
          else if (i && typeof i === "object") {
            addLiteral(literals, `${normalizeCustomKey(k)}Id`, (i as any).id)
            addLiteral(literals, `${normalizeCustomKey(k)}Value`, (i as any).value)
          }
        }
      } else if (v && typeof v === "object") {
        addLiteral(literals, `${normalizeCustomKey(k)}Id`, (v as any).id)
        addLiteral(literals, `${normalizeCustomKey(k)}Value`, (v as any).value)
      }
    }
  }
}

function aggregateIssueLiterals(issues: IssueLike[]): LiteralAggregates {
  const literals: LiteralCollection = {}

  for (const issue of issues) {
    collectFromFields(literals, issue.fields)
    collectFromFields(literals, issue.renderedFields)
  }

  const aggregates: LiteralAggregates = {}
  for (const [k, set] of Object.entries(literals)) {
    aggregates[k] = Array.from(set).sort()
  }
  return aggregates
}

function generateLiteralTypes(aggregates: LiteralAggregates): string {
  const lines: string[] = []
  const timestamp = new Date().toISOString()
  lines.push(`// Auto-generated on ${timestamp}`)
  lines.push("// ⚠️ Do not edit manually — these are derived from Jira data.")
  lines.push("")

  for (const [name, values] of Object.entries(aggregates)) {
    const typeName = safeTypeName(name)
    if (!values.length) continue
    const union = values.map(v => JSON.stringify(v)).join(" | ")
    lines.push(`export type ${typeName} = ${union}`)
  }
  return lines.join("\n")
}

function writeLiteralTypesFile(
  issues: JiraStandardizedIssue[],
  outPath = "src/types/literals.generated.ts"
) {
  const aggregates = aggregateIssueLiterals(issues)
  const code = generateLiteralTypes(aggregates)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, code, "utf8")
  return outPath
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function normalizeCustomKey(k: string) {
  return `Custom${k.replace(/^customfield_/, "")}`
}

function safeTypeName(s: string) {
  return s.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1")
}

export {
  aggregateIssueLiterals,
  generateLiteralTypes,
  writeLiteralTypesFile
}
