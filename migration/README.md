# Production catalog seed import

This folder contains the instructor-provided DynamoDB seed files and a guarded importer for account 093147866983, region us-west-2.

## Files

- dishes.json — instructor data copied byte-for-byte.
- locations.json — instructor data copied byte-for-byte.
- import-catalog.ps1 — validates, backs up current destination tables, and imports in batches of at most 25 items.

The seed files use a table-named envelope (Dishes or Locations) containing PutRequest.Item objects in DynamoDB AttributeValue form. The importer wraps those requests in RequestItems for AWS CLI calls and never rewrites the seed files.

## Table and model validation

Production targets are Dishes and Locations. Each table has a String id partition key and no sort key or GSIs. Backend entity models are in backend/restaurant-backend-app/dnapp/lambdas/api-handler/Entities/Dish.cs and Location.cs.

Dish dishType and state are stored as DynamoDB numbers using enum values. Dish.locationId, when present, must reference a location in this seed. Location.specialtyDishIds, when present, must reference dishes in this seed. Null imageUrl values are preserved; this importer does not upload images or fill missing values.

## Compatibility mapping

The backend maps the Fats property to DynamoDB attribute fats (lowercase). Two instructor dish items use Fats. During import preparation, the importer clones each dish item and renames only that attribute in the generated import payload. It does not alter dishes.json. If an item contains both spellings, the importer aborts with a clear ambiguity error.

## Validate and import

Validate locally without contacting AWS or writing files:

    .\migration\import-catalog.ps1 -ValidateOnly

When ready, run from the repository root:

    .\migration\import-catalog.ps1 -AwsProfile terraform

The importer verifies the active account and live table schemas, backs up destination scans plus a manifest under migration/backups/<UTC timestamp>/, and aborts if either table already contains any records. It requires the exact typed confirmation IMPORT PRODUCTION CATALOG 093147866983 before sending writes. It retries DynamoDB UnprocessedItems with backoff and verifies imported counts and IDs afterward.

BatchWriteItem is an upsert and has no per-item condition. Run only while catalog writers are quiescent; if concurrent writes cannot be excluded, do not run this importer.

## Verify through the production API

    $base = 'https://l4m1dwvbxe.execute-api.us-west-2.amazonaws.com/develop'
    (Invoke-RestMethod -Uri "$base/dishes").Count
    (Invoke-RestMethod -Uri "$base/dishes/popular").Count
    (Invoke-RestMethod -Uri "$base/locations").Count

Compare returned IDs and fields with the seed data. Check each non-null image URL returns HTTP 200 with an image content type.