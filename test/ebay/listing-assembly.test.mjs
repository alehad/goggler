import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assembleListings } from '../../src/ebay/listing-assembly.ts';
import { assembleAnalyticsHistory } from '../../src/market-insights/assembled-history.ts';
import { DEFAULT_MATCHING_PREFERENCES } from '../../src/ebay/matching-preferences.ts';
const observation=(list,price,extras={})=>({itemId:'same',title:'Blue Note BNJ71001',list,currentPrice:price,endTime:'2026-01-01T00:00:00Z',...extras});
const money=(value,currency='USD')=>({value,currency});
test('Won > Lost > Watched applies regardless of input order and preserves source observations',()=>{
 const watch=observation('WatchList',money(99),{imageUrl:'https://i.ebayimg.com/test.jpg'});
 const lost=observation('LostList',money(50),{maxBid:money(40)});
 const won=observation('WonList',money(25),{endTime:'2026-01-02T00:00:00Z'});
 for(const records of [[watch,lost,won],[lost,won,watch],[won,watch,lost]]){
  const rows=assembleListings(records);assert.equal(rows.length,1);assert.equal(rows[0].list,'WonList');
  assert.deepEqual(rows[0].currentPrice,money(25));assert.equal(rows[0].maxBid,undefined);
  assert.equal(rows[0].endTime,won.endTime);assert.equal(rows[0].imageUrl,watch.imageUrl);
 }
 assert.equal(won.imageUrl,undefined);assert.equal(watch.currentPrice.value,99);
});
test('Lost facts dominate watched prices, dates and maximum bids',()=>{
 const [row]=assembleListings([observation('WatchList',money(99)),observation('LostList',money(50),{maxBid:money(40)})]);
 assert.equal(row.list,'LostList');assert.deepEqual(row.currentPrice,money(50));assert.deepEqual(row.maxBid,money(40));
});
test('A missing authoritative price never falls through to a watched price',()=>{
 for(const list of ['WonList','LostList']){
  const [row]=assembleListings([observation(list,undefined),observation('WatchList',money(99))]);
  assert.equal(row.currentPrice,undefined);
 }
});
test('Product matching occurs after identity resolution, retaining distinct listings and capture flags',()=>{
 const rows=assembleAnalyticsHistory([
  observation('WonList',money(25)),observation('WatchList',money(99),{title:'Wrong TBM59'}),
  observation('LostList',money(30),{itemId:'other'}),observation('WatchList',money(40),{itemId:'unmatched',title:'No identifier'})
 ],new Set(['same']),DEFAULT_MATCHING_PREFERENCES);
 assert.equal(rows.length,3);const won=rows.find(r=>r.itemId==='same');assert.equal(won.won,true);assert.equal(won.captured,true);
 assert.equal(won.currentPrice.value,25);assert.equal(won.relistingGroupId,'criteria:BNJ71001');
 assert.equal(rows.find(r=>r.itemId==='other').eventuallyWon,true);assert.equal(rows.find(r=>r.itemId==='unmatched').eventuallyWon,false);
});
