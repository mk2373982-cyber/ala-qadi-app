# Savings Goals and Recurring Transactions

## Goal

Help customers plan toward a savings target and reduce repeated entry for regular income and expenses, using polished, clear controls on the dashboard.

## Product behavior

- Add local savings goals with a name, target amount, saved amount, and optional target date. Customers can create, edit, add progress, and delete a goal.
- Goal progress is informational and does not change wallet balances or transactions.
- Add monthly recurring income/expense templates with amount, category, wallet, first due date, and name.
- Show upcoming recurring items on the dashboard. Adding a monthly obligation never changes a wallet. When due, the customer explicitly confirms completion or skips that occurrence; never post money automatically.
- Confirming completion creates one normal transaction dated for the actual completion day, updates its selected wallet once, and makes the next occurrence available on the first day of the following month.
- After completion, show a completed-this-month state and do not offer another completion until the next month starts. Paused recurring templates do not appear as due. Customers can edit, pause, resume, or delete them.
- Keep goals and recurring templates local and include them in JSON and encrypted Drive backup/restore.
- Clearing financial data deletes goals and recurring templates while retaining wallet definitions and resetting wallet balances to zero.

## Design direction

- Keep the app's existing Arabic-first emerald identity, with a focused jade goal panel and a quieter blue recurring panel.
- Present goal progress as a readable amount and progress track, not a dense chart.
- Present recurring items as a short action list: due date, amount, wallet, and a clear record/skip action.
- On mobile, stack the two sections and keep actions reachable without horizontal scrolling.

## Verification

- TypeScript and production build succeed.
- Adding/editing/deleting goals updates progress without changing wallet balances.
- Recording a recurring item writes exactly one transaction, adjusts its wallet, and advances the due date; repeat taps cannot duplicate it.
- Skipping advances a due date without changing transactions or wallet balance.
- Backup export/restore preserves goals and recurring rules; clear-all removes them but retains wallets.
