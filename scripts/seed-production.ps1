$ErrorActionPreference = 'Stop'

function Read-SecretValue {
    param([string]$Prompt)

    $secureValue = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$confirmation = Read-Host 'Nhap SEED de xac nhan ghi lai du lieu trong database ecommerce'
if ($confirmation -ne 'SEED') {
    Write-Host 'Da huy seed production.'
    exit 0
}

$mongoUri = Read-SecretValue 'Dan MONGO_URI Atlas'
if ($mongoUri -notmatch '^mongodb\+srv://' -or $mongoUri -notmatch '/ecommerce(?:\?|$)') {
    throw 'MONGO_URI phai la chuoi Atlas va tro den database ecommerce.'
}

$customerPassword = Read-SecretValue 'Nhap mat khau demo cho tai khoan khach (toi thieu 12 ky tu)'
$adminPassword = Read-SecretValue 'Nhap mat khau quan tri rieng (toi thieu 12 ky tu)'
if ($customerPassword.Length -lt 12 -or $adminPassword.Length -lt 12) {
    throw 'Mat khau seed phai co it nhat 12 ky tu.'
}

$env:MONGO_URI = $mongoUri
$env:SEED_CUSTOMER_PASSWORD = $customerPassword
$env:ADMIN_USERNAME = 'admin'
$env:ADMIN_EMAIL = 'admin@techecommerce.vn'
$env:ADMIN_PASSWORD = $adminPassword

try {
    npm run seed
    if ($LASTEXITCODE -ne 0) { throw 'Seed san pham va khach hang that bai.' }

    npm run seed:admin
    if ($LASTEXITCODE -ne 0) { throw 'Seed tai khoan quan tri that bai.' }

    npm --prefix backend run seed:features
    if ($LASTEXITCODE -ne 0) { throw 'Seed ma giam gia va danh gia that bai.' }

    npm run seed:gaming
    if ($LASTEXITCODE -ne 0) { throw 'Seed san pham may choi game that bai.' }

    Write-Host 'Seed production thanh cong.' -ForegroundColor Green
}
finally {
    Remove-Item Env:MONGO_URI -ErrorAction SilentlyContinue
    Remove-Item Env:SEED_CUSTOMER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
