@echo off
REM ============================================================================
REM build.bat - Build the 64-bit Windows tiki100.exe using w64devkit.
REM
REM Usage:
REM   build.bat              - release build (default)
REM   build.bat debug        - debug build
REM   build.bat clean        - delete build_release\ and build\
REM
REM Requirements:
REM   - w64devkit (64-bit) extracted somewhere on disk.
REM     Default path: C:\Utils\w64devkit
REM     Override by setting the W64DEVKIT env var before running this script:
REM       set W64DEVKIT=D:\tools\w64devkit
REM       build.bat
REM
REM This script does NOT permanently modify your PATH. It only prepends
REM w64devkit\bin for the duration of this build.
REM ============================================================================

setlocal enableextensions enabledelayedexpansion

REM --- Locate w64devkit ------------------------------------------------------
if "%W64DEVKIT%"=="" set "W64DEVKIT=C:\Utils\w64devkit"

if not exist "%W64DEVKIT%\bin\gcc.exe" (
    echo ERROR: w64devkit not found at "%W64DEVKIT%".
    echo.
    echo Either install w64devkit there, or point this script at your install:
    echo     set W64DEVKIT=D:\path\to\w64devkit
    echo     build.bat
    exit /b 1
)

REM Prepend w64devkit\bin so gcc, make, cmake, ninja, sh, pkg-config
REM resolve to w64devkit first (ahead of any other MinGW / MSYS2 / Cygwin
REM installs already on PATH).
set "PATH=%W64DEVKIT%\bin;%PATH%"

REM --- Sanity-check the toolchain --------------------------------------------
where gcc  >nul 2>&1 || ( echo ERROR: gcc not found on PATH after adding w64devkit. & exit /b 1 )
where make >nul 2>&1 || ( echo ERROR: make not found on PATH after adding w64devkit. & exit /b 1 )
where sh   >nul 2>&1 || ( echo ERROR: sh not found on PATH after adding w64devkit. & exit /b 1 )

echo.
echo Using w64devkit at: %W64DEVKIT%
for /f "tokens=*" %%v in ('gcc --version ^| findstr /r "^gcc"') do echo   %%v
echo.

REM --- Pick the target -------------------------------------------------------
set "TARGET=release"
if /i "%~1"=="debug"   set "TARGET=debug"
if /i "%~1"=="release" set "TARGET=release"
if /i "%~1"=="clean"   set "TARGET=clean"

if "%TARGET%"=="clean" (
    echo Cleaning build directories...
    make clean
    if errorlevel 1 exit /b 1
    echo Done.
    exit /b 0
)

REM --- Fetch SDL2 if missing -------------------------------------------------
if not exist external\SDL2 (
    echo external\SDL2 not found. Fetching SDL2 MinGW devel release...
    make fetch-sdl2
    if errorlevel 1 (
        echo ERROR: SDL2 fetch failed.
        exit /b 1
    )
    echo.
)

REM --- Build -----------------------------------------------------------------
echo Building %TARGET%...
make %TARGET%
if errorlevel 1 (
    echo.
    echo BUILD FAILED.
    exit /b 1
)

REM --- Stage SDL2.dll next to the executable ---------------------------------
if "%TARGET%"=="release" (
    set "OUTDIR=build_release\bin"
) else (
    set "OUTDIR=build\bin"
)

set "SDL_DLL=external\SDL2\x86_64-w64-mingw32\bin\SDL2.dll"
if not exist "%SDL_DLL%" (
    echo WARNING: %SDL_DLL% not found - cannot stage SDL2.dll next to exe.
    echo The executable will not run without it.
) else (
    REM Try to copy. If the destination is locked (e.g. previous tiki100.exe
    REM still running, or Windows Defender holding a handle), fall back to
    REM accepting the existing copy — it's almost certainly the same DLL.
    copy /Y "%SDL_DLL%" "%OUTDIR%\" >nul 2>nul
    if errorlevel 1 (
        if exist "%OUTDIR%\SDL2.dll" (
            echo Note: could not overwrite %OUTDIR%\SDL2.dll ^(locked^); keeping existing copy.
        ) else (
            echo ERROR: failed to copy SDL2.dll into %OUTDIR%.
            exit /b 1
        )
    )
)

echo.
echo ============================================================
echo Build complete.
echo   Binary:   %OUTDIR%\tiki100.exe
echo   Runtime:  %OUTDIR%\SDL2.dll
echo.
echo Run it:
echo   Boot from floppy:
echo     %OUTDIR%\tiki100.exe -diska disks\boot\tiko_kjerne_v4.01.dsk
echo   Boot with both hard disks mounted:
echo     %OUTDIR%\tiki100.exe -hd0 disks\hdd\HD0.dsk -hd1 disks\hdd\HD1.dsk
echo ============================================================

endlocal
