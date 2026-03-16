import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const { exec, task, stopOnFailures, say, ask, yell } = global.bunosh;

const MILLISECONDS_IN_MONTH = 30 * 24 * 60 * 60 * 1000;

function getS3Client() {
  const required = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET'];
  const missing = required.filter(v => !process.env[v]);

  if (missing.length > 0) {
    yell(`Missing env variables: ${missing.join(', ')}`);
    say('Set them in .env file or export as environment variables');
    return null;
  }

  return new S3Client({
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
  });
}

async function listAllObjects(s3, bucket) {
  const objects = [];
  let continuationToken = null;

  do {
    const params = { Bucket: bucket, MaxKeys: 1000 };
    if (continuationToken) params.ContinuationToken = continuationToken;

    const response = await s3.send(new ListObjectsV2Command(params));
    objects.push(...(response.Contents || []));
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatBytesShort(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return (value % 1 === 0 ? value.toString() : value.toFixed(1)) + sizes[i];
}

function getMonthYear(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Delete S3 objects older than specified months threshold
 * @param {number} months - Age threshold in months (default: 6)
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false] - Preview deletions without executing
 * @param {boolean} [opts.force=false] - Skip confirmation prompt
 */
export async function s3Cleanup(months = 6, opts = { dryRun: false, force: false }) {
  stopOnFailures();
  const dryRun = arguments[1];
  const force = arguments[2];

  const s3 = getS3Client();
  if (!s3) return;

  const bucket = process.env.S3_BUCKET;
  const mode = dryRun ? 'DRY RUN' : 'LIVE';

  say(`S3 Cleanup [${mode}] — Bucket: ${bucket}, Threshold: ${months} months`);

  say('Fetching objects from S3...');
  const allObjects = await listAllObjects(s3, bucket);
  say(`Found ${allObjects.length} total objects`);

  const cutoffDate = new Date(Date.now() - months * MILLISECONDS_IN_MONTH);
  say(`Cutoff date: ${cutoffDate.toISOString()}`);

  const oldObjects = allObjects.filter(obj => new Date(obj.LastModified) < cutoffDate);

  if (oldObjects.length === 0) {
    say('No objects older than threshold found.');
    return;
  }

  const totalSize = oldObjects.reduce((sum, obj) => sum + obj.Size, 0);
  say(`Objects to delete: ${oldObjects.length} (${formatBytes(totalSize)})`);

  if (dryRun) {
    const latestModification = new Date(Math.max(...oldObjects.map(obj => new Date(obj.LastModified).getTime())));
    say(`Latest modification date: ${latestModification.toISOString()}`);
    say('DRY RUN — no objects deleted');
    return;
  }

  if (!force) {
    const proceed = await ask(`Delete ${oldObjects.length} objects (${formatBytes(totalSize)})?`, false);
    if (!proceed) {
      say('Aborted.');
      return;
    }
  }

  const batchSize = 1000;
  const objectKeys = oldObjects.map(obj => obj.Key);

  for (let i = 0; i < objectKeys.length; i += batchSize) {
    const batch = objectKeys.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(objectKeys.length / batchSize);

    await task(`Deleting batch ${batchNum}/${totalBatches}`, async () => {
      const result = await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map(key => ({ Key: key })) },
      }));

      say(`Deleted ${result.Deleted.length} objects`);
      if (result.Errors?.length > 0) {
        result.Errors.forEach(err => say(`  Failed: ${err.Key}: ${err.Message}`));
      }
    });
  }

  yell(`Cleanup complete! Deleted ${oldObjects.length} objects (${formatBytes(totalSize)})`);
}

/**
 * Show monthly breakdown of S3 bucket usage by size and run count
 */
export async function s3Breakdown() {
  stopOnFailures();

  const s3 = getS3Client();
  if (!s3) return;

  const bucket = process.env.S3_BUCKET;
  say(`S3 Breakdown — Bucket: ${bucket}`);

  say('Fetching objects from S3...');
  const allObjects = await listAllObjects(s3, bucket);
  say(`Found ${allObjects.length} total objects`);

  const monthlyData = {};

  allObjects.forEach(obj => {
    const date = new Date(obj.LastModified);
    const monthYear = getMonthYear(date);
    const runId = obj.Key.split('/')[0];

    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = { totalSize: 0, runs: new Set(), date };
    }

    monthlyData[monthYear].totalSize += obj.Size;
    monthlyData[monthYear].runs.add(runId);
  });

  say('\n=== Monthly Breakdown ===\n');

  Object.entries(monthlyData)
    .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
    .forEach(([monthYear, data]) => {
      say(`${monthYear} | ${data.runs.size} Runs | ${formatBytesShort(data.totalSize)}`);
    });
}
