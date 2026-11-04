import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildPurchaseRepairPlan} from '../../src/ebay/purchase-repair-plan.ts';
const row=(value,extra={})=>({itemId:'same',title:'Record',list:'WonList',currentPrice:{value,currency:'USD'},...extra});
test('dry run proposes a same-listing transaction repair without mutating source records',()=>{
 const stored=row(0), live=row(25,{purchasePriceSource:'transaction'});
 const plan=buildPurchaseRepairPlan([stored],[live]);assert.equal(plan[0].proposedPrice.value,25);assert.equal(plan[0].status,'proposed');assert.equal(stored.currentPrice.value,0);
});
test('watched/listing prices and similar titles cannot repair paid price',()=>{
 for(const live of [row(25,{purchasePriceSource:'listing'}),row(25,{itemId:'different',purchasePriceSource:'transaction'})]){
  const [plan]=buildPurchaseRepairPlan([row(0)],[live]);assert.equal(plan.status,'unresolved');assert.equal(plan.proposedPrice,undefined);
 }
});
test('explicit transaction zero may repair a nonzero value; unchanged rows are omitted',()=>{
 assert.equal(buildPurchaseRepairPlan([row(25)],[row(0,{purchasePriceSource:'transaction'})])[0].proposedPrice.value,0);
 assert.deepEqual(buildPurchaseRepairPlan([row(25)],[row(25,{purchasePriceSource:'transaction'})]),[]);
});
test('preview includes transaction-date corrections even when the paid amount already matches',()=>{
 const [plan]=buildPurchaseRepairPlan([row(25,{endTime:'2026-01-01T00:00:00Z'})],[row(25,{purchasePriceSource:'transaction',endTime:'2026-01-02T00:00:00Z'})]);
 assert.equal(plan.status,'proposed');assert.equal(plan.currentPurchasedAt,'2026-01-01T00:00:00Z');assert.equal(plan.proposedPurchasedAt,'2026-01-02T00:00:00Z');
});
