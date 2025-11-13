param(
  [Parameter(Mandatory=$true)] [string]$Owner,
  [Parameter(Mandatory=$true)] [string]$Repo,
  [Parameter(Mandatory=$true)] [string]$Tag,
  [Parameter(Mandatory=$false)] [string]$ReleaseName = $Tag,
  [Parameter(Mandatory=$false)] [string]$Body = "Automated upload",
  [Parameter(Mandatory=$false)] [string]$AssetPath = "dist\\my-tools-1.0.0.zip"
)

if (-not $env:GITHUB_TOKEN) {
  Write-Error "Please set the GITHUB_TOKEN environment variable with a Personal Access Token that has repo scope."
  exit 1
}

$token = $env:GITHUB_TOKEN
$headers = @{ Authorization = "token $token"; "User-Agent" = "upload-release-script" }

# Create release
$createUrl = "https://api.github.com/repos/$Owner/$Repo/releases"
$bodyObj = @{ tag_name = $Tag; name = $ReleaseName; body = $Body; draft = $false; prerelease = $false } | ConvertTo-Json

Write-Host "Creating release $Tag for $Owner/$Repo..."
$resp = Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -Body $bodyObj -ContentType 'application/json'

if (-not $resp.id) {
  Write-Error "Create release failed: $resp"
  exit 1
}

$uploadUrl = $resp.upload_url -replace '\{\?name,label\}',''
$assetName = [System.IO.Path]::GetFileName($AssetPath)
$uploadUri = "$uploadUrl?name=$assetName"

Write-Host "Uploading asset $assetName..."
$bytes = [System.IO.File]::ReadAllBytes($AssetPath)
Invoke-RestMethod -Method Post -Uri $uploadUri -Headers @{ Authorization = "token $token" } -Body $bytes -ContentType 'application/zip'

Write-Host "Upload complete. Release URL: $($resp.html_url)"
