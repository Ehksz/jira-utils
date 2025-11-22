#!/usr/bin/env node
import { writeLiteralTypesFile } from './utils'
import path from 'path'
import { execSync } from 'child_process'
import fs from 'fs'
import { JiraConfig } from './types'
import { getAllClientIssues, getSpecialIssues, getAllInternalIssues } from '.'

async function main() {
  const configPath = path.join(process.cwd(), 'jira.config.json')
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Missing jira.config.json!')
    console.log('\nCreate jira.config.json in your project root:')
    console.log(JSON.stringify({ 
      host: 'your-domain.atlassian.net', 
      email: 'your-email@company.com', 
      apiToken: 'your-api-token' 
    }, null, 2))
    process.exit(1)
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as JiraConfig
  
  if (!config.host || !config.email || !config.apiToken || !config.projectKeys || !config.specialProjectKeys || !config.internalProjectKeys) {
    console.error('❌ Invalid jira.config.json!')
    console.log('\nRequired fields: host, email, apiToken, projectKeys, specialProjectKeys, internalProjectKeys')
    process.exit(1)
  }
  
  console.log('🔧 Generating Jira type literals...')
  
  const clientIssues = await getAllClientIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: config.projectKeys,
    batchSize: 50,
    delayMs: 1000,
  });

  const internalIssues = await getAllInternalIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: config.internalProjectKeys,
    batchSize: 50,
    delayMs: 1000,
  });
  
  const specialIssues = await getSpecialIssues({
    host: config.host,
    email: config.email,
    apiToken: config.apiToken,
    projectKeys: config.specialProjectKeys,
    batchSize: 50,
    delayMs: 1000,
  });


  const allIssues = [...clientIssues, ...internalIssues, ...specialIssues]
  
  const packageDir = path.resolve(__dirname, '..')
  const outputPath = path.join(packageDir, 'src', 'literals.generated.ts')
  
  writeLiteralTypesFile(allIssues, outputPath)
  
  console.log('✅ Type literals generated!')
  console.log('🔨 Rebuilding package...')
  
  execSync('npm run build', { 
    cwd: packageDir,
    stdio: 'inherit' 
  })
  
  console.log('✅ Package ready to use!')
}

main().catch(error => {
  console.error('❌ Failed:', error.message)
  process.exit(1)
})