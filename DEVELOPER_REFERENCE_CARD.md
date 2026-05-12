# ⚡ UI/UX DEVELOPER REFERENCE CARD - QUICK CHECKLIST

**Print this. Keep it handy. Reference daily.**

---

## 🎨 COMPONENT PATTERN CHECKLIST

### Every Button Should Have:

- [ ] `variant`: 'primary' | 'secondary' | 'ghost' | 'danger'
- [ ] `size`: 'sm' | 'md' | 'lg'
- [ ] `isLoading` state with spinner
- [ ] `disabled` state with `cursor-not-allowed`
- [ ] `focus-visible:ring-2` focus indicator
- [ ] Hover scale animation (with reduced motion check)
- [ ] Icon support (optional)
- [ ] Proper ARIA labels

### Every Input Should Have:

- [ ] Associated `<label>`
- [ ] Clear `placeholder`
- [ ] Error state styling + error message
- [ ] Optional `hint` text for guidance
- [ ] `required` visual indicator (\*)
- [ ] Icon support (with position: left/right)
- [ ] Disabled state styling
- [ ] Focus ring styling
- [ ] Type-specific attributes (type, pattern, etc.)

### Every Interactive Element Needs:

- [ ] `aria-label` OR meaningful text content
- [ ] `focus-visible:ring-2 focus-visible:ring-brand-500`
- [ ] `hover:` state (visual feedback)
- [ ] `active:` state (press feedback)
- [ ] `disabled:` state if applicable
- [ ] `transition-colors duration-200`

---

## 🎯 SPACING SCALE (Use ONLY these values)

```
xs: 4px   (tight spacing, form elements)
sm: 8px   (gap between adjacent items)
md: 16px  (normal section spacing)
lg: 24px  (major section separation)
xl: 32px  (page-level margins)

EXAMPLE:
<div className="flex gap-md p-lg space-y-sm">
  Use space-y for vertical stacking
  Use gap for flex layouts
</div>
```

---

## 📝 TYPOGRAPHY SCALE (Use ONLY these values)

```
Display Large:   32px | 700 weight | Chakra Petch
Display Medium:  28px | 600 weight | Chakra Petch

Heading Large:   24px | 600 weight | Chakra Petch
Heading Medium:  20px | 600 weight | Chakra Petch
Heading Small:   16px | 600 weight | Chakra Petch

Body Large:      16px | 400 weight | Plus Jakarta Sans
Body Medium:     14px | 400 weight | Plus Jakarta Sans
Body Small:      12px | 400 weight | Plus Jakarta Sans

UI Large:        14px | 500 weight | Chakra Petch
UI Medium:       12px | 500 weight | Chakra Petch
UI Small:        11px | 500 weight | Chakra Petch
```

---

## 🎨 COLOR RULES

```
✅ DO:
- Use brand-600 for primary actions
- Use brand-700 for hover states
- Use severity-ok/warn/critical for status
- Use opacity-50 for disabled states
- Use glass-* tokens for panels/modals

❌ DON'T:
- Use arbitrary colors (always use tokens)
- Use color as only indicator (add icons/text)
- Mix color themes in one component
- Forget to test dark mode variant
- Ignore contrast ratio (min 4.5:1)
```

---

## ♿ ACCESSIBILITY QUICK RULES

```
Every Interactive Element:
[ ] Has focus visible indicator
[ ] Has aria-label or meaningful text
[ ] Can be triggered with keyboard
[ ] Escape key closes modals/drawers
[ ] Tab order is logical

Every Form:
[ ] Label associated with input (htmlFor)
[ ] Error message linked to input (aria-describedby)
[ ] Required field marked visually
[ ] Validation errors visible inline

Every Page:
[ ] Skip to main content link
[ ] Proper heading hierarchy (h1 > h2 > h3)
[ ] Semantic HTML (header, main, aside, footer)
[ ] Color contrast >= 4.5:1

Every Icon Button:
[ ] Has aria-label="what it does"
[ ] NOT just aria-label="button"
[ ] Example: aria-label="Close dialog"

Every Image:
[ ] Has descriptive alt text
[ ] NOT empty alt (alt="") for decorative images
```

---

## 🚀 COMMON PATTERNS

### Button with Icon

```tsx
<Button variant="primary" size="md" icon={<Save size={18} />}>
  Save Changes
</Button>
```

### Form Field

```tsx
<FormField
  label="Email"
  error={errors.email?.message}
  hint="We'll never share your email"
  required
>
  <Input type="email" placeholder="you@example.com" {...register("email")} />
</FormField>
```

### Toast Notification

```tsx
const { addToast } = useToast();
addToast({
  type: "success",
  title: "Success!",
  message: "Your project was saved.",
  autoClose: 5000,
});
```

### Accessible Modal

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Confirm Action"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Are you sure?</h2>
  {/* Content */}
  <div className="flex gap-md justify-end">
    <Button variant="secondary" onClick={onClose}>
      Cancel
    </Button>
    <Button variant="danger" onClick={onConfirm}>
      Delete
    </Button>
  </div>
</Modal>
```

---

## 🎬 ANIMATION RULES

```
✅ DO:
- Reduce motion when prefers-reduced-motion is set
- Keep animations under 300ms
- Use ease-out for entry animations
- Provide immediate feedback on interaction

❌ DON'T:
- Animate on prefers-reduced-motion: reduce
- Use 500ms+ transitions
- Animate layout changes (causes jank)
- Disable animations without user control
```

### Check Reduced Motion

```tsx
const prefersReducedMotion = useReducedMotion();

<motion.button
  whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
  whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
>
  Click me
</motion.button>;
```

---

## 📱 RESPONSIVE BREAKPOINTS

```
xs: 320px  (min-width: 320px)
sm: 640px  (min-width: 640px)
md: 768px  (min-width: 768px)
lg: 1024px (min-width: 1024px)
xl: 1280px (min-width: 1280px)

USAGE:
<div className="hidden md:block"> {/* Hidden on mobile, shown on tablet+ */}
<div className="text-sm md:text-base lg:text-lg"> {/* Scaling text */}
<div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"> {/* Responsive grid */}
```

---

## 🔍 VALIDATION FEEDBACK PATTERN

```
Default:     Clean input, no message
Focused:     Blue ring, helpful hint below
Typing:      Real-time validation (green check if valid)
Error:       Red ring, red error message, icon
Disabled:    Gray, cursor: not-allowed

RULE: Provide feedback BEFORE form submission
```

---

## 🎯 DARK MODE CHECKLIST

Every component should work in both:

- [ ] Light mode (current default)
- [ ] Dark mode (use dark: prefix)
- [ ] Sunlight mode (high contrast)

```tsx
<div
  className="
  bg-white dark:bg-slate-900 sunlight:bg-white
  text-black dark:text-white sunlight:text-black
  border-gray-200 dark:border-gray-700 sunlight:border-black
"
>
  Content
</div>
```

---

## 🚨 ERROR STATES - CONSISTENT MESSAGING

```
Generic "Something went wrong" → NEVER
Specific error messages → ALWAYS

EXAMPLES:
✅ "Email already in use. Use a different email or sign in."
✅ "Connection timeout. Check your internet and try again."
✅ "File too large. Maximum 10MB allowed."

RULE: Every error should tell user:
1. WHAT went wrong
2. WHY it happened
3. HOW to fix it
```

---

## ✨ LOADING STATES - VISUAL FEEDBACK

```
Button loading:    Show spinner, disable interaction
Form loading:      Skeleton placeholders
Data loading:      Progressive render (show what's ready)
Long operations:   Progress bar + estimated time
Background tasks:  Subtle indicator (no interruption)

RULE: User should ALWAYS know something is happening
```

---

## 🧪 BROWSER TESTING CHECKLIST

Before submitting PR:

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)
- [ ] Keyboard navigation only
- [ ] Screen reader (NVDA/JAWS)
- [ ] Dark mode enabled
- [ ] High contrast mode
- [ ] Sunlight/high contrast theme

---

## 🎨 DESIGN TOKEN REFERENCE

### Glass Effect Tokens

```
--glass-bg:            Semi-transparent background
--glass-border:        Border color for glass
--glass-shadow:        Elevation shadow
--glass-blur-strong:   24px (deep dialogs)
--glass-blur-medium:   16px (cards/panels)
--glass-blur-soft:     12px (overlays)
```

### Semantic Colors

```
Brand:     #3b82f6 (primary actions)
Ok:        #16a34a (success/valid)
Warn:      #d97706 (warning/attention)
Critical:  #dc2626 (error/danger)
Neutral:   #64748b (secondary)
```

### Z-Index Stack

```
flat:      0    (base background)
raised:    10   (cards, panels)
floating:  20   (tooltips, popovers)
sticky:    30   (headers, nav)
modal:     40   (dialogs, drawers)
```

---

## 🐛 COMMON MISTAKES TO AVOID

```
❌ Using arbitrary colors instead of tokens
❌ Inconsistent spacing (gap-2 and gap-4 mixed)
❌ Missing aria-label on icon buttons
❌ Buttons without focus ring
❌ Forms without associated labels
❌ Color as only indicator of status
❌ Animations that can't be disabled
❌ Hover states that aren't keyboard-accessible
❌ Modals without focus trap
❌ Error messages without fix guidance
❌ Missing skip link on page
❌ Text that's too small (<12px)
❌ Lines of text wider than 65 characters
❌ Disabled buttons that aren't obviously disabled
❌ Unsemantic HTML (div instead of button)
```

---

## 📊 DAILY CHECKLIST (Before commit)

- [ ] Component has consistent props with similar components
- [ ] Spacing uses xs/sm/md/lg/xl scale only
- [ ] Typography follows the scale (display/heading/body/ui)
- [ ] Colors use design tokens (not arbitrary)
- [ ] Interactive elements have focus indicators
- [ ] Dark mode variant tested
- [ ] Mobile responsive (tested at 375px width)
- [ ] All text >= 12px
- [ ] Color contrast >= 4.5:1
- [ ] Keyboard navigation works
- [ ] Error states provide clear feedback
- [ ] Loading states show progress
- [ ] No console warnings
- [ ] Component documented in Storybook

---

## 🎯 PRIORITY IMPLEMENTATION ORDER

**Week 1:** Button, Input, Card, Badge components  
**Week 2:** Modal, Drawer, Skeleton, FormError components  
**Week 3:** Toast system, Error boundary  
**Week 4:** Mobile drawer navigation  
**Week 5:** Accessibility audit + fixes  
**Week 6-8:** Polish, testing, documentation

---

## 🔗 QUICK LINKS

- **Design Tokens:** `src/theme/tokens.ts`
- **Motion Config:** `src/theme/motion.ts`
- **Tailwind Config:** `tailwind.config.js`
- **UI Components:** `src/components/ui/` (create this folder)
- **Hooks:** `src/hooks/` (add accessibility hooks here)

---

## 📞 WHEN IN DOUBT

1. **Check existing components** - Find similar component, match pattern
2. **Check Storybook** - See how it's documented
3. **Check tokens.ts** - Use design tokens, not arbitrary values
4. **Check accessibility guide** - Follow WCAG 2.1 AA minimum
5. **Ask in code review** - Team consensus on new patterns

---

## 🏁 DONE DEFINITION

A component is done when:

- ✅ Works in all browsers
- ✅ Works with keyboard only
- ✅ Works with screen reader
- ✅ Passes accessibility audit
- ✅ Works on mobile (375px+)
- ✅ Works in dark mode
- ✅ Works in sunlight/high-contrast mode
- ✅ Documented in Storybook
- ✅ Has error/loading/disabled states
- ✅ Code reviewed and approved

---

**Print this. Keep it visible. Reference daily.** 🚀

Last updated: May 11, 2026
