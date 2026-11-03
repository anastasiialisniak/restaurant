[CmdletBinding()]
param(
    [string]$AwsProfile = 'terraform',
    [string]$Region = 'us-west-2',
    [string]$ExpectedAccountId = '093147866983',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$SeedFiles = @{
    Dishes = Join-Path $PSScriptRoot 'dishes.json'
    Locations = Join-Path $PSScriptRoot 'locations.json'
}

function ConvertTo-OrdinalJsonStructure {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return $null }

    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $result = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
        foreach ($property in $Value.PSObject.Properties) {
            $result.Add($property.Name, (ConvertTo-OrdinalJsonStructure -Value $property.Value))
        }
        return ,$result
    }

    if ($Value -is [System.Array]) {
        $result = [System.Collections.Generic.List[object]]::new()
        foreach ($entry in $Value) {
            $result.Add((ConvertTo-OrdinalJsonStructure -Value $entry))
        }
        return ,$result.ToArray()
    }

    return $Value
}

function ConvertFrom-JsonCompatible {
    param([Parameter(Mandatory)][string]$Json)
    $parsed = ConvertFrom-Json -InputObject $Json
    return ,(ConvertTo-OrdinalJsonStructure -Value $parsed)
}

function Invoke-AwsJson {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & aws @Arguments
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI command failed: aws $($Arguments -join ' ')" }
    $text = $output -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return ConvertFrom-JsonCompatible -Json $text
}

function Get-RequiredString {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary]$Item,
        [Parameter(Mandatory)][string]$Name
    )
    if (-not $Item.Contains($Name)) { throw "Missing required attribute '$Name'." }
    $attribute = $Item[$Name]
    if ($attribute -isnot [System.Collections.IDictionary] -or $attribute.Count -ne 1 -or
        -not $attribute.Contains('S') -or [string]::IsNullOrWhiteSpace([string]$attribute.S)) {
        throw "Attribute '$Name' must be a non-empty DynamoDB String (S)."
    }
    return [string]$attribute.S
}

function Assert-AttributeType {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary]$Item,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Type,
        [switch]$Optional,
        [switch]$AllowNull
    )
    if (-not $Item.Contains($Name)) {
        if ($Optional) { return }
        throw "Missing required attribute '$Name'."
    }
    $attribute = $Item[$Name]
    if ($Optional -and $AllowNull -and $attribute -is [System.Collections.IDictionary] -and
        $attribute.Count -eq 1 -and $attribute.Contains('NULL') -and $attribute.NULL -eq $true) { return }
    if ($attribute -isnot [System.Collections.IDictionary] -or $attribute.Count -ne 1 -or
        -not $attribute.Contains($Type)) { throw "Attribute '$Name' must be DynamoDB type '$Type'." }
}

function Convert-DishItemForImport {
    param([Parameter(Mandatory)][System.Collections.IDictionary]$SourceItem)
    $hasLegacyFats = $SourceItem.Contains('Fats')
    $hasCanonicalFats = $SourceItem.Contains('fats')
    if ($hasLegacyFats -and $hasCanonicalFats) {
        $id = if ($SourceItem.Contains('id')) { [string]$SourceItem['id'].S } else { '<unknown>' }
        throw "Dish '$id' contains both 'Fats' and 'fats'; refusing ambiguous import data."
    }
    $payload = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
    foreach ($key in $SourceItem.Keys) { $payload.Add([string]$key, $SourceItem[$key]) }
    if ($hasLegacyFats) {
        $payload.Add('fats', $payload['Fats'])
        $payload.Remove('Fats')
    }
    return $payload
}

function Get-SeedItems {
    param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$TableName)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required seed file not found: $Path" }
    try { $json = Get-Content -LiteralPath $Path -Raw; $document = ConvertFrom-JsonCompatible -Json $json }
    catch { throw "Invalid JSON in '$Path': $($_.Exception.Message)" }
    if ($document -isnot [System.Collections.IDictionary]) { throw "'$Path' must contain a JSON object." }

    if ($document.Contains('RequestItems')) {
        if ($document.RequestItems -isnot [System.Collections.IDictionary] -or
            -not $document.RequestItems.Contains($TableName)) {
            throw "'$Path' must contain BatchWriteItem requests for $TableName."
        }
        if ($document.RequestItems.Count -ne 1) { throw "'$Path' must contain requests for $TableName only." }
        $requests = @($document.RequestItems[$TableName])
    } elseif ($document.Contains($TableName)) {
        if ($document.Count -ne 1) { throw "'$Path' must contain requests for $TableName only." }
        $requests = @($document[$TableName])
    } else {
        throw "'$Path' must contain PutRequest entries under '$TableName' (or RequestItems.$TableName)."
    }
    if ($requests.Count -eq 0) { throw "'$Path' contains no records for $TableName." }

    $items = [System.Collections.Generic.List[System.Collections.IDictionary]]::new()
    $ids = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($request in $requests) {
        if ($request -isnot [System.Collections.IDictionary] -or $request.Count -ne 1 -or
            -not $request.Contains('PutRequest') -or $request.PutRequest -isnot [System.Collections.IDictionary] -or
            -not $request.PutRequest.Contains('Item') -or
            $request.PutRequest.Item -isnot [System.Collections.IDictionary]) {
            throw "'$Path' may contain PutRequest.Item entries only; deletes are not accepted."
        }

        $sourceItem = $request.PutRequest.Item
        $item = if ($TableName -eq 'Dishes') { Convert-DishItemForImport -SourceItem $sourceItem } else { $sourceItem }
        $id = Get-RequiredString -Item $item -Name 'id'
        if (-not $ids.Add($id)) { throw "Duplicate id '$id' in '$Path'." }

        if ($TableName -eq 'Dishes') {
            foreach ($field in @('name','description','weight','calories','proteins','fats','carbohydrates','vitamins')) {
                Assert-AttributeType -Item $item -Name $field -Type 'S'
            }
            foreach ($field in @('dishType','price','state')) {
                Assert-AttributeType -Item $item -Name $field -Type 'N'
            }
            Assert-AttributeType -Item $item -Name 'imageUrl' -Type 'S' -Optional -AllowNull
            Assert-AttributeType -Item $item -Name 'locationId' -Type 'S' -Optional -AllowNull
            if ($item.dishType.N -notin @('0','1','2')) { throw "Dish '$id' has invalid dishType enum value." }
            if ($item.state.N -notin @('0','1','2')) { throw "Dish '$id' has invalid state enum value." }
            try { [void][decimal]::Parse([string]$item.price.N,[Globalization.CultureInfo]::InvariantCulture) }
            catch { throw "Dish '$id' has invalid numeric price." }
        } else {
            foreach ($field in @('address','description','averageOccupancy')) {
                Assert-AttributeType -Item $item -Name $field -Type 'S'
            }
            foreach ($field in @('totalCapacity','rating')) {
                Assert-AttributeType -Item $item -Name $field -Type 'N'
            }
            Assert-AttributeType -Item $item -Name 'imageUrl' -Type 'S' -Optional -AllowNull
            Assert-AttributeType -Item $item -Name 'specialtyDishIds' -Type 'L' -Optional -AllowNull
            if ($item.Contains('specialtyDishIds') -and $item.specialtyDishIds.Contains('L')) {
                foreach ($entry in $item.specialtyDishIds.L) {
                    if ($entry -isnot [System.Collections.IDictionary] -or $entry.Count -ne 1 -or
                        -not $entry.Contains('S') -or [string]::IsNullOrWhiteSpace([string]$entry.S)) {
                        throw "Location '$id' specialtyDishIds must be a DynamoDB List of non-empty Strings."
                    }
                }
            }
            try { [void][int]::Parse([string]$item.totalCapacity.N,[Globalization.CultureInfo]::InvariantCulture) }
            catch { throw "Location '$id' has invalid totalCapacity." }
            try { [void][double]::Parse([string]$item.rating.N,[Globalization.CultureInfo]::InvariantCulture) }
            catch { throw "Location '$id' has invalid rating." }
        }
        $items.Add($item)
    }
    return ,@($items)
}

function Get-TableScan {
    param([Parameter(Mandatory)][string]$TableName)
    return Invoke-AwsJson -Arguments @(
        'dynamodb','scan','--table-name',$TableName,'--region',$Region,'--profile',$AwsProfile,'--output','json'
    )
}

function Assert-TableSchema {
    param([Parameter(Mandatory)][string]$TableName)
    $description = Invoke-AwsJson -Arguments @(
        'dynamodb','describe-table','--table-name',$TableName,'--region',$Region,'--profile',$AwsProfile,'--output','json'
    )
    $table = $description.Table
    if ($table.TableStatus -ne 'ACTIVE' -or $table.KeySchema.Count -ne 1 -or
        $table.KeySchema[0].AttributeName -ne 'id' -or $table.KeySchema[0].KeyType -ne 'HASH' -or
        $table.AttributeDefinitions.Count -ne 1 -or $table.AttributeDefinitions[0].AttributeName -ne 'id' -or
        $table.AttributeDefinitions[0].AttributeType -ne 'S') {
        throw "Table '$TableName' is not ACTIVE with the expected String id hash key only."
    }
}

function Write-JsonFile {
    param([string]$Path,[object]$Value)
    $json = ConvertTo-Json -InputObject $Value -Depth 100
    [System.IO.File]::WriteAllText($Path,$json,[System.Text.UTF8Encoding]::new($false))
}

function Submit-BatchWithRetry {
    param([string]$TableName,[object[]]$Requests,[string]$BackupDirectory)
    $pending = @($Requests)
    for ($attempt = 1; $attempt -le 10 -and $pending.Count -gt 0; $attempt++) {
        $requestPath = Join-Path $BackupDirectory ("request-{0}-{1}.json" -f $TableName,$attempt)
        Write-JsonFile -Path $requestPath -Value @{ RequestItems = @{ $TableName = $pending } }
        $response = Invoke-AwsJson -Arguments @(
            'dynamodb','batch-write-item','--cli-input-json',("file://{0}" -f $requestPath),
            '--region',$Region,'--profile',$AwsProfile,'--output','json'
        )
        $pending = @()
        if ($response.UnprocessedItems -and $response.UnprocessedItems.Contains($TableName)) {
            $pending = @($response.UnprocessedItems[$TableName])
        }
        if ($pending.Count -gt 0) {
            if ($attempt -eq 10) { throw "UnprocessedItems remain for '$TableName' after 10 attempts." }
            Start-Sleep -Seconds ([Math]::Min(30,[Math]::Pow(2,$attempt)))
        }
    }
}

$dishRequests = Get-SeedItems -Path $SeedFiles.Dishes -TableName 'Dishes'
$locationRequests = Get-SeedItems -Path $SeedFiles.Locations -TableName 'Locations'
if ($dishRequests.Count -ne 8) { throw "Expected exactly 8 dishes; found $($dishRequests.Count)." }
if ($locationRequests.Count -ne 3) { throw "Expected exactly 3 locations; found $($locationRequests.Count)." }

$dishIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$locationIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($item in $dishRequests) { [void]$dishIds.Add([string]$item.id.S) }
foreach ($item in $locationRequests) { [void]$locationIds.Add([string]$item.id.S) }
foreach ($item in $dishRequests) {
    if ($item.Contains('locationId') -and $item.locationId.Contains('S') -and
        -not $locationIds.Contains([string]$item.locationId.S)) {
        throw "Dish '$($item.id.S)' references missing location '$($item.locationId.S)'."
    }
}
foreach ($item in $locationRequests) {
    if ($item.Contains('specialtyDishIds') -and $item.specialtyDishIds.Contains('L')) {
        foreach ($entry in $item.specialtyDishIds.L) {
            if (-not $dishIds.Contains([string]$entry.S)) {
                throw "Location '$($item.id.S)' references missing dish '$($entry.S)'."
            }
        }
    }
}

if ($ValidateOnly) {
    $conflict = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
    $conflict.Add('id', @{ S = 'local-conflict-check' })
    $conflict.Add('Fats', @{ S = '1 g' })
    $conflict.Add('fats', @{ S = '2 g' })
    $rejected = $false
    try { [void](Convert-DishItemForImport -SourceItem $conflict) }
    catch {
        if ($_.Exception.Message -notlike "*both 'Fats' and 'fats'*") { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Both-key conflict self-check failed.' }
    foreach ($item in $dishRequests) {
        if ($item.Contains('Fats') -or -not $item.Contains('fats')) {
            throw "Generated dish payload '$($item.id.S)' did not normalize to lowercase fats."
        }
    }
    Write-Host "Seed validation passed: $($dishRequests.Count) dishes and $($locationRequests.Count) locations."
    Write-Host 'IDs are unique; required attributes and supplied relationships are valid.'
    Write-Host 'Payload mapping Fats -> fats passed; both-key conflict is rejected.'
    return
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw 'AWS CLI was not found on PATH.' }
$identity = Invoke-AwsJson -Arguments @('sts','get-caller-identity','--profile',$AwsProfile,'--output','json')
if ($identity.Account -ne $ExpectedAccountId) {
    throw "Active AWS account '$($identity.Account)' does not match expected account '$ExpectedAccountId'."
}
Assert-TableSchema -TableName 'Dishes'
Assert-TableSchema -TableName 'Locations'

$backupDirectory = Join-Path $PSScriptRoot (Join-Path 'backups' ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')))
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$before = @{}
foreach ($table in @('Dishes','Locations')) {
    $scan = Get-TableScan -TableName $table
    $before[$table] = $scan
    Write-JsonFile -Path (Join-Path $backupDirectory "$table-before.json") -Value $scan
    if (@($scan.Items).Count -gt 0) {
        throw "Table '$table' already contains records. Backup saved at '$backupDirectory'; no import was sent."
    }
}
$manifest = @{
    account = $ExpectedAccountId
    region = $Region
    destinationItemCountsBefore = @{ Dishes = 0; Locations = 0 }
    importPayloadCompatibility = 'Dishes: Fats -> fats; seed files unchanged'
    dishes = @($dishRequests | ForEach-Object { $_.id.S })
    locations = @($locationRequests | ForEach-Object { $_.id.S })
    startedUtc = [DateTime]::UtcNow.ToString('o')
}
Write-JsonFile -Path (Join-Path $backupDirectory 'manifest.json') -Value $manifest

Write-Host "Validated $($dishRequests.Count) dishes and $($locationRequests.Count) locations."
Write-Host "Account $ExpectedAccountId; region $Region; local backups: $backupDirectory"
$confirmation = Read-Host 'Type exactly: IMPORT PRODUCTION CATALOG 093147866983'
if ($confirmation -cne 'IMPORT PRODUCTION CATALOG 093147866983') {
    throw 'Production confirmation did not match. No import was sent.'
}

foreach ($pair in @(@{ Table = 'Dishes'; Requests = $dishRequests },@{ Table = 'Locations'; Requests = $locationRequests })) {
    $all = @($pair.Requests)
    for ($offset = 0; $offset -lt $all.Count; $offset += 25) {
        $end = [Math]::Min($offset + 24,$all.Count - 1)
        $batch = @($all[$offset..$end] | ForEach-Object { @{ PutRequest = @{ Item = $_ } } })
        Submit-BatchWithRetry -TableName $pair.Table -Requests $batch -BackupDirectory $backupDirectory
    }
}

foreach ($table in @('Dishes','Locations')) {
    $after = Get-TableScan -TableName $table
    $expected = if ($table -eq 'Dishes') { $dishRequests } else { $locationRequests }
    $actual = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($item in @($after.Items)) { [void]$actual.Add([string]$item.id.S) }
    if ($actual.Count -ne $expected.Count) { throw "Post-import count mismatch in '$table'." }
    foreach ($item in $expected) {
        if (-not $actual.Contains([string]$item.id.S)) { throw "Post-import ID missing from '$table': $($item.id.S)" }
    }
}
$manifest.status = 'Verified by table counts and IDs'
$manifest.completedUtc = [DateTime]::UtcNow.ToString('o')
Write-JsonFile -Path (Join-Path $backupDirectory 'manifest.json') -Value $manifest
Write-Host 'Import completed; table counts and IDs verified.'