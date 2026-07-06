#!/usr/bin/env node

/**
 * Batch import CLI Proxy API auth files.
 *
 * Frontend interface analysis:
 * - API base: <server>/v0/management
 * - Upload endpoint: POST /auth-files
 * - Auth header: Authorization: Bearer <managementKey>
 * - Body: multipart/form-data with one or more repeated "file" fields
 */

import { Blob } from "node:buffer";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SERVER = "http://localhost:3000";
const DEFAULT_CHUNK_SIZE = 20;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function printHelp() {
  console.log(`
Usage:
  node batch-import-auth-files.mjs [options] <file-or-directory> [...]

Options:
  --base <url>          Server origin or management API base.
                        Default: CPA_API_BASE or ${DEFAULT_SERVER}
  --key <key>           Management key. Default: CPA_MANAGEMENT_KEY
  --recursive, -r       Recursively scan directories.
  --chunk-size <n>      Files per upload request. Default: ${DEFAULT_CHUNK_SIZE}
  --max-bytes <n>       Skip files larger than this many bytes. Default: ${DEFAULT_MAX_BYTES}
  --dry-run             Print files that would be uploaded without sending requests.
  --verify              Fetch /auth-files after upload and report listed count.
  --help, -h            Show this help.

Examples:
  CPA_MANAGEMENT_KEY='your-key' node batch-import-auth-files.mjs ./auth-files -r
  node batch-import-auth-files.mjs --key 'your-key' --base http://localhost:3000 ./a.json ./more
`);
}

function parseArgs(argv) {
  const options = {
    base: process.env.CPA_API_BASE || DEFAULT_SERVER,
    key: process.env.CPA_MANAGEMENT_KEY || "",
    recursive: false,
    chunkSize: DEFAULT_CHUNK_SIZE,
    maxBytes: DEFAULT_MAX_BYTES,
    dryRun: false,
    verify: false,
    inputs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--base") {
      options.base = requireValue(argv, ++i, arg);
    } else if (arg === "--key") {
      options.key = requireValue(argv, ++i, arg);
    } else if (arg === "--recursive" || arg === "-r") {
      options.recursive = true;
    } else if (arg === "--chunk-size") {
      options.chunkSize = parsePositiveInt(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--max-bytes") {
      options.maxBytes = parsePositiveInt(requireValue(argv, ++i, arg), arg);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--verify") {
      options.verify = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.inputs.push(arg);
    }
  }

  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInt(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function normalizeApiBase(input) {
  let value = String(input || "").trim();
  if (!value) {
    value = DEFAULT_SERVER;
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  value = value.replace(/\/+$/g, "");
  if (!/\/v0\/management$/i.test(value)) {
    value = `${value.replace(/\/v0\/management\/?$/i, "")}/v0/management`;
  }
  return value;
}

async function collectJsonFiles(inputs, { recursive, maxBytes }) {
  const files = [];
  const skipped = [];
  const seen = new Set();

  async function visit(target) {
    const absolute = path.resolve(target);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      skipped.push({ file: absolute, reason: `not found: ${error.message}` });
      return;
    }

    if (info.isDirectory()) {
      const entries = await readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        const child = path.join(absolute, entry.name);
        if (entry.isDirectory()) {
          if (recursive) {
            await visit(child);
          }
        } else if (entry.isFile()) {
          await visit(child);
        }
      }
      return;
    }

    if (!info.isFile()) {
      skipped.push({ file: absolute, reason: "not a regular file" });
      return;
    }

    if (path.extname(absolute).toLowerCase() !== ".json") {
      skipped.push({ file: absolute, reason: "not a .json file" });
      return;
    }

    if (info.size > maxBytes) {
      skipped.push({ file: absolute, reason: `larger than ${maxBytes} bytes` });
      return;
    }

    if (!seen.has(absolute)) {
      seen.add(absolute);
      files.push({ path: absolute, name: path.basename(absolute), size: info.size });
    }
  }

  for (const input of inputs) {
    await visit(input);
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeUploadResult(data, fallbackNames) {
  const failed = Array.isArray(data?.failed)
    ? data.failed.map((item) => ({
        name: String(item?.name ?? "").trim(),
        error: String(item?.error ?? item?.message ?? "Unknown error").trim(),
      }))
    : [];
  const files = Array.isArray(data?.files)
    ? data.files.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  const implicitSuccess = data?.uploaded === undefined && failed.length === 0;

  return {
    status: data?.status ?? (failed.length ? "partial" : "ok"),
    uploaded: data?.uploaded ?? (implicitSuccess ? fallbackNames.length : 0),
    files: files.length ? files : implicitSuccess ? [...fallbackNames] : [],
    failed,
    raw: data,
  };
}

async function uploadBatch(apiBase, key, files, batchNumber, batchTotal) {
  const form = new FormData();
  for (const file of files) {
    const bytes = await readFile(file.path);
    form.append("file", new Blob([bytes], { type: "application/json" }), file.name);
  }

  const response = await fetch(`${apiBase}/auth-files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: form,
  });
  const data = await readResponse(response);

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data.slice(0, 500)
        : data?.message || data?.error?.message || data?.error || response.statusText;
    throw new Error(`batch ${batchNumber}/${batchTotal} failed: HTTP ${response.status} ${message}`);
  }

  return normalizeUploadResult(data ?? {}, files.map((file) => file.name));
}

async function verifyList(apiBase, key) {
  const response = await fetch(`${apiBase}/auth-files`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
  const data = await readResponse(response);
  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data.slice(0, 500)
        : data?.message || data?.error?.message || data?.error || response.statusText;
    throw new Error(`verify failed: HTTP ${response.status} ${message}`);
  }
  const files = Array.isArray(data?.files) ? data.files : [];
  return { total: data?.total ?? files.length, files };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.inputs.length === 0) {
    printHelp();
    throw new Error("Provide at least one file or directory");
  }
  if (!options.key && !options.dryRun) {
    throw new Error("Missing management key. Pass --key or set CPA_MANAGEMENT_KEY.");
  }

  const apiBase = normalizeApiBase(options.base);
  const { files, skipped } = await collectJsonFiles(options.inputs, options);

  console.log(`API base: ${apiBase}`);
  console.log(`Matched JSON files: ${files.length}`);
  if (skipped.length) {
    console.log(`Skipped files: ${skipped.length}`);
    for (const item of skipped) {
      console.log(`  - ${item.file} (${item.reason})`);
    }
  }

  if (files.length === 0) {
    throw new Error("No .json files to upload");
  }

  if (options.dryRun) {
    console.log("Dry run only. Files that would be uploaded:");
    for (const file of files) {
      console.log(`  - ${file.path} (${file.size} bytes)`);
    }
    return;
  }

  let uploaded = 0;
  const failed = [];
  const batches = chunk(files, options.chunkSize);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const batchNumber = index + 1;
    console.log(`Uploading batch ${batchNumber}/${batches.length} (${batch.length} files)...`);
    try {
      const result = await uploadBatch(apiBase, options.key, batch, batchNumber, batches.length);
      uploaded += result.uploaded;
      for (const item of result.failed) {
        failed.push(item);
      }
      console.log(`  status=${result.status}, uploaded=${result.uploaded}, failed=${result.failed.length}`);
    } catch (error) {
      failed.push(...batch.map((file) => ({ name: file.name, error: error.message })));
      console.error(`  ${error.message}`);
    }
  }

  console.log("");
  console.log(`Upload summary: uploaded=${uploaded}, failed=${failed.length}, attempted=${files.length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const item of failed) {
      console.log(`  - ${item.name || "(unknown)"}: ${item.error}`);
    }
  }

  if (options.verify) {
    const result = await verifyList(apiBase, options.key);
    console.log(`Verify: server currently lists ${result.total} auth files.`);
  }

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
