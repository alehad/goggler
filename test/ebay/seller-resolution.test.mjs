import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveSellerDetails} from '../../src/ebay/seller-profile.ts';
import {assembleListings} from '../../src/ebay/listing-assembly.ts';
const row=(itemId,sellerUserId,more={})=>({itemId,sellerUserId,...more});
test('same-listing username evidence resolves identity across that response without changing raw IDs or financial authority',()=>{
 const input=[{...row('one','201977996'),title:'Won',list:'WonList',currentPrice:{value:25,currency:'USD'}},{...row('one','facerecords'),title:'Watch',list:'WatchList',currentPrice:{value:99,currency:'GBP'}},{...row('two','201977996'),title:'Other won',list:'WonList'}];
 const result=assembleListings(input);
 assert.equal(result[0].sellerUserId,'201977996');assert.equal(result[0].sellerDisplayName,'facerecords');assert.equal(result[0].sellerProfileUrl,'https://www.ebay.co.uk/usr/facerecords');
 assert.deepEqual(result[0].currentPrice,{value:25,currency:'USD'});assert.equal(result[1].sellerDisplayName,'facerecords');
 assert.equal(input[0].sellerDisplayName,undefined);
});
test('another product/title or another call cannot establish an identity association',()=>{
 const [unknown]=resolveSellerDetails([row('one','123'),row('unrelated','facerecords')]);
 assert.equal(unknown.sellerDisplayName,'Seller 123');assert.equal(unknown.sellerProfileUrl,undefined);
 const [separate]=resolveSellerDetails([row('two','201977996')]);assert.equal(separate.sellerDisplayName,'Seller 201977996');
});
test('contradictory equal-strength names do not infer a username',()=>{
 const evidence=[row('one','123'),row('one','old-name'),row('two','123'),row('two','different-name')];
 const [result]=resolveSellerDetails([row('three','123')],evidence);assert.equal(result.sellerUsername,undefined);assert.equal(result.sellerProfileUrl,undefined);
});
test('explicit username evidence outranks legacy labels, and numeric usernames remain valid',()=>{
 const [result]=resolveSellerDetails([row('one','123')],[row('one','123'),row('one','older'),row('one','123',{sellerUsername:'456'})]);
 assert.equal(result.sellerDisplayName,'456');assert.equal(result.sellerProfileUrl,'https://www.ebay.co.uk/usr/456');
 const [numeric]=resolveSellerDetails([row('other','123',{sellerUsername:'123'})]);assert.equal(numeric.sellerDisplayName,'123');assert.equal(numeric.sellerProfileUrl,'https://www.ebay.co.uk/usr/123');
});
test('multiple opaque identities for a listing and masked labels do not establish associations',()=>{
 const [result]=resolveSellerDetails([row('two','123')],[row('one','123'),row('one','456'),row('one','facerecords')]);
 assert.equal(result.sellerProfileUrl,undefined);
 const [masked]=resolveSellerDetails([row('one','a***b')]);assert.equal(masked.sellerProfileUrl,undefined);
});
test('profile paths are encoded and username-shaped data cannot introduce an external link',()=>{
 const [result]=resolveSellerDetails([row('one','id',{sellerUsername:'name/https://evil.example'})]);
 assert.equal(new URL(result.sellerProfileUrl).hostname,'www.ebay.co.uk');assert.ok(result.sellerProfileUrl.includes('%2F'));
});
