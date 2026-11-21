const assert = require('node:assert/strict');
const { test } = require('node:test');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

function orderHistory() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' },
    ],
  };
}

function khataLedger() {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', totalBilled: 2432.01, totalSettled: 1200 }],
    nextSettlementId: 1,
    settlements: [],
  };
}

test('order history lists the newest orders first across months and years', () => {
  const result = orders.list(orderHistory());

  assert.deepEqual(result.map(({ id }) => id), [1008, 1004, 1001]);
});

test('a January-to-March date filter excludes the December order', () => {
  const result = orders.list(orderHistory(), { from: '2022-01-15', to: '2022-03-30' });

  assert.deepEqual(result.map(({ id }) => id), [1008, 1004]);
});

test('the date filter includes orders on both date boundaries', () => {
  const result = orders.list(orderHistory(), { from: '2022-01-30', to: '2022-03-15' });

  assert.deepEqual(result.map(({ id }) => id), [1008, 1004]);
});

test('a string settlement increases the settled total and reduces the balance', () => {
  const db = khataLedger();
  const [before] = ledger.listCustomers(db);
  assert.equal(before.totalSettled, 1200);
  assert.equal(before.balance, 1232.01);

  const result = ledger.recordSettlement(db, '1', '500');

  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 500);
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  const [after] = ledger.listCustomers(db);
  assert.equal(after.totalSettled, 1700);
  assert.equal(after.balance, 732.01);
});

test('a settlement also handles a stored string total', () => {
  const db = khataLedger();
  db.customers[0].totalSettled = '1200';

  const result = ledger.recordSettlement(db, '1', '500');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('a nonnumeric settlement leaves the ledger untouched', () => {
  const db = khataLedger();

  assert.equal(ledger.recordSettlement(db, '1', 'invalid').ok, false);
  assert.deepEqual(db, khataLedger());
});

test('a numeric settlement adds to an existing numeric settled total', () => {
  const db = khataLedger();
  const result = ledger.recordSettlement(db, '1', 500);

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('fractional settlements accumulate before rounding the displayed balance', () => {
  const db = khataLedger();

  ledger.recordSettlement(db, '1', '0.004');
  const result = ledger.recordSettlement(db, '1', '0.004');

  assert.deepEqual(db.settlements.map(({ amount }) => amount), [0.004, 0.004]);
  assert.equal(result.customer.balance, 1232);
});
