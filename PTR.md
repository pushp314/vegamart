IMPORTANT ENGINEERING RULES:

- Do not blindly rewrite files.
- Do not change architecture unless required.
- Do not suppress TypeScript errors with @ts-ignore/@ts-nocheck.
- Do not weaken validation to make tests pass.
- Do not remove existing authorization checks.
- Do not silently change business rules.
- Do not create duplicate utilities when an existing utility already handles the concern.
- Inspect Prisma schema/migrations before changing persistence logic.
- Use existing transaction patterns.
- Search all callers before changing a function's contract.
- Search the repository for every affected API/field/status before modifying it.
- Add regression tests for every fixed bug.
- If the existing schema cannot safely support the required behavior, stop and explain the schema limitation instead of inventing an unsafe workaround.
- After implementation, run typecheck and relevant tests.
- Report exactly what changed and what remains unresolved.