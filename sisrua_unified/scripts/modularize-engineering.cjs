const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add new imports
if (!content.includes('useAppEngineeringWorkflows')) {
    content = content.replace(
        'import { useAppBimInspector } from "./hooks/useAppBimInspector";',
        'import { useAppBimInspector } from "./hooks/useAppBimInspector";\nimport { useAppEngineeringWorkflows } from "./hooks/useAppEngineeringWorkflows";\nimport { useAppTopologySources } from "./hooks/useAppTopologySources";'
    );
}

// 1. Replace Topology Sources Memos
const topologyRegex = /const mtTopology = React\.useMemo\(.*?const dgTopologySource = React\.useMemo<BtTopology>\(.*?\}\, \[mapRenderSources\.btMarkerTopology, btTopology\]\);/s;
if (topologyRegex.test(content)) {
    content = content.replace(topologyRegex, '  const { mtTopology, mapRenderSources, dgTopologySource } = useAppTopologySources({ appState, btTopology });');
}

// 2. Replace Engineering Workflows Logic
// This covers DG and Telescopic analysis
const engineeringRegex = /\/\*\* Resultados técnicos do último cenário DG aplicado.*?clearBtTelescopicSuggestions\(\);\s*\}\, \[settings\.btNetworkScenario, showToast, clearBtTelescopicSuggestions, btTopology, updateBtTopology\]\s*\);/s;
if (engineeringRegex.test(content)) {
    content = content.replace(engineeringRegex, '  const {\n    lastAppliedDgResults,\n    handleRunDgOptimization,\n    handleAcceptDgAll,\n    handleAcceptDgTrafoOnly,\n    handleDiscardDgResult,\n    handleTriggerTelescopicAnalysis,\n    handleApplyTelescopicSuggestions,\n  } = useAppEngineeringWorkflows({\n    dgTopologySource,\n    runDgOptimization,\n    dgResult,\n    logDgDecision,\n    dgActiveScenario,\n    setAppState,\n    applyDgAll,\n    applyDgTrafoOnly,\n    clearDgResult,\n    showToast,\n    findNearestMtPole,\n    updateBtTopology,\n    isBtTelescopicAnalyzing,\n    triggerBtTelescopicAnalysis,\n    btTopology,\n    btAccumulatedByPole,\n    btTransformerDebugById,\n    requestCriticalConfirmation,\n    settings,\n    clearBtTelescopicSuggestions,\n    btTelescopicSuggestions,\n  });');
}

// 3. Remove individual state/memo variables that are now in hooks
// (Some were already part of the regex above)

fs.writeFileSync(filePath, content);
console.log('App.tsx Engineering Workflows and Topology Sources extracted.');
