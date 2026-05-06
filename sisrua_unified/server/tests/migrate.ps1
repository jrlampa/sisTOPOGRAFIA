$files = Get-Content "sisrua_unified/server/tests/files_to_migrate.txt"
foreach ($file in $files) {
    $path = "sisrua_unified/server/tests/$file"
    if (!(Test-Path $path)) {
        Write-Host "File not found: $path"
        continue
    }
    
    $content = Get-Content $path -Raw
    
    # Replace import { jest } from "@jest/globals" with import { vi } from "vitest"
    # Also handle multiple imports like { describe, it, expect, jest }
    if ($content -match 'from "@jest/globals"') {
        $content = $content -replace 'import\s+\{(.*)jest(.*)\}\s+from\s+"@jest/globals"', 'import {$1vi$2} from "vitest"'
        $content = $content -replace 'from "@jest/globals"', 'from "vitest"'
    } elseif ($content -match "jest\." -and !($content -match 'import \{.*vi.*\} from "vitest"')) {
        # If jest is used but no vitest import, add it
        $content = "import { vi } from ""vitest"";`n" + $content
    }
    
    # Replace all jest occurrences with vi
    # Use word boundary to avoid replacing things like 'majestic'
    $content = $content -replace '\bjest\b', 'vi'
    
    Set-Content $path $content
    Write-Host "Migrated: $file"
}
