#!/usr/bin/env node

// Validates that generate-pipeline completed: checks for pipeline YAML file and setup guide.
// Verifies required YAML keys and confirms no unreplaced placeholder tokens.
// Gracefully exits 0 when no pipeline files are found (not a generate-pipeline session).

const fs = require('fs');
const path = require('path');
const {
  approve, block, runValidation, findProjectRoot, findPath,
} = require('../../../scripts/lib/validation-helpers');

runValidation(async (cwd) => {
  const projectRoot = findProjectRoot(cwd) || cwd;

  // Check for GitHub Actions workflow
  const ghWorkflowPath = findPath(projectRoot, path.join('.github', 'workflows', 'deploy.yml'));
  // Check for ADO pipeline
  const adoPipelinePath = findPath(projectRoot, 'azure-pipelines.yml');

  // No pipeline files found — not a generate-pipeline session
  if (!ghWorkflowPath && !adoPipelinePath) return approve();

  const pipelinePath = ghWorkflowPath || adoPipelinePath;
  const isGitHub = !!ghWorkflowPath;

  // Read the pipeline file
  let pipelineContent;
  try {
    pipelineContent = fs.readFileSync(pipelinePath, 'utf8');
  } catch {
    return block(`Pipeline file '${pipelinePath}' could not be read. The file may be corrupt.`);
  }

  if (!pipelineContent.trim()) {
    return block(`Pipeline file '${pipelinePath}' is empty.`);
  }

  // Check for required YAML keys
  if (isGitHub) {
    if (!pipelineContent.includes('on:') && !pipelineContent.includes("'on':")) {
      return block("GitHub Actions workflow is missing the 'on:' trigger section.");
    }
    if (!pipelineContent.includes('jobs:')) {
      return block("GitHub Actions workflow is missing the 'jobs:' section.");
    }
  } else {
    if (!pipelineContent.includes('trigger:')) {
      return block("Azure DevOps pipeline is missing the 'trigger:' section.");
    }
    if (!pipelineContent.includes('stages:') && !pipelineContent.includes('jobs:')) {
      return block("Azure DevOps pipeline is missing both 'stages:' and 'jobs:' sections.");
    }
  }

  // Check that the PAC CLI deploy step is present
  if (!pipelineContent.includes('pac pages upload-code-site')) {
    return block("Pipeline file does not contain a 'pac pages upload-code-site' step. The Power Pages deploy step is missing.");
  }

  // Check for unreplaced placeholder tokens (look for {UpperCase} patterns outside comments)
  const lines = pipelineContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue; // skip comments
    // Flag obvious unreplaced tokens like {ENV_URL} or {SOLUTION_NAME} (not ${{ }} which is valid YAML)
    if (/\{[A-Z][A-Z_]+\}/.test(trimmed) && !trimmed.includes('${{')) {
      return block(`Pipeline file contains an unreplaced placeholder token in line: "${trimmed.substring(0, 100)}". Fill in all required values.`);
    }
  }

  // Check for setup guide
  const setupGuidePath = findPath(projectRoot, path.join('docs', 'ci-cd-setup.md'));
  if (!setupGuidePath) {
    return block("docs/ci-cd-setup.md was not created. The setup guide is required to document manual steps.");
  }

  return approve();
});
