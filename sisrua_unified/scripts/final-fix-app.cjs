const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add import
if (!content.includes('AppWorkspace')) {
    content = content.replace(
        'import { AppShellLayout } from "./components/AppShellLayout";',
        'import { AppShellLayout } from "./components/AppShellLayout";\nimport { AppWorkspace } from "./components/AppWorkspace";'
    );
}

// Replace return JSX
const returnRegex = /return \(\s*<>\s*<AppShellLayout.*?<\/>\s*\);\s*\}\s*export default App;/s;
if (returnRegex.test(content)) {
    content = content.replace(returnRegex, '  return (\n    <AppWorkspace\n      {...{\n        settings,\n        isDark,\n        isFocusMode,\n        isXRayMode,\n        canUndo,\n        canRedo,\n        undo,\n        redo,\n        appPast,\n        appFuture,\n        handleSaveProject,\n        handleLoadProject,\n        openSettings,\n        setIsHelpOpen,\n        toasts,\n        closeToast,\n        sessionDraft,\n        handleRestoreSession,\n        handleDismissSession,\n        isProcessing,\n        isDownloading,\n        progressValue,\n        statusMessage,\n        showDxfProgress,\n        dxfProgressValue,\n        dxfProgressStatus,\n        dxfProgressLabel,\n        latestBtExport,\n        btExportHistory,\n        exportBtHistoryJson,\n        exportBtHistoryCsv,\n        handleClearBtExportHistory,\n        btHistoryTotal,\n        btHistoryLoading,\n        btHistoryCanLoadMore,\n        handleLoadMoreBtHistory,\n        btHistoryProjectTypeFilter,\n        setBtHistoryProjectTypeFilter,\n        btHistoryCqtScenarioFilter,\n        setBtHistoryCqtScenarioFilter,\n        updateSettings,\n        selectionMode,\n        handleSelectionModeChange,\n        radius,\n        handleRadiusChange,\n        polygon,\n        handleClearPolygon,\n        osmData,\n        handleDownloadDxf,\n        handleDownloadGeoJSON,\n        isSidebarDockedForRamalModal,\n        sidebarSelectionControlsProps,\n        sidebarBtEditorSectionProps,\n        mtTopology,\n        updateMtTopology,\n        hasBtPoles,\n        sidebarAnalysisResultsProps,\n        mapSelectorProps,\n        elevationProfileData,\n        clearProfile,\n        btModalStackProps,\n        showToast,\n        isBimInspectorOpen,\n        setIsBimInspectorOpen,\n        inspectedPole,\n        inspectedTransformer,\n        inspectedAccumulatedData,\n        btTopology,\n        handleBtRenamePole,\n        handleBtSetPoleChangeFlag,\n        autoSaveStatus,\n        lastAutoSaved,\n        isAuditOpen,\n        setIsAuditOpen,\n        selectedAuditElement,\n        handleAuditAction,\n        btTelescopicSuggestions,\n        handleApplyTelescopicSuggestions,\n        clearBtTelescopicSuggestions,\n        isHelpOpen,\n        isCommandPaletteOpen,\n        setIsCommandPaletteOpen,\n        commandPaletteActions,\n        handleGoToPole,\n        terrainData,\n        showSettings,\n        closeSettings,\n      }}\n    />\n  );\n}\n\nexport default App;'
    );
}

fs.writeFileSync(filePath, content);
console.log('App.tsx JSX extracted to AppWorkspace.');
