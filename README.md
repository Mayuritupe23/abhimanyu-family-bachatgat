<p align="center">
  <img src="nova_core/public/images/logo.svg" alt="Abhimanyu Bachat Gat" width="300">
</p>

<h3 align="center">Abhimanyu Family Bachat Gat</h3>

<p align="center">
  A small app that runs a family savings group: monthly savings, loans, voting, fines and reports.<br>
  Built on <a href="https://frappeframework.com">Frappe</a> v16. English and मराठी.
</p>

---

## What it does

A *bachat gat* is a savings group: every member saves a fixed amount each month, and the group lends that money back to its members at a small interest. This app replaces the notebook and the Excel sheet.

- **Monthly payments.** A member opens *Pay now*, sees exactly what to pay this month (saving + loan interest + any fine), scans the group's UPI QR, attaches the screenshot and saves. An office bearer checks it and approves.
- **Late fines, worked out for you.** Rs 50 on the first day after the due date, then Rs 10 for every extra day.
- **Loans with group voting.** Members apply, everyone votes in the app, and the treasurer approves and pays out. Members repay any amount each month, or close the loan in one go.
- **Loan limit.** No member can owe more than the yearly limit in total. Old loans count towards it.
- **Monthly Sheet.** One screen per month with a row for every member, like the old Excel sheet:
  - *Entry*: approve payments, or record cash payments.
  - *Paise Bharna*: what each member has to pay this month.
  - *Statement*: the month-end financial statement.

  Both sheets copy as an image, ready to paste into the WhatsApp group.
- **Member exit.** Settles a leaving member: all their savings, plus their share of the earnings for each completed group year, minus any loan they still owe.
- **Dashboard.** Each member sees their own dues, loans and votes. Office bearers also see what needs attention and who has paid this month. There are trends for collection, savings and loans.
- **Phone app at `/afbg`.** A separate mobile app (installable, "AFBG" on the home screen) for members: this month's hapta with the UPI QR and screenshot upload, khata, loans with voting, and an Approve tab for approvers. English and मराठी. The full desk stays at `/desk/gat`.
- **Reports.** Member Passbook, Pending Dues and Group Balance (where every rupee is: cash, loans, expenses).

## Who does what

| Role | Can |
|---|---|
| Member | Pay and upload a screenshot, see their own passbook and loans, vote on loan requests |
| Office bearer (Adhyaksh, Upadhyaksh, Sachiv, Sahsachiv) | See everything |
| Approver (tick *Can Approve Payments* on the member) | Approve payments, record cash, add members, create logins, enter loans |
| Khajinadar (treasurer) | Everything an approver can, plus approve and pay out loans |

Roles follow the member record. When the office bearers change, edit the member's designation and the logins update themselves.

## A month in the group

1. **1st of the month.** Open *Monthly Sheet → Paise Bharna* and share the image on WhatsApp.
2. **Until the 15th.** Members pay by UPI and enter it in the app. Approvers tick the blue rows green.
3. **Month end.** Share *Monthly Sheet → Statement* on WhatsApp.

## Group rules (all in Group Settings)

| Setting | Default |
|---|---|
| Monthly saving | Rs 1,000 |
| Due date | 15th of the month |
| Late fine | Rs 50, then Rs 10 per day |
| Interest | 2% per month on the loan balance |
| Loan limit per member | Rs 30,000 |
| Close a loan within | 10 months (loans from November 2026 on) |
| Payment QR / UPI ID | Shown on the payment form |

## Install

You need a working [bench](https://github.com/frappe/bench) with Frappe v16.

```bash
cd ~/frappe-bench
bench get-app git@github.com:Mayuritupe23/abhimanyu-family-bachatgat.git --branch main
bench --site your.site install-app nova_core
bench --site your.site migrate
```

Then, as Administrator:

1. **Group Settings:** group name, start date, rules, and the payment QR.
2. **Member:** add each member and their designation, then press *Create Login* (members sign in with their mobile number).
3. Tick **Can Approve Payments** for the people who check payments.

## Under the hood

- The phone app is Vue 3 in `frontend/`. Build it with `cd frontend && npm install && npx vite build`; the output goes to `nova_core/public/frontend` and `nova_core/www/afbg.html`.

- App name `nova_core`. One module with DocTypes Member, Monthly Payment, Loan, Loan Vote, Group Expense, Member Exit and Group Settings.
- The dashboard and the Monthly Sheet are plain JavaScript with hand-drawn SVG charts, no chart library.
- The workspace is locked, so nobody can rearrange or edit it from the desk.
- Marathi labels are in `nova_core/translations/mr.csv`; each user picks their language under *My Settings*.
- Run the tests with `bench --site your.site run-tests --app nova_core`.

## License

MIT
