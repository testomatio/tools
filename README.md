# Testomatio Tools

DevOps tools for [Testomat.io](https://testomat.io) powered by [Bunosh](https://github.com/davertmik/bunosh).

## Usage

Run directly with npx (no installation needed):

```bash
npx testomatio-tools s3:breakdown
npx testomatio-tools s3:cleanup --dry-run
```

Or install globally:

```bash
npm install -g testomatio-tools
testomatio-tools s3:cleanup
```

## Configuration

Create a `.env` file in your working directory with S3 credentials:

```
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET=your_bucket_name
S3_ENDPOINT=your_s3_endpoint_url
S3_REGION=your_s3_region
```

## Commands

### `s3:breakdown` — Analyze bucket usage

Read-only analysis showing monthly breakdown by run count and size.

```bash
npx testomatio-tools s3:breakdown
```

Example output:

```
=== Monthly Breakdown ===

December 2024 | 45 Runs | 2.1GB
November 2024 | 67 Runs | 1.8GB
October 2024  | 52 Runs | 1.5GB
```

### `s3:cleanup` — Delete old objects

Delete objects older than a given threshold (default: 6 months).

```bash
# Preview what would be deleted
npx testomatio-tools s3:cleanup --dry-run

# Delete objects older than 6 months (with confirmation prompt)
npx testomatio-tools s3:cleanup

# Delete objects older than 3 months
npx testomatio-tools s3:cleanup 3

# Skip confirmation prompt
npx testomatio-tools s3:cleanup --force

# Combine options
npx testomatio-tools s3:cleanup 12 --dry-run
```

| Argument / Option | Description | Default |
|---|---|---|
| `months` | Age threshold in months | `6` |
| `--dry-run` | Preview only, no deletions | `false` |
| `--force` | Skip confirmation prompt | `false` |

## Environment Variables

| Variable | Description |
|---|---|
| `S3_ACCESS_KEY_ID` | S3 access key ID |
| `S3_SECRET_ACCESS_KEY` | S3 secret access key |
| `S3_BUCKET` | Target bucket name |
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_REGION` | S3 region |
