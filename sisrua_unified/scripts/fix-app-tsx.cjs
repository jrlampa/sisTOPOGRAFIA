const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix imports
if (!content.includes('useAppBimInspector')) {
    content = content.replace(
        'import { useAppInspectedElement } from "./hooks/useAppInspectedElement";',
        'import { useAppInspectedElement } from "./hooks/useAppInspectedElement";\nimport { useAppBimInspector } from "./hooks/useAppBimInspector";'
    );
}

// Fix BIM Inspector
const bimRegex = /const \[isBimInspectorOpen, setIsBimInspectorOpen\].*?\[btAccumulatedByPole, selectedPoleId\]\s*\);/s;
if (bimRegex.test(content)) {
    content = content.replace(bimRegex, '  const { isBimInspectorOpen, setIsBimInspectorOpen, inspectedPole, inspectedTransformer, inspectedAccumulatedData } = useAppBimInspector({ selectedPoleId, selectedPoleIds, btTopology, btAccumulatedByPole });');
}

fs.writeFileSync(filePath, content);
console.log('App.tsx BIM Inspector fixed.');
