# Code-integrity review: hidden code in this repository (2026-10)

Status as of 2026-10-22:

- **This branch** (`claude/resume-one-page-keywords-lfau66`): all known instances removed in the working tree, and a check now blocks their return. Removal takes effect once the commit is pushed.
- **The other 9 branches:** not yet remediated.
- **Machines:** exposure unknown.

This record states what the repository and GitHub's records show. Where something is inferred or unknown, it says so. It does not identify who wrote the code or why; the records don't show that.

## 1. What was found

Four kinds of hidden code, all read as text and never run:

| # | Where | Kind | First added by |
|---|---|---|---|
| 1 | `.vscode/tasks.json`, `.vscode/settings.json`, `public/fonts/fa-solid-400.woff2` | An editor task set to run on folder open, with settings that skip VS Code's prompt. It runs `node` on a "font" file that is actually 9 KB of JavaScript | `efcc955` (dated 2026-06-25; pushed 2026-07-31) |
| 2 | `sentinel/src/tailwind.config.js` | Code appended to the end of a valid config, after a long run of tabs | `e694149` (2026-08-22) |
| 3 | `sentinel/src/tailwind.config.js` | A second variant of #2 | `93a6d69` (2026-09-08) |
| 4 | `api.js`, `package.json`, `sentinel/src/tailwind.config.js` | A third variant, plus a new `api.js` (code hidden after whitespace). The `dev` script was changed to `node api.js && …` | `a8e8900`, `1ae77b5`, `a92ceb4`, `cc57dc6`, `5f416f8` (2026-10-17) |

None of these paths are read by the portfolio build or by `scripts/deploy.sh`.

## 2. What the code does

**Confirmed by reading it.** This applies to the readable variants (#1 after decoding `\uXXXX` escapes, and #2). Variants #3 and #4 are obfuscated; they share the same identifier string and structure, but I did not fully decode them. When loaded by Node, it:

1. Starts immediately, with no function call needed.
2. Queries public Ethereum RPC endpoints, and a block-explorer API as a fallback, for the latest transaction from one fixed address.
3. Reads two IPv4 addresses out of that transaction's destination field.
4. Downloads two blobs over plain HTTP from the first address (port 443, paths `/0x/cls` and `/0x/ls`), sending a Windows Chrome user-agent.
5. Decrypts each blob with a fixed XOR key.
6. Runs the result twice: in-process with `eval`, and in a **detached, hidden** `node -e` process that keeps running after the parent exits.
7. Passes Node's `require` and `module` to the downloaded code, giving it full access to files, network and processes.
8. Suppresses all errors.

**Not known:**

- What the downloaded code does: it was never retrieved, and its servers were not contacted.
- Whether those servers respond.
- Whether any of this ever ran on any machine.
- Who wrote it, and why.

**When it would run:**

| Variant | Trigger |
|---|---|
| #1 | Opening the repository folder in VS Code or Cursor as a trusted workspace (runs silently, every time) |
| #2–#4 | Anything that loads `sentinel/src/tailwind.config.js` (e.g. a Tailwind build of Sentinel) |
| `api.js` | `npm run dev` at the repository root |

## 3. How it entered the repository

From GitHub's repository activity log (`GET /repos/…/activity`) and the commits themselves:

- **21 force pushes**, between 2026-07-31 and 2026-10-17, replaced the latest commit on branches with a modified copy. They came in waves, all branches within about 17 seconds each time.
- **Each copy keeps the original commit message and author name and time.** It adds the code above, has no signature, and changes the committer timezone to −07:00.
- **All 21 were made with one collaborator account.** The owner had granted it write access and removed that access on 2026-10-22. This record does not name the account.
- **Commit `93a6d69`** carries the owner's name and the message "Add files via upload", but it is not a GitHub web upload (no GitHub committer or signature). It arrived by force push on 2026-09-08.
- **A force push on 2026-08-22 also added three entries to `.gitignore`:** `temp_auto_push.bat`, `temp_interactive_push.bat`, `branch_structure.json`. *Inference, not verified:* the pushes were made by an automated tool on Windows.
- **The 2026-08-22 and 2026-09-08 pushes also replaced the whole history of five branches.** See §6 for where the earlier commits are.

**Since 2026-10-22, verified by reading back the settings:**

- The owner is the only collaborator.
- A repository ruleset blocks force pushes (`non_fast_forward`) and deletions on this branch.

## 4. Exposure

| Area | Finding |
|---|---|
| Live site (Pages repo) | **Clean.** All 75 commits scanned; no payload paths or markers. Only the owner and the Actions bot have pushed there |
| GitHub Actions | No workflow added or changed by any of the 21 pushes. One CI run was triggered by a rewritten commit (`jarvis.yml`, read-only token, runs `jarvis/` tests only); it does not load the payload paths |
| Credentials in the repository | **None found**, across all 85 commits and every branch. Formats checked: AWS, GitHub, Anthropic/OpenAI, Slack, Google API, JWT/Supabase, private keys, Stripe webhook, Meta tokens. `portfolio/.env.production` holds only public build values; `jarvis/.env.example` has an empty key |
| Login code | No targeted change to High Properties' auth/admin files. They change only where whole branches were replaced, and are identical to the default branch's |
| Machines | **Unknown.** Treat a machine as possibly affected if, since 2026-07-31, it opened this repository in VS Code/Cursor as a trusted workspace, ran `npm run dev` at the root, or built Sentinel with Tailwind |

**If a machine may be affected:**

1. Disconnect it and scan it.
2. From a different device, rotate:
   - GitHub sessions, tokens and SSH keys;
   - npm tokens;
   - API keys stored on that machine (e.g. `jarvis/.env`);
   - any Supabase, WhatsApp or Meta secrets ever loaded there;
   - Google and brokerage sessions;
   - browser-saved passwords;
   - crypto wallets.
3. Check for stray background `node` processes, and for unexpected login items or launch agents.

## 5. Remediation

| Branch | Tip | Findings at tip (`tools/repo-integrity.mjs --rev`) | Status |
|---|---|---|---|
| `claude/resume-one-page-keywords-lfau66` | `5454cc7` → stage-1 commit | 4 → **0** | #2–#4 removed in `6ecd080`; #1 removed in the stage-1 commit (all 22 files `efcc955` added; the commit it replaced had none of them, and nothing references them) |
| `claude/high-properties-v4-overhaul-ktwy5t` (default) | `a8e8900` | 7 | Cleanup commit `4a40dfa` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/add-skill-sessions-k620xh` | `a8e8900` | 7 | Cleanup commit `4a40dfa` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/icloud-reusable-skill-daro1p` | `a8e8900` | 7 | Cleanup commit `4a40dfa` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/bank-deposit-bonus-analysis-med2uc` | `1ae77b5` | 7 | Cleanup commit `5da6f49` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/energy-stocks-analysis-10ey87` | `a92ceb4` | 7 | Cleanup commit `55fed72` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/private-markets-positioning-system-b5twgr` | `cc57dc6` | 7 | Cleanup commit `761776c` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/public-apis-integration-2k05vq` | `93a6d69` | 7 | Cleanup commit `6496084` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/quant-career-mentorship-h414h6` | `93a6d69` | 7 | Cleanup commit `6496084` prepared locally (0 findings there); not pushed, awaiting the owner's approval |
| `claude/trading-agents-website-7ncfgt` | `93a6d69` | 7 | Cleanup commit `6496084` prepared locally (0 findings there); not pushed, awaiting the owner's approval |

**Restoring earlier commits does not clean a branch.** The commits each branch had before its first rewrite already contain variant #1, because they were built on top of `efcc955`. The safe fix for every branch is the same as for this one: an ordinary new commit that removes the payload paths and restores `package.json` and `sentinel/src/tailwind.config.js`. Work lost in the history replacements can then be brought back from the earlier commits (§6), file by file, after the same check.

**Prevention now in place on this branch:**

- **`tools/repo-integrity.mjs`** reads every tracked file and fails on any of these patterns. It runs:
  - in `npm test`;
  - first in `scripts/deploy.sh` (no deploy if it fails);
  - in a GitHub workflow (`.github/workflows/integrity.yml`) on every push.
- **Pinned actions:** GitHub Actions pinned to commit SHAs.
- **Ruleset:** blocks force pushes and branch deletion.

**Recommended on each machine:** keep VS Code's Workspace Trust prompt on, and open unfamiliar folders in Restricted Mode.

## 6. Evidence

The originals of every rewritten commit, and the commits they replaced, are still on GitHub, reachable by SHA:

| Rewritten | Replaced |
|---|---|
| `efcc955` | `6d8a81a` |
| `e694149` | `67165dd`, `b9528d9`, `51cad55`, `153ad6b`, `8e6686d`, `dad0bdb` |
| `93a6d69` | `46a684b` |
| `a8e8900`, `1ae77b5`, `a92ceb4`, `cc57dc6`, `5f416f8` | `93a6d69`, `b08e4fb`, `1ea76c9`, `fe67253`, `38266f4` |

GitHub can eventually remove commits that no branch points to.

**What is preserved, and where:** a verified `git bundle` of all of them, the payload files saved as inert `.txt`, the activity log and SHA-256 checksums. They are held outside the repository, so that the code itself is not re-committed. Keeping a durable copy needs a decision: for example, downloading the bundle, or pushing protected `refs/incident/*` references.

**SHA-256 of the payload files** (for matching against other copies):

| File | SHA-256 |
|---|---|
| `public/fonts/fa-solid-400.woff2` | `9fbb31129c04e8eb1a50519fc864c74d1b20d57c07d4099348f8fbc9a1a1eae6` |
| `.vscode/tasks.json` (from `efcc955`) | `f5c6be4753d6613c97f1b10c4d93a5d97a8f4fb21eb13da0ed04b23a8a61c2f6` |
| `.vscode/settings.json` (from `efcc955`) | `c0450d71e0b6d06f4d02177c2e7f59444ab368676a807b1e5ba0697ac2ad1859` |
| `api.js` (from `a8e8900`) | `41a69ba3946396d2d1c15f2e43be705f0793e8773dee0f3dda89a541d31c00d9` |
| `sentinel/src/tailwind.config.js` @ `e694149` | `2bf10d3e8ad6b4c47eb5136fc7ecb063739c010a86e5edb222fa87d737b9d43d` |
| `sentinel/src/tailwind.config.js` @ `93a6d69` | `16e820c58a4c7929aab236a29e8cf6937ae0004e2d7ca0e1d3fb7dd47697a4af` |
| `sentinel/src/tailwind.config.js` @ `a8e8900` | `37fea798f39ab884805e58927a934418f8b37535ec94ab70e1c6ff0d682357d4` |

## 7. Corrections to earlier statements in this repository and session

- **Attribution:** earlier notes attributed `93a6d69` to the owner's upload, and suggested the owner's Mac was rewriting commits. GitHub's records show the pushes came through a collaborator account and the authorship fields were copied; the records do not show which machine made them.
- **Earlier cleanup:** `6ecd080` ("remove injected malware") removed variants #2–#4 from this branch but missed #1. It is removed in the stage-1 commit.
