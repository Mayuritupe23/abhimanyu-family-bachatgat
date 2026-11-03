# Requirements (gathered 2026-11-03)

Family savings group (bachat gat) app. Frappe only, no ERPNext.

## Group
- Single group for now, 10-20 members.
- Office bearers (5): Adhyaksh, Upadhyaksh, Sachiv, Sahsachiv, Khajinadar.
- Every member gets a login and sees only their own records.
- Member details: name, mobile, address, Aadhaar/PAN, nominee, bank account.
- Group year runs from the group start date (anniversary-based, not FY).

## Monthly payment
- Due on the 15th of every month.
- One combined payment: fixed savings (Rs 1000, same for all, configurable) + loan interest + optional principal.
- Member pays by PhonePe/UPI, then enters UTR + screenshot. Khajinadar verifies.
- Late fine, applied once per payment: Rs 50 on day 16, then +Rs 10 per day (17th = 60, 18th = 70...). No cap.

## Loan
- Interest 2% per month on outstanding principal.
- Yearly limit per member set by budget (this year Rs 30,000). Total outstanding across a member's loans must stay within the limit.
- A top-up is a separate loan with its own 10-month clock.
- Principal repayment is at the member's choice, but each loan must be zero within 10 months.
- If a loan is past 10 months, the member cannot take a new loan until it is cleared. Interest keeps running.
- Flow: member applies in app, all members vote (votes can change while Applied; a No never auto-rejects). Khajinadar reviews the votes and manually approves or rejects, then disburses. No guarantor.

## Member exit
- Member gets back all savings (principal), minus any outstanding loan.
- Plus their share of earnings for each completed group year only. The current incomplete year earns nothing.
- Share per completed year = (member savings that year / total group savings that year) x group earnings that year.
- Group earnings = interest + fines - expenses.

## Other
- Group expense entry (bank charges, stationery).
- UI in English and Marathi (per-user language).
- Earnings are not distributed yearly; they stay in the group fund.

## Deferred
- WhatsApp reminders (paid API).
- Meeting attendance/minutes.
- Multiple groups.
