@echo off
REM ============================================================================
REM clone-reference-docs.cmd
REM
REM Clones external vendor documentation / source repositories into
REM reference\vendor-docs\ for local AI-assisted development reference.
REM
REM These clones are gitignored. Do NOT add them to the FieldLog repo.
REM
REM Usage:
REM   From the repo root:  scripts\clone-reference-docs.cmd
REM ============================================================================

setlocal enableextensions

REM Remember where we were invoked from so we can return at the end.
set "ORIGINAL_DIR=%CD%"

REM Resolve repo root as the parent of this script's folder.
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.." >nul
if errorlevel 1 (
    echo [ERROR] Could not change to repo root from "%SCRIPT_DIR%".
    exit /b 1
)
set "REPO_ROOT=%CD%"
echo [INFO] Repo root: %REPO_ROOT%

set "TARGET_BASE=%REPO_ROOT%\reference\vendor-docs"
if not exist "%TARGET_BASE%" (
    echo [INFO] Creating %TARGET_BASE%
    mkdir "%TARGET_BASE%"
    if errorlevel 1 (
        echo [ERROR] Could not create %TARGET_BASE%.
        popd >nul
        cd /d "%ORIGINAL_DIR%"
        exit /b 1
    )
)

REM Verify git is available before doing anything else.
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] git is not on PATH. Install Git for Windows and retry.
    popd >nul
    cd /d "%ORIGINAL_DIR%"
    exit /b 1
)

set "FAILED="

REM --- Essential vendor docs only.
REM     PWA-related docs (vite-plugin-pwa, workbox) and MDN content are
REM     intentionally deferred until the offline/PWA work begins.

call :clone_one "https://github.com/reactjs/react.dev.git"                       "react.dev"
call :clone_one "https://github.com/vitejs/vite.git"                             "vite"
call :clone_one "https://github.com/microsoft/TypeScript-Website.git"            "TypeScript-Website"
call :clone_one "https://github.com/mui/material-ui.git"                         "material-ui"
call :clone_one "https://github.com/dexie/Dexie.js.git"                          "Dexie.js"
call :clone_one "https://github.com/react-hook-form/documentation.git"           "react-hook-form-documentation"
call :clone_one "https://github.com/react-hook-form/resolvers.git"               "react-hook-form-resolvers"
call :clone_one "https://github.com/colinhacks/zod.git"                          "zod"
call :clone_one "https://github.com/vitest-dev/vitest.git"                       "vitest"
call :clone_one "https://github.com/testing-library/testing-library-docs.git"    "testing-library-docs"

echo.
if defined FAILED (
    echo [WARN] Some clones failed:%FAILED%
    echo [WARN] Re-run the script to retry; existing clones will be skipped.
    set "EXIT_CODE=1"
) else (
    echo [DONE] All vendor docs are present under %TARGET_BASE%.
    set "EXIT_CODE=0"
)

popd >nul
cd /d "%ORIGINAL_DIR%"
endlocal & exit /b %EXIT_CODE%

REM ----------------------------------------------------------------------------
REM :clone_one <repo-url> <target-folder-name>
REM   Clones REPO_URL into reference\vendor-docs\TARGET_FOLDER_NAME with depth 1
REM   if the target does not already exist.
REM ----------------------------------------------------------------------------
:clone_one
set "REPO_URL=%~1"
set "TARGET_NAME=%~2"
set "TARGET_PATH=%TARGET_BASE%\%TARGET_NAME%"

echo.
echo [INFO] %TARGET_NAME%
if exist "%TARGET_PATH%" (
    echo        Already present at %TARGET_PATH% - skipping.
    goto :eof
)

echo        Cloning %REPO_URL%
echo        into    %TARGET_PATH%
git clone --depth 1 "%REPO_URL%" "%TARGET_PATH%"
if errorlevel 1 (
    echo [WARN] Clone failed for %TARGET_NAME%.
    set "FAILED=%FAILED% %TARGET_NAME%"
)
goto :eof
