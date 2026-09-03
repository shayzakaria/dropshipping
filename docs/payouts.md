# How money reaches an influencer

The short version, and the reason each step exists.

## The four states of a shekel

1. **נצבר** — a sale went through a code. The commission is recorded the
   moment the shop calls `/api/redeem`.
2. **ממתין לשחרור** — for 14 days after the sale. Israeli distance-selling
   law gives the buyer that long to cancel, and a cancelled sale takes its
   commission back with it. Paying before the window closes means paying on
   sales that did not happen and asking for the money back afterwards.
3. **זמין למשיכה** — the window closed and the sale stands.
4. **שולם** — the transfer left the bank and an operator marked it here.

`walletStats` computes the first three; `/admin/payouts` closes the fourth.

## The minimum threshold

₪100. It is not there to hold anyone's money — it is there because a bank
transfer costs roughly the same whether it moves ₪12 or ₪1,200, and paying
₪12 out fifty times is a cost that ends up coming out of commissions.
Anything under the threshold stays in the balance and goes out with the next
one.

## What we ask for, and when

Nothing at signup beyond a name and an email. Bank details are asked for at
the moment there is something to send — see `components/PayoutPanel.tsx`,
which shows the form only once `available >= MIN_PAYOUT`. Demanding an
account number from someone who has earned nothing is the standard way to
lose them at the door.

The fields are the ones a transfer actually needs: legal name as written on
the account, national ID, bank, branch, account number, and tax status.
Tax status decides whether they invoice us (עוסק פטור / מורשה) or we pay with
tax withheld at source.

## Where the details live

`public.payout_details`, one row per influencer. RLS on, no policies, so
only the service key reads it. Never shown to a business. Displayed on
`/admin/payouts` only while a request is open, and not after it settles.

**This should not stay here.** Holding bank details is a liability we are
carrying because the alternative — a payment provider — is not worth wiring
up for a pilot with a handful of influencers. Before this grows past that,
move to a provider (Tipalti, Payoneer, or an Israeli equivalent) and delete
the table. Written down here so it is a decision that was made, not an
oversight that was never noticed.

## Requesting and settling

An influencer asks for a payout; `createPayoutRequest` freezes the amount at
the moment of asking, so a later sale or cancellation cannot move the number
that was agreed. One open request at a time.

An operator sees it on `/admin/payouts` with the bank details, makes the
transfer in the bank, and marks it paid with a reference — or rejects it with
a reason. Both outcomes are written to `admin_actions` before they are
applied.
