#!/usr/bin/env node

/**
 * Validates Equinor plugin review records against the local JSON schema.
 *
 * Usage:
 *   node scripts/validate-plugin-reviews.js
 *   node scripts/validate-plugin-reviews.js docs/equinor-alignment/reviews/power-pages.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'docs', 'equinor-alignment', 'plugin-review.schema.json');
const REVIEWS_DIR = path.join(ROOT, 'docs', 'equinor-alignment', 'reviews');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getReviewFiles() {
  const explicitFiles = process.argv.slice(2);
  if (explicitFiles.length > 0) {
    return explicitFiles.map((filePath) => path.resolve(process.cwd(), filePath));
  }

  if (!fs.existsSync(REVIEWS_DIR)) return [];
  return fs
    .readdirSync(REVIEWS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(REVIEWS_DIR, entry.name));
}

function resolveRef(schema, ref) {
  if (!ref.startsWith('#/$defs/')) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  const name = ref.slice('#/$defs/'.length);
  const definition = schema.$defs?.[name];
  if (!definition) {
    throw new Error(`Missing schema definition: ${name}`);
  }

  return definition;
}

function typeMatches(value, expectedType) {
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  return typeof value === expectedType;
}

function validateValue(value, schemaNode, rootSchema, location, errors) {
  if (schemaNode.$ref) {
    validateValue(value, resolveRef(rootSchema, schemaNode.$ref), rootSchema, location, errors);
    return;
  }

  if (schemaNode.type && !typeMatches(value, schemaNode.type)) {
    errors.push(`${location}: expected ${schemaNode.type}`);
    return;
  }

  if (schemaNode.enum && !schemaNode.enum.includes(value)) {
    errors.push(`${location}: expected one of ${schemaNode.enum.join(', ')}`);
  }

  if (schemaNode.pattern && typeof value === 'string') {
    const pattern = new RegExp(schemaNode.pattern);
    if (!pattern.test(value)) {
      errors.push(`${location}: does not match ${schemaNode.pattern}`);
    }
  }

  if (schemaNode.minLength && typeof value === 'string' && value.length < schemaNode.minLength) {
    errors.push(`${location}: length must be at least ${schemaNode.minLength}`);
  }

  if (schemaNode.minItems && Array.isArray(value) && value.length < schemaNode.minItems) {
    errors.push(`${location}: must contain at least ${schemaNode.minItems} item(s)`);
  }

  if (schemaNode.type === 'array' && schemaNode.items) {
    value.forEach((item, index) => {
      validateValue(item, schemaNode.items, rootSchema, `${location}[${index}]`, errors);
    });
  }

  if (schemaNode.type === 'object') {
    const required = schemaNode.required || [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${location}.${key}: missing required property`);
      }
    }

    const properties = schemaNode.properties || {};
    if (schemaNode.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${location}.${key}: unknown property`);
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateValue(value[key], childSchema, rootSchema, `${location}.${key}`, errors);
      }
    }
  }
}

function validateReview(filePath, schema) {
  const review = readJson(filePath);
  const errors = [];
  validateValue(review, schema, schema, '$', errors);
  return errors;
}

const schema = readJson(SCHEMA_PATH);
const reviewFiles = getReviewFiles();
let failureCount = 0;

if (reviewFiles.length === 0) {
  console.log('No plugin review records found.');
  process.exit(0);
}

for (const filePath of reviewFiles) {
  const errors = validateReview(filePath, schema);
  const relativePath = path.relative(ROOT, filePath);

  if (errors.length === 0) {
    console.log(`${relativePath}: ok`);
    continue;
  }

  failureCount += 1;
  console.log(`${relativePath}: failed`);
  for (const error of errors) {
    console.log(`  - ${error}`);
  }
}

if (failureCount > 0) {
  process.exit(1);
}