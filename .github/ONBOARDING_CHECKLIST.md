# GitHub Copilot Onboarding Checklist

Use this checklist when starting work on the AI Use Case Navigator project with GitHub Copilot.

## 🎯 Pre-Development (Day 1)

### Understanding the Project

* [ ] Read [README.md](../../README.md) - 5 minutes
* [ ] Read [.github/SETUP_COMPLETE.md](SETUP_COMPLETE.md) - 5 minutes
* [ ] Read [.github/copilot-instructions.md](copilot-instructions.md) - 10 minutes
* [ ] Skim [.github/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) - 5 minutes
* [ ] Bookmark [.github/COPILOT_QUICK_REFERENCE.md](COPILOT_QUICK_REFERENCE.md) for later

**Time invested: ~25 minutes**

### Environment Setup

* [ ] Install Node.js 18+ (`node --version`)
* [ ] Install npm 9+ (`npm --version`)
* [ ] Download PocketBase binary from [pocketbase.io](https://pocketbase.io)
* [ ] Place PocketBase in `pocketbase/` folder
* [ ] Clone repository (or already have it)
* [ ] Open project in VS Code

### GitHub Copilot Setup

* [ ] Install GitHub Copilot extension in VS Code
* [ ] Install GitHub Copilot Chat extension (optional but recommended)
* [ ] Sign in with GitHub account
* [ ] Verify Copilot is working (`Ctrl+I` in editor)

**Time invested: ~10 minutes**

---

## 🚀 First Run (Getting Started)

### Start PocketBase Backend

```bash
cd pocketbase
./pocketbase serve  # Windows: .\pocketbase.exe serve
```

* [ ] Terminal shows "serving at http://127.0.0.1:8090"
* [ ] Visit http://127.0.0.1:8090/_ and create admin account
* [ ] Keep terminal running in background

**Time invested: ~5 minutes**

### Start Frontend Development Server

```bash
cd frontend
npm install
npm run dev
```

* [ ] Terminal shows "Local: http://localhost:5173"
* [ ] Browser opens to http://localhost:5173
* [ ] Page loads without errors
* [ ] Keep terminal running in background

**Time invested: ~3 minutes (first time), 1 minute (subsequent)**

### Verify Setup

* [ ] Frontend loads without errors
* [ ] Can see dashboard or empty state
* [ ] Browser console has no red errors
* [ ] Both terminals still running

**Time invested: ~2 minutes**

---

## 📖 Deep Dive (Day 1-2)

### Understanding Architecture

* [ ] Read [.github/ARCHITECTURE.md](ARCHITECTURE.md) - 15 minutes
* [ ] Study data model section
* [ ] Understand component hierarchy
* [ ] Review real-time collaboration flow

### Understanding Codebase

* [ ] Explore `frontend/src/components/` folder structure
* [ ] Read 1 page component (`FactsheetList.tsx`)
* [ ] Read 1 UI component (`Button.tsx`)
* [ ] Read 1 hook (`useRealtime.ts`)
* [ ] Look at `frontend/src/types/index.ts`
* [ ] Check `frontend/src/lib/pocketbase.ts`

### Understanding Development Process

* [ ] Read [.github/DEVELOPMENT.md](DEVELOPMENT.md) - 15 minutes
* [ ] Review "Adding a New Feature" section
* [ ] Check "Common Tasks" section
* [ ] Review "Styling with TailwindCSS"

**Time invested: ~45 minutes**

---

## 💻 First Coding Task

### Task: Create a Simple Component

* [ ] Read component template in [COPILOT_QUICK_REFERENCE.md](COPILOT_QUICK_REFERENCE.md#basic-component)
* [ ] Create `frontend/src/components/ui/Badge.tsx` (or similar simple component)
* [ ] Ask Copilot: "Create a Badge component following the pattern in [reference component]"
* [ ] Component renders without TypeScript errors
* [ ] Component uses TailwindCSS classes only
* [ ] Component follows naming conventions

**Estimated time: 15-30 minutes**

### Verification Checklist

* [ ] File created in correct location
* [ ] Component is TypeScript typed
* [ ] Component exports correctly
* [ ] No CSS files created
* [ ] Uses only TailwindCSS classes
* [ ] `npm run lint` passes
* [ ] No red errors in VS Code

---

## 🎯 Common First Tasks

### Task: Add a New Page

**Prerequisites:**
* [ ] Completed "First Coding Task" above
* [ ] Understand component hierarchy from ARCHITECTURE.md
* [ ] Know TypeScript basics

**Steps:**
1. [ ] Read "Adding a New Page" in [DEVELOPMENT.md](DEVELOPMENT.md#adding-a-new-page)
2. [ ] Create `frontend/src/pages/MyPage.tsx`
3. [ ] Ask Copilot for page component template
4. [ ] Add route in app router
5. [ ] Add navigation link in Sidebar
6. [ ] Verify page loads

**Success criteria:**
* [ ] Page renders at new route
* [ ] Sidebar navigation works
* [ ] No TypeScript errors
* [ ] Follows established patterns

---

### Task: Fetch Data from PocketBase

**Prerequisites:**
* [ ] Understand page components
* [ ] Read PocketBase section in [COPILOT_QUICK_REFERENCE.md](COPILOT_QUICK_REFERENCE.md#pocketbase-quick-ref)

**Steps:**
1. [ ] Choose a collection to fetch (e.g., `factsheets`)
2. [ ] Look at type definition in `src/types/index.ts`
3. [ ] Ask Copilot: "Fetch data from [collection] with loading and error states"
4. [ ] Reference `FactsheetList.tsx` as pattern
5. [ ] Implement in page component
6. [ ] Test with browser DevTools

**Success criteria:**
* [ ] Data displays on page
* [ ] Loading state works
* [ ] Error handling works
* [ ] No console errors

---

### Task: Add Real-time Updates

**Prerequisites:**
* [ ] Completed "Fetch Data" task
* [ ] Read about subscriptions in [copilot-instructions.md](copilot-instructions.md#real-time-updates)

**Steps:**
1. [ ] Review `useRealtime` hook in `src/hooks/`
2. [ ] Ask Copilot: "Add real-time subscription to [collection] in this component"
3. [ ] Reference pattern in [COPILOT_QUICK_REFERENCE.md](COPILOT_QUICK_REFERENCE.md#real-time-updates)
4. [ ] Implement subscription in useEffect
5. [ ] Add cleanup function

**Success criteria:**
* [ ] Data updates when changed in another tab/user
* [ ] Cleanup function prevents memory leaks
* [ ] No console warnings
* [ ] Component unmount works cleanly

---

## 📚 Learning Resources

### Bookmark These Files

* [ ] `.github/COPILOT_QUICK_REFERENCE.md` - Quick lookup during coding
* [ ] `.github/copilot-instructions.md` - Reference for patterns
* [ ] `.github/ARCHITECTURE.md` - Understanding system design
* [ ] `.github/DEVELOPMENT.md` - Workflow and common tasks

### External Documentation

* [ ] [React Docs](https://react.dev) - Open in browser
* [ ] [TypeScript Handbook](https://www.typescriptlang.org/docs) - Reference
* [ ] [TailwindCSS Docs](https://tailwindcss.com/docs) - Class reference
* [ ] [PocketBase Docs](https://pocketbase.io/docs) - API reference

---

## 🤖 Working with Copilot

### Daily Workflow

1. **Asking for Code:**
   - Provide context: "Create component like [reference]"
   - Be specific: "with these props: [list]"
   - Reference docs: "following copilot-instructions.md"

2. **Debugging Issues:**
   - Share full error message
   - Point to relevant file
   - Show what you tried
   - Ask for specific fix

3. **Understanding Code:**
   - Ask Copilot to explain existing patterns
   - Request architectural advice
   - Get suggestions for improvements

### Copilot Tips

* [ ] Use `Ctrl+I` for inline code generation
* [ ] Use `Ctrl+Shift+I` for detailed chat
* [ ] Reference file names in prompts
* [ ] Show Copilot similar working code
* [ ] Ask for specific file patterns
* [ ] Request TypeScript types explicitly
* [ ] Ask for TailwindCSS class suggestions
* [ ] Request testing code alongside implementation

---

## ✅ Week 1 Goals

* [ ] Environment fully set up
* [ ] Can create components
* [ ] Can fetch data from PocketBase
* [ ] Can implement real-time updates
* [ ] Can navigate codebase
* [ ] Comfortable asking Copilot for help
* [ ] Familiar with naming conventions
* [ ] TypeScript errors mostly fixed

---

## 🐛 Troubleshooting

### "Port 5173 already in use"

* [ ] Check `Get Terminal Output`
* [ ] Kill process: `npx kill-port 5173`
* [ ] Restart `npm run dev`

### "PocketBase connection refused"

* [ ] Is PocketBase running? Check terminal
* [ ] Is port 8090 open?
* [ ] Check `src/lib/pocketbase.ts` URL
* [ ] Visit http://127.0.0.1:8090/_ in browser

### "TypeScript errors everywhere"

* [ ] Run `npx tsc -b` to check
* [ ] Check `frontend/tsconfig.json` settings
* [ ] Import types with `import type`
* [ ] Check `.vscode/settings.json` for TypeScript

### "Copilot not suggesting code"

* [ ] Is Copilot extension installed?
* [ ] Are you signed in?
* [ ] Try `Ctrl+I` or `Ctrl+Shift+I`
* [ ] Restart VS Code

### "ESLint errors"

* [ ] Run `npm run lint` to see errors
* [ ] Check `.eslintrc.js` configuration
* [ ] Most errors auto-fixable
* [ ] Copilot can explain errors

---

## 📞 Getting Help

### Resources in Order of Try

1. Check [COPILOT_QUICK_REFERENCE.md](COPILOT_QUICK_REFERENCE.md)
2. Ask Copilot with context
3. Check relevant guide (ARCHITECTURE, DEVELOPMENT, etc.)
4. Review similar component in codebase
5. Check browser console for errors
6. Check PocketBase admin UI for data issues
7. Ask team lead or senior developer

---

## 🎓 Knowledge Checklist

By end of week, understand:

* [ ] Project's purpose and goals
* [ ] Frontend technology stack
* [ ] How PocketBase works
* [ ] Component file structure
* [ ] Naming conventions
* [ ] TypeScript patterns used
* [ ] TailwindCSS basics
* [ ] React hooks usage
* [ ] Real-time subscription pattern
* [ ] How to ask Copilot effectively

---

## 📊 Progress Tracker

| Milestone | Completed | Date |
|-----------|-----------|------|
| Environment setup | [ ] | ____ |
| Read all guides | [ ] | ____ |
| Create first component | [ ] | ____ |
| Add first page | [ ] | ____ |
| Fetch data from DB | [ ] | ____ |
| Implement real-time update | [ ] | ____ |
| Completed first feature | [ ] | ____ |
| Comfortable with Copilot | [ ] | ____ |

---

## 🎉 Next Steps

Once you complete this checklist:

1. **Start your first feature** - Use Copilot with the guides
2. **Read more advanced patterns** - Deep dive into specific areas
3. **Contribute PRs** - Make your first pull request
4. **Help others** - Share what you learned
5. **Improve project** - Suggest documentation improvements

---

**Welcome to the team! Happy coding! 🚀**

For questions, reference the guides in `.github/` directory or ask GitHub Copilot directly.

---

**Checklist version:** 1.0
**Last updated:** January 27, 2026
**Status:** ✅ Ready to use
