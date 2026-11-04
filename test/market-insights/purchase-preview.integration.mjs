import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {config} from 'dotenv';
import {NextRequest} from 'next/server.js';
import {POST} from '../../app/api/ebay/purchase-repair-preview/route.ts';
import {sessionStore} from '../../src/auth/local-auth.ts';
import {createPrismaClient} from '../../src/persistence/prisma.ts';
config({path:'.env.local'});
let prisma;
before(async()=>{
 assert.ok(process.env.TEST_DATABASE_URL);
 process.env.GOGGLER_DB_TARGET='local';process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
 prisma=createPrismaClient(process.env.TEST_DATABASE_URL);
});
beforeEach(async()=>{await prisma.wonItem.deleteMany();await prisma.matchingPreferences.deleteMany();});
after(async()=>{await prisma?.$disconnect();});
test('authenticated preview resolves live transaction evidence without writing records, import runs, settings or OAuth material',async()=>{
 await prisma.wonItem.create({data:{userId:'local-saja',venueItemId:'same',title:'Record BNJ71001',itemPriceAmount:0,currency:'USD'}});
 const snapshot=async()=>JSON.stringify(await Promise.all([
  prisma.wonItem.findMany(),prisma.wonItemImportRun.findMany(),prisma.lostItem.findMany(),prisma.lostItemImportRun.findMany(),prisma.marketPriceRecord.findMany(),prisma.matchingPreferences.findMany()
 ]));
 const before=await snapshot();
 const {token,session}=sessionStore.createSession('local-saja');
 sessionStore.setEbayAuthorization(session.id,{accessToken:'preview-credential-must-not-be-stored',tokenType:'Bearer',expiresAt:new Date(Date.now()+60000),scopes:[],authorizedAt:new Date()});
 const originalFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,init)=>{
   const call=init?.headers?.['X-EBAY-API-CALL-NAME'];
   if(call==='GetOrders')return new Response('<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><TransactionArray><Transaction><Item><ItemID>same</ItemID><Title>Record BNJ71001</Title></Item><TransactionPrice currencyID="USD">25.00</TransactionPrice></Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>');
   if(call==='GetMyeBayBuying')return new Response('<GetMyeBayBuyingResponse><Ack>Success</Ack></GetMyeBayBuyingResponse>');
   throw Error('Unexpected external request');
  };
  const response=await POST(new NextRequest('http://localhost/api/ebay/purchase-repair-preview',{method:'POST',headers:{origin:'http://localhost',cookie:`goggler_session=${token}`}}));
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.readOnly,true);assert.equal(body.rows.length,1);assert.equal(body.rows[0].proposedPrice.value,25);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(await snapshot(),before);
  assert.equal((await snapshot()).includes('preview-credential-must-not-be-stored'),false);
 }finally{globalThis.fetch=originalFetch;sessionStore.expireSession(token);}
});
