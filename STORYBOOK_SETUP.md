# 🎭 STORYBOOK SETUP & VISUAL AUDIT CHECKLIST

## 1️⃣ STORYBOOK INSTALLATION & CONFIGURATION

### Passo 1: Install Storybook

```bash
cd sisrua_unified
npx storybook@latest init --type react --typescript
```

### Passo 2: Create .storybook/main.ts

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.ts", "../src/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
    "@storybook/addon-viewport",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
```

### Passo 3: Create .storybook/preview.ts

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/index.css";
import { THEME_TOKENS } from "../src/theme/tokens";

const preview: Preview = {
  parameters: {
    layout: "centered",
    docs: {
      source: {
        type: "code",
      },
    },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "900px" },
          type: "desktop",
        },
      },
    },
  },

  decorators: [
    (story) => (
      <div className="min-h-screen bg-app-shell-bg text-app-shell-fg">
        {story()}
      </div>
    ),
  ],

  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "sunlight", title: "Sunlight" },
        ],
      },
    },
  },
};

export default preview;
```

---

## 2️⃣ STORYBOOK STORIES EXAMPLES

### Button.stories.tsx

```tsx
// src/components/ui/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Save, LogOut, AlertCircle } from "lucide-react";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      options: ["primary", "secondary", "ghost", "danger"],
      control: "select",
    },
    size: {
      options: ["sm", "md", "lg"],
      control: "select",
    },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── PRIMARY VARIANT ────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    children: "Save Project",
    variant: "primary",
    size: "md",
  },
};

export const PrimarySmall: Story = {
  args: {
    children: "Submit",
    variant: "primary",
    size: "sm",
  },
};

export const PrimaryLarge: Story = {
  args: {
    children: "Get Started",
    variant: "primary",
    size: "lg",
  },
};

export const PrimaryWithIcon: Story = {
  args: {
    children: "Save",
    variant: "primary",
    icon: <Save size={18} />,
  },
};

export const PrimaryLoading: Story = {
  args: {
    children: "Processing...",
    variant: "primary",
    isLoading: true,
  },
};

// ─── SECONDARY VARIANT ─────────────────────────────────────────────────────

export const Secondary: Story = {
  args: {
    children: "Cancel",
    variant: "secondary",
    size: "md",
  },
};

// ─── GHOST VARIANT ─────────────────────────────────────────────────────────

export const Ghost: Story = {
  args: {
    children: "More options",
    variant: "ghost",
  },
};

// ─── DANGER VARIANT ────────────────────────────────────────────────────────

export const Danger: Story = {
  args: {
    children: "Delete Project",
    variant: "danger",
    icon: <AlertCircle size={18} />,
  },
};

export const DangerLoading: Story = {
  args: {
    children: "Deleting...",
    variant: "danger",
    isLoading: true,
  },
};

// ─── DISABLED STATE ────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    children: "Feature Unavailable",
    variant: "primary",
    disabled: true,
  },
};

// ─── ALL VARIANTS ─────────────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};
```

### Input.stories.tsx

```tsx
// src/components/ui/Input.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";
import { Mail, Lock } from "lucide-react";
import React from "react";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    required: true,
  },
};

export const WithHint: Story = {
  args: {
    label: "Password",
    type: "password",
    hint: "Must be at least 8 characters",
  },
};

export const WithError: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    error: "This email is already in use",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    icon: <Mail size={18} />,
    iconPosition: "left",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Input",
    placeholder: "Cannot edit",
    disabled: true,
  },
};

export const MultipleErrors: Story = {
  args: {
    label: "Password",
    type: "password",
    error: [
      "Must contain at least one uppercase letter",
      "Must contain at least one number",
    ],
  },
};
```

### Badge.stories.tsx

```tsx
// src/components/ui/Badge.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    severity: {
      options: ["ok", "warn", "critical", "neutral"],
      control: "select",
    },
    size: {
      options: ["sm", "md"],
      control: "select",
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ok: Story = {
  args: {
    severity: "ok",
    icon: <CheckCircle2 size={14} />,
    children: "Installation Successful",
  },
};

export const Warning: Story = {
  args: {
    severity: "warn",
    icon: <AlertTriangle size={14} />,
    children: "Pending Review",
  },
};

export const Critical: Story = {
  args: {
    severity: "critical",
    icon: <AlertCircle size={14} />,
    children: "Connection Error",
  },
};

export const AllSeverities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge severity="ok" icon={<CheckCircle2 size={14} />}>
        Success
      </Badge>
      <Badge severity="warn" icon={<AlertTriangle size={14} />}>
        Warning
      </Badge>
      <Badge severity="critical" icon={<AlertCircle size={14} />}>
        Error
      </Badge>
      <Badge severity="neutral">Neutral</Badge>
    </div>
  ),
};
```

---

## 3️⃣ DESIGN TOKENS STORY

```tsx
// src/stories/DesignTokens.stories.tsx
import type { Meta } from "@storybook/react";
import { THEME_TOKENS } from "../theme/tokens";

const meta = {
  title: "Design Tokens/Colors",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

export const ColorPalette = () => {
  const tokens = THEME_TOKENS.light;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Color Tokens</h1>

      {/* Brand Colors */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Brand Colors</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div
              className="w-24 h-24 rounded-lg"
              style={{ backgroundColor: "#3b82f6" }}
            />
            <p className="text-sm mt-2">Brand 500</p>
            <code className="text-xs text-gray-500">#3b82f6</code>
          </div>
          <div>
            <div
              className="w-24 h-24 rounded-lg"
              style={{ backgroundColor: "#2563eb" }}
            />
            <p className="text-sm mt-2">Brand 600</p>
            <code className="text-xs text-gray-500">#2563eb</code>
          </div>
          <div>
            <div
              className="w-24 h-24 rounded-lg"
              style={{ backgroundColor: "#1d4ed8" }}
            />
            <p className="text-sm mt-2">Brand 700</p>
            <code className="text-xs text-gray-500">#1d4ed8</code>
          </div>
        </div>
      </section>

      {/* Severity Colors */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Severity Scale</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Success", color: "#16a34a" },
            { label: "Warning", color: "#d97706" },
            { label: "Critical", color: "#dc2626" },
          ].map((item) => (
            <div key={item.label}>
              <div
                className="w-24 h-24 rounded-lg"
                style={{ backgroundColor: item.color }}
              />
              <p className="text-sm mt-2">{item.label}</p>
              <code className="text-xs text-gray-500">{item.color}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Glass Effects */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Glass Effects</h2>
        <div className="space-y-4">
          {Object.entries(tokens)
            .filter(([key]) => key.includes("glass"))
            .map(([key, value]) => (
              <div key={key} className="p-4 bg-gray-100 rounded">
                <p className="font-mono text-sm">{key}</p>
                <code className="text-xs text-gray-600">{value}</code>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
};
```

---

## 4️⃣ VISUAL AUDIT CHECKLIST

### ✅ Spacing Consistency Audit

```
[ ] Padding in buttons is consistent (4-2, 4-3, 6-3)
[ ] Gap between elements follows scale (8px, 16px, 24px)
[ ] Section margins are consistent
[ ] Modal/Panel padding is uniform
[ ] Card internal spacing is consistent
```

### ✅ Typography Consistency

```
[ ] Headings use correct sizes (h1: 32px, h2: 28px, h3: 24px)
[ ] Body text is 14-16px
[ ] Labels are 12-13px
[ ] Font weights match design (400, 500, 600, 700)
[ ] Line height is appropriate (1.4-1.6 for body)
[ ] Font families match design (Chakra Petch for UI, Plus Jakarta Sans for body)
```

### ✅ Color Consistency

```
[ ] Primary actions use brand-600
[ ] Hover states use brand-700
[ ] Disabled states use opacity: 50%
[ ] Severity colors are consistent (ok, warn, critical)
[ ] Glass components use correct backdrop blur
[ ] Text contrast meets WCAG AA (4.5:1)
```

### ✅ Border & Shadow Consistency

```
[ ] Border radius matches (24px cards, 12px panels, 8px chips)
[ ] Shadows follow elevation system
[ ] Focus rings are visible (2px ring-offset-1)
[ ] Border colors match tokens
[ ] Hover shadow increases
```

### ✅ Component State Consistency

```
[ ] Enabled state: normal style
[ ] Hover state: lighter background or shadow
[ ] Active/pressed state: darker or scale down
[ ] Disabled state: opacity 50%, cursor: not-allowed
[ ] Loading state: spinner + disabled appearance
[ ] Error state: red border + error message
[ ] Focus state: 2px ring with offset
```

### ✅ Responsive Consistency

```
[ ] Mobile: single column, full width buttons
[ ] Tablet: 2-column layout
[ ] Desktop: multi-column optimized
[ ] Breakpoints: xs (320), sm (640), md (768), lg (1024), xl (1280)
[ ] Touch targets minimum 44x44px mobile
[ ] Font sizes scale appropriately
```

### ✅ Accessibility

```
[ ] Color not sole conveyor of information
[ ] Contrast ratio >= 4.5:1 (AA)
[ ] Contrast ratio >= 7:1 (AAA) for critical elements
[ ] Focus visible on all interactive elements
[ ] ARIA labels on icon buttons
[ ] Form labels associated with inputs
[ ] Error messages linked to inputs
[ ] Skip navigation links present
```

### ✅ Animation & Motion

```
[ ] Animations disabled with prefers-reduced-motion
[ ] Transitions are under 300ms
[ ] Loading spinners indicate progress
[ ] Page transitions are smooth
[ ] Hover feedback is immediate
[ ] Animation easing is appropriate (ease-out for entry)
```

### ✅ Feedback & Validation

```
[ ] Error messages are visible and helpful
[ ] Success messages confirm action
[ ] Loading indicators show progress
[ ] Toast notifications auto-close
[ ] Form validation provides inline feedback
[ ] Disabled reasons are explained
```

### ✅ Dark Mode Consistency

```
[ ] All colors have dark mode variants
[ ] Contrast is maintained in dark mode
[ ] Text is readable (not too bright)
[ ] Glass effects work in dark mode
[ ] Images have appropriate backgrounds
```

### ✅ Sunlight Mode (High Contrast)

```
[ ] Pure black text on white background
[ ] No blur effects (accessibility)
[ ] Yellow highlights for focus
[ ] High visibility borders
[ ] Large touch targets
```

---

## 5️⃣ STORYBOOK RUN COMMANDS

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build",
    "test:a11y": "npx axe-core --help"
  }
}
```

### Run Storybook

```bash
npm run storybook
# Opens at http://localhost:6006
```

### Build Storybook

```bash
npm run storybook:build
# Creates static/dist
```

### Deploy to Vercel/Netlify

```bash
vercel --prod
# ou
netlify deploy --prod --dir=storybook-static
```

---

## 6️⃣ ACCESSIBILITY TESTING IN STORYBOOK

### Install Addon

```bash
npm install -D @storybook/addon-a11y axe-core
```

### Features

- 🎯 Detects accessibility violations
- 📊 Highlight regions
- 🔍 Inspect accessibility tree
- ⚡ Real-time feedback

### Access Tests

1. Open Storybook
2. Click "Accessibility" tab
3. Review violations
4. Fix issues in component

---

## 📋 NEXT STEPS

1. **Week 1:** Setup Storybook + create 5-10 core components
2. **Week 2:** Write stories for all components
3. **Week 3:** Run a11y audit + fix violations
4. **Week 4:** Document design system in Storybook
5. **Ongoing:** Add stories for new components automatically

---

**Status:** Ready for implementation  
**Estimated Time:** 20-30 hours for complete Storybook setup  
**Benefit:** 50% faster component review + visual regression testing
