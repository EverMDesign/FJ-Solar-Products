# Documentation Template

Use this template when creating new MD files for FJ Solar features/systems. Copy this structure and fill in the sections below.

---

# [Feature/System Name] — [Brief Tagline]

## Overview (User-Friendly)

**Purpose:** Explain what this feature does in plain language. Assume the reader is not a developer.

- What problem does it solve?
- How does the user interact with it?
- What's the benefit/result?
- Include a simple example or user journey

**Example structure:**
```
When a customer [does action], we automatically [capture/process/send] [data/message/action].
This lets you [benefit] and helps customers [experience].

What gets captured/processed:
- Item 1
- Item 2
- Item 3
```

---

## How It Works (Technical)

### 1. [System/Component Name]

**Purpose:** What does this part do?

Brief description of the component, then technical details:
- Key files
- Key variables/constants
- API calls
- Data structures

**Example:**
```javascript
const example = {
  fieldName: "value",
  // comment explaining
};
```

### 2. [Process/Flow Name]

**Purpose:** What happens here?

Include a diagram showing the flow:

```
Input
  ↓
[Step 1]
  ↓
[Step 2]
  ↓
[Step 3]
  ↓
Output
```

Or in table format:

| Step | What Happens | Key Files |
|------|--------------|-----------|
| 1 | Description | `src/file.ts` |
| 2 | Description | `src/file2.ts` |

### 3. [Related System Name]

Cross-reference other systems that connect to this one:
- How they interact
- What data passes between them
- Where to find more info

---

## Important Details

### [Gotcha/Consideration #1]
**Problem:** What can go wrong or what's unexpected?
**Why:** What causes this?
**Solution:** How do we handle it?

**Example:**
```
Problem: Field appears blank in email
Why: Template uses {{custom_values.X}} instead of {{contact.X}}
Solution: Always use {{contact.X}} for per-contact data
```

### [Gotcha/Consideration #2]
Same structure as above.

### [Environment/Configuration]
What env vars, settings, or credentials are needed?

```env
VAR_NAME=value          # What it does
VAR_NAME_2=value        # What it does
```

---

## Common Tasks

### Task 1: [Do something]
1. Step 1
2. Step 2
3. Step 3

### Task 2: [Do something else]
1. Step 1
2. Step 2
3. Verify with: [command or check]

---

## Testing Checklist

- [ ] Test case 1
- [ ] Test case 2
- [ ] Test case 3
- [ ] Verify logs show expected behavior
- [ ] Check [related system] also updated correctly

---

## Files & References

- **Primary file:** `src/path/to/main-file.ts` — What it does
- **Config file:** `config/file.ts` — How to configure
- **API endpoint:** `/api/endpoint` — Request/response structure
- **Related docs:** `docs/related-file.md` — Where to read more

---

## Troubleshooting

### Issue: [Common problem]
**Symptoms:** What you'd see
**Check:** How to diagnose
**Fix:** How to resolve

### Issue: [Another common problem]
Same structure as above.

---

## Next Steps / Future Improvements

- [ ] Improvement 1 (blocked by [reason] or listed in REVISIT.md)
- [ ] Improvement 2
- [ ] Related feature to build after this

