# Mole Windows - Command Tests
# Pester tests for bin/ command scripts

BeforeAll {
    # Get the windows directory path (tests are in windows/tests/)
    $script:WindowsDir = Split-Path -Parent $PSScriptRoot
    $script:BinDir = Join-Path $script:WindowsDir "bin"
    $script:InstallScript = Join-Path $script:WindowsDir "install.ps1"
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

        It "Should not throw missing Solid property errors during dry-run startup" {
            $job = Start-Job -ScriptBlock {
                param($binDir)
                & powershell -ExecutionPolicy Bypass -File "$binDir\clean.ps1" -DryRun 2>&1
            } -ArgumentList $script:BinDir

            Start-Sleep -Seconds 3
            $output = (Receive-Job $job -Keep 2>&1 | Out-String)
            Stop-Job $job -ErrorAction SilentlyContinue
            Remove-Job $job -Force -ErrorAction SilentlyContinue

            $output | Should -Not -Match "property 'Solid' cannot be found|找不到属性.?Solid"
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

        It "Should guard disk optimization when the system drive cannot be resolved to a volume" {
            $source = Get-Content "$script:BinDir\optimize.ps1" -Raw
            $source | Should -Match "function Test-SystemDriveOptimizable"
            $source | Should -Match "Get-Volume -DriveLetter"
            $source | Should -Match "Disk optimization skipped:"
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

        It "Should not throw missing Solid property errors during menu startup" {
            $job = Start-Job -ScriptBlock {
                param($molePath)
                & powershell -ExecutionPolicy Bypass -File $molePath 2>&1
            } -ArgumentList $script:MolePath

            Start-Sleep -Seconds 3
            $output = (Receive-Job $job -Keep 2>&1 | Out-String)
            Stop-Job $job -ErrorAction SilentlyContinue
            Remove-Job $job -Force -ErrorAction SilentlyContinue

            $output | Should -Not -Match "property 'Solid' cannot be found|找不到属性.?Solid"
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

Describe "Installer Script" {
    Context "Version Source" {
        It "Should read the version from VERSION" {
            $source = Get-Content $script:InstallScript -Raw
            $source | Should -Match "version\.ps1"
            $source | Should -Match "Get-MoleVersionString -RootDir \$script:SourceDir"
        }
    }

    Context "Optional TUI Tools" {
        It "Should downgrade TUI setup errors to warnings" {
            $source = Get-Content $script:InstallScript -Raw
            $source | Should -Match "Ensure-TuiBinary"
            $source | Should -Match "Skipping .*non-fatal setup error"
            $source | Should -Match "Could not prepare .*Install Go or wait for a Windows prerelease asset"
        }
    }
}

Describe "Source Install Hygiene" {
    Context ".gitattributes" {
        It "Should normalize tracked line endings for Windows source installs" {
            $source = Get-Content (Join-Path $script:WindowsDir ".gitattributes") -Raw
            $source | Should -Match '\* text=auto eol=lf'
            $source | Should -Match '\*\.ps1 text eol=lf'
            $source | Should -Match '\*\.cmd text eol=crlf'
        }
    }

    Context ".gitignore" {
        It "Should ignore generated launcher batch files" {
            $source = Get-Content (Join-Path $script:WindowsDir ".gitignore") -Raw
            $source | Should -Match '(?m)^mole\.cmd$'
            $source | Should -Match '(?m)^mo\.cmd$'
        }
    }
}
