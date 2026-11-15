# CS 220 Group Project: Campus Library Database

Northbridge University · Fall 2026 · Groups of 3–4

## The task
Design and build the database behind the campus library: members borrow copies of books, return them late
or on time, and pay fines. Librarians register new copies and manage members.

Your design must include at least six entities: Member, Book, Copy, Loan, Fine and Librarian.

## Milestone 1: entity–relationship diagram (10%)
**Due: Friday 27 November 2026, 23:59** (upload one PDF per group)
- ERD with every entity, attribute, primary key and relationship, with cardinalities.
- One paragraph per relationship explaining its cardinality.

## Milestone 2: final report and SQL (30%)
**Due: Friday 11 December 2026, 23:59**
- The schema normalised to **third normal form**, showing each functional dependency you removed.
- `CREATE TABLE` statements with keys and constraints.
- Five queries, at least two of them using joins:
  1. All books a given member currently has on loan.
  2. Members with unpaid fines above 5.00.
  3. Copies never borrowed (use an outer join).
  4. The ten most borrowed books this semester.
  5. A query of your choice, with a sentence on why it is useful.
- A short reflection (max 300 words) on one place where you chose *not* to normalise further, and why.

## Marking
| Criterion | Weight |
|---|---|
| Correct ERD and cardinalities | 20% |
| Normalisation, with dependencies stated | 30% |
| SQL correctness | 30% |
| Reflection, with claims backed by the readings | 20% |
