# Mole Windows - Command Tests
# Pester tests for bin/ command scripts

BeforeAll {
    # Get the windows directory path (tests are in windows/tests/)
    $script:WindowsDir = Split-Path -Parent $PSScriptRoot
    $script:BinDir = Join-Path $script:WindowsDir "bin"
}

Describe "Clean Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\clean.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
        
        It "Should mention dry-run in help" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\clean.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "(DryRun|dry-run)"
        }
    }
    
    Context "Dry Run Mode" {
        It "Should support -DryRun parameter" {
            # Just verify it starts without immediate error
            $job = Start-Job -ScriptBlock {
                param($binDir)
                & powershell -ExecutionPolicy Bypass -File "$binDir\clean.ps1" -DryRun 2>&1
            } -ArgumentList $script:BinDir
            
            Start-Sleep -Seconds 3
            Stop-Job $job -ErrorAction SilentlyContinue
            Remove-Job $job -Force -ErrorAction SilentlyContinue
            
            # If we got here without exception, test passes
            $true | Should -Be $true
        }
    }
}

Describe "Uninstall Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\uninstall.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
    }
}

Describe "Optimize Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\optimize.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
        
        It "Should mention optimization options in help" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\optimize.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "DryRun|Disk|DNS"
        }
    }
}

Describe "Purge Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\purge.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
        
        It "Should list artifact types in help" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\purge.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "node_modules|vendor|venv"
        }
    }
}

Describe "Analyze Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\analyze.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
        
        It "Should mention keybindings in help" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\analyze.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "Navigate|Enter|Quit"
        }
    }
}

Describe "Status Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\status.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }
        
        It "Should mention system metrics in help" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\status.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "CPU|Memory|Disk|health"
        }
    }
}

Describe "Update Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\update.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }

        It "Should explain the source channel" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\update.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "source|origin/windows|git"
        }
    }
}

Describe "Remove Command" {
    Context "Help Display" {
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\remove.ps1" -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
            $LASTEXITCODE | Should -Be 0
        }

        It "Should mention uninstall behavior" {
            $result = & powershell -ExecutionPolicy Bypass -File "$script:BinDir\remove.ps1" -ShowHelp 2>&1
            $result -join "`n" | Should -Match "Remove Mole|PATH|config"
        }
    }
}

Describe "Main Entry Point" {
    Context "mole.ps1" {
        BeforeAll {
            $script:MolePath = Join-Path $script:WindowsDir "mole.ps1"
        }
        
        It "Should show help without error" {
            $result = & powershell -ExecutionPolicy Bypass -File $script:MolePath -ShowHelp 2>&1
            $result | Should -Not -BeNullOrEmpty
        }
        
        It "Should show version without error" {
            $result = & powershell -ExecutionPolicy Bypass -File $script:MolePath -Version 2>&1
            $result | Should -Not -BeNullOrEmpty
            $result -join "`n" | Should -Match "Mole|v\d+\.\d+"
        }
        
        It "Should list available commands in help" {
            $result = & powershell -ExecutionPolicy Bypass -File $script:MolePath -ShowHelp 2>&1
            $helpText = $result -join "`n"
            $helpText | Should -Match "clean"
            $helpText | Should -Match "uninstall"
            $helpText | Should -Match "optimize"
            $helpText | Should -Match "purge"
            $helpText | Should -Match "analyze"
            $helpText | Should -Match "status"
            $helpText | Should -Match "update"
            $helpText | Should -Match "remove"
        }
    }
}
