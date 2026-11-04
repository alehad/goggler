import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server.js';
import {POST} from '../../app/api/ebay/purchase-repair-preview/route.ts';
test('purchase preview rejects cross-origin requests before accessing data',async()=>{
 const response=await POST(new NextRequest('http://localhost/api/ebay/purchase-repair-preview',{method:'POST',headers:{origin:'https://other.example'}}));
 assert.equal(response.status,403);
});
test('purchase preview requires an existing app session rather than silently creating one',async()=>{
 const response=await POST(new NextRequest('http://localhost/api/ebay/purchase-repair-preview',{method:'POST',headers:{origin:'http://localhost'}}));
 assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);
});
test('capture requires active eBay authorization and accepts only item selection',async()=>{
 const {POST:capture}=await import('../../app/api/market-insights/capture/route.ts');
 const response=await capture(new NextRequest('http://localhost/api/market-insights/capture',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({items:[{itemId:'selected-id'}]})}));
 assert.equal(response.status,409);assert.equal((await response.json()).error,'ebay_reauth_required');
});
